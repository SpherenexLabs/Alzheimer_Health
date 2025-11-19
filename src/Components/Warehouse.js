import React, { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import "./Warehouse.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const firebaseConfig = {
  apiKey: "AIzaSyAXHnvNZkb00PXbG5JidbD4PbRgf7l6Lgg",
  authDomain: "v2v-communication-d46c6.firebaseapp.com",
  databaseURL: "https://v2v-communication-d46c6-default-rtdb.firebaseio.com",
  projectId: "v2v-communication-d46c6",
  storageBucket: "v2v-communication-d46c6.firebasestorage.app",
  messagingSenderId: "536888356116",
  appId: "1:536888356116:web:983424cdcaf8efdd4e2601",
  measurementId: "G-H0YN6PE3S1",
};

const app = initializeApp(firebaseConfig, "warehouse");
const db = getDatabase(app);

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = "8269193436:AAF8YRTib4jHyARWWFusSvAHN9N9rgoOcOw";
const TELEGRAM_CHAT_ID = "624339934";

function isNumeric(v) {
  return !isNaN(parseFloat(v)) && isFinite(v);
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export default function WareHouse() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [latest, setLatest] = useState({});
  const [series, setSeries] = useState({});
  const [path] = useState("/WareHouse");
  const [toasts, setToasts] = useState([]);
  const particlesCanvasRef = useRef(null);
  const animationRef = useRef(null);
  const previousDispenserRef = useRef(null);
  const telegramSentRef = useRef(false);
  const lastUpdateIdRef = useRef(0);
  const latestDataRef = useRef({});

  const showToast = (message, type = "warning") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const getChatId = async () => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
      const response = await fetch(url);
      const result = await response.json();
      
      console.log("=== GET CHAT ID ===");
      console.log("Full response:", JSON.stringify(result, null, 2));
      
      if (result.ok && result.result.length > 0) {
        const chatId = result.result[result.result.length - 1].message?.chat?.id;
        console.log("Found Chat ID:", chatId);
        showToast(`✅ Chat ID found: ${chatId}`, "success");
        
        // Copy to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(String(chatId));
          showToast("📋 Chat ID copied to clipboard!", "info");
        }
      } else {
        console.log("No messages found. Send /start to the bot first!");
        showToast("⚠️ No messages found. Send /start to @Warehousedarshanbot first!", "warning");
      }
    } catch (error) {
      console.error("Error getting chat ID:", error);
      showToast("❌ Failed to get chat ID", "error");
    }
  };

  const sendTelegramReply = async (chatId, message) => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: parseInt(chatId),
          text: message,
        }),
      });
      const result = await response.json();
      console.log("Reply sent:", result);
      return result.ok;
    } catch (error) {
      console.error("Error sending reply:", error);
      return false;
    }
  };

  const checkTelegramMessages = async () => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateIdRef.current + 1}`;
      const response = await fetch(url);
      const result = await response.json();
      
      console.log("📨 Checking Telegram messages...", result.result?.length || 0, "new messages");
      
      if (result.ok && result.result.length > 0) {
        const updates = result.result;
        
        for (const update of updates) {
          // Update the last processed update ID
          if (update.update_id > lastUpdateIdRef.current) {
            lastUpdateIdRef.current = update.update_id;
          }
          
          const message = update.message;
          if (!message || !message.text) continue;
          
          const chatId = message.chat.id;
          const text = message.text.trim();
          
          console.log(`📩 Received message: "${text}" from chat ${chatId}`);
          console.log("📊 Current latest data:", latestDataRef.current);
          
          // Field name mapping (case-insensitive)
          const fieldMap = {
            "dispensor": "Dispenser",
            "dispenser": "Dispenser",
            "door": "Door",
            "fan": "Fan",
            "gas": "Gas",
            "humidity": "Humidity",
            "pin": "Pin",
            "temperature": "Temperature",
            "weight1": "Weight1",
            "weight2": "Weight2",
            "alert": "Alert",
          };
          
          // Helper function for icons
          const getIcon = (field) => {
            const icons = {
              Dispenser: "💧",
              Door: "🚪",
              Fan: "🌀",
              Gas: "🔥",
              Humidity: "💨",
              Pin: "🔐",
              Temperature: "🌡️",
              Weight1: "⚖️",
              Weight2: "⚖️",
              Alert: "📊",
            };
            return icons[field] || "📊";
          };
          
          // Helper function for formatting values
          const formatVal = (field, value) => {
            if (field === "Temperature") return `${value}°C`;
            if (field === "Humidity") return `${value}%`;
            if (field === "Weight1" || field === "Weight2") return `${value} kg`;
            if (field === "Door") return value === "0" ? "Closed" : "Open";
            if (field === "Fan" || field === "Dispenser") return value === "0" ? "OFF" : "ON";
            return value;
          };
          
          const fieldKey = fieldMap[text.toLowerCase()];
          
          console.log(`🔍 Searching for field: "${text}" -> ${fieldKey}`);
          
          const currentData = latestDataRef.current;
          
          if (fieldKey && currentData[fieldKey] !== undefined) {
            const value = currentData[fieldKey];
            const icon = getIcon(fieldKey);
            const formattedValue = formatVal(fieldKey, value);
            const replyMessage = `${icon} ${fieldKey}: ${formattedValue}`;
            console.log(`✅ Sending reply: ${replyMessage}`);
            await sendTelegramReply(chatId, replyMessage);
          } else if (text.toLowerCase() === "all" || text === "/start") {
            // Send all data
            const allDataMessage = `🏭 WareHouse Data

💧 Dispenser: ${formatVal("Dispenser", currentData.Dispenser || "N/A")}
🚪 Door: ${formatVal("Door", currentData.Door || "N/A")}
🌀 Fan: ${formatVal("Fan", currentData.Fan || "N/A")}
🔥 Gas: ${currentData.Gas || "N/A"}
💨 Humidity: ${formatVal("Humidity", currentData.Humidity || "N/A")}
🔐 Pin: ${currentData.Pin || "N/A"}
🌡️ Temperature: ${formatVal("Temperature", currentData.Temperature || "N/A")}
⚖️ Weight1: ${formatVal("Weight1", currentData.Weight1 || "N/A")}
⚖️ Weight2: ${formatVal("Weight2", currentData.Weight2 || "N/A")}

⏰ ${new Date().toLocaleString()}

Type field name (e.g., "Dispensor", "Gas", "Fan") to get specific value.`;
            console.log("✅ Sending all data");
            await sendTelegramReply(chatId, allDataMessage);
          } else {
            console.log(`❌ Unknown command or field not found: "${text}"`);
            await sendTelegramReply(chatId, `❓ Unknown field "${text}". Try: Dispensor, Gas, Fan, Temperature, Humidity, Door, Pin, Weight1, Weight2, or type "all" for all data.`);
          }
        }
      }
    } catch (error) {
      console.error("Error checking messages:", error);
    }
  };

  const sendTelegramMessage = async (data) => {
    try {
      console.log("=== TELEGRAM SEND START ===");
      console.log("Bot Token:", TELEGRAM_BOT_TOKEN);
      console.log("Chat ID:", TELEGRAM_CHAT_ID);
      console.log("Data to send:", data);
      
      const message = `🏭 WareHouse Data Alert

💧 Dispenser: ${data.Dispenser || "N/A"}
🚪 Door: ${data.Door || "N/A"}
🌀 Fan: ${data.Fan || "N/A"}
🔥 Gas: ${data.Gas || "N/A"}
💨 Humidity: ${data.Humidity || "N/A"}%
🔐 Pin: ${data.Pin || "N/A"}
🌡️ Temperature: ${data.Temperature || "N/A"}°C
⚖️ Weight1: ${data.Weight1 || "N/A"} kg
⚖️ Weight2: ${data.Weight2 || "N/A"} kg

⏰ Time: ${new Date().toLocaleString()}`;

      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      
      const payload = {
        chat_id: parseInt(TELEGRAM_CHAT_ID),
        text: message,
      };
      
      console.log("API URL:", url);
      console.log("Payload:", JSON.stringify(payload, null, 2));
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      console.log("Response status:", response.status);
      console.log("Response statusText:", response.statusText);
      
      const result = await response.json();
      console.log("Telegram API response:", JSON.stringify(result, null, 2));
      console.log("=== TELEGRAM SEND END ===");
      
      if (result.ok) {
        showToast("📤 Data sent to Telegram successfully!", "success");
      } else {
        console.error("❌ Telegram API error:", result);
        showToast(`❌ ${result.description || "Failed to send message"}`, "error");
      }
    } catch (error) {
      console.error("❌ Exception:", error);
      showToast(`❌ Error: ${error.message}`, "error");
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === "admin@gmail.com" && password === "admin123") {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Invalid email or password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setEmail("");
    setPassword("");
    setError("");
  };

  // Poll for Telegram messages every 3 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    
    console.log("🚀 Starting Telegram message polling...");
    
    const intervalId = setInterval(() => {
      checkTelegramMessages();
    }, 3000);

    return () => {
      console.log("🛑 Stopping Telegram message polling");
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const dbRef = ref(db, path);
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        setLatest({});
        latestDataRef.current = {};
        setSeries({});
        return;
      }

      // If the node is a list of timestamped records (object of objects)
      if (typeof val === "object" && !Array.isArray(val)) {
        const keys = Object.keys(val);
        const firstChild = val[keys[0]];
        if (typeof firstChild === "object") {
          // aggregate per field
          const fields = {};
          keys
            .slice()
            .sort()
            .forEach((k) => {
              const rec = val[k];
              const t = isNaN(Number(k)) ? k : Number(k);
              Object.entries(rec).forEach(([field, value]) => {
                if (!fields[field]) fields[field] = [];
                fields[field].push({ x: t, y: toNumber(value) ?? value });
              });
            });

          // latest values are from the last key
          const lastRec = val[keys[keys.length - 1]] || {};
          
          // Check for Dispenser value change and send to Telegram
          const currentDispenser = String(lastRec.Dispenser);
          const previousDispenser = previousDispenserRef.current;
          
          console.log("Dispenser check - Current:", currentDispenser, "Previous:", previousDispenser);
          
          // Handle Alert updates for aggregated records
          const alertRef = ref(db, "/WareHouse/Alert");
          const currentAlert = lastRec.Alert ? String(lastRec.Alert) : null;
          
          if (currentDispenser !== previousDispenser) {
            console.log(`🔄 (Aggregated) Dispenser changed: ${previousDispenser} → ${currentDispenser}`);
            
            if (currentDispenser === "1" || currentDispenser === "2") {
              console.log("✅ (Aggregated) Setting Alert=1 and sending Telegram");
              if (!telegramSentRef.current) {
                sendTelegramMessage(lastRec);
                telegramSentRef.current = true;
              }
              set(alertRef, 1).then(() => {
                showToast("🔔 Alert set to 1", "info");
              }).catch(err => {
                console.error("❌ Failed to set Alert=1 (aggregated):", err);
              });
            } else if (currentDispenser === "0") {
              console.log("✅ (Aggregated) Setting Alert=0 (Dispenser is 0)");
              telegramSentRef.current = false;
              set(alertRef, 0).then(() => {
                showToast("🔕 Alert set to 0", "info");
              }).catch(err => {
                console.error("❌ Failed to set Alert=0 (aggregated):", err);
              });
            }
            
            previousDispenserRef.current = currentDispenser;
          } else if (currentDispenser === "0" && currentAlert !== "0") {
            // Force sync when Dispenser is 0 but Alert is not 0
            console.log("🔧 (Aggregated) Force syncing Alert=0 (Dispenser is 0, Alert is", currentAlert, ")");
            set(alertRef, 0).then(() => {
              console.log("✅ Alert force-synced to 0");
            }).catch(err => {
              console.error("❌ Failed to force-sync Alert:", err);
            });
          }
          
          // Check for alerts and show toast notifications
          if (lastRec.Gas === "1" || lastRec.Gas === 1) {
            showToast("🔥 GAS LEAK DETECTED! Immediate attention required!", "error");
          }
          if (lastRec.Door === "2" || lastRec.Door === 2) {
            showToast("⚠️ Pressed Wrong Pattern!", "error");
          }
          if (lastRec.Fan === "1" || lastRec.Fan === 1) {
            showToast("🌀 Fan is ON", "success");
          }
          if (lastRec.Door === "1" || lastRec.Door === 1) {
            showToast("🚪 Door is ON", "info");
          }
          
          setLatest(lastRec);
          latestDataRef.current = lastRec;

          const seriesOut = {};
          Object.entries(fields).forEach(([f, arr]) => {
            seriesOut[f] = arr;
          });
          setSeries(seriesOut);
          return;
        }
      }

      // Otherwise treat val as a single record (flat object of fields)
      if (typeof val === "object") {
        // Check for Dispenser value change and send to Telegram
        const currentDispenser = String(val.Dispenser);
        const previousDispenser = previousDispenserRef.current;
        
        console.log("=== DISPENSER CHECK ===");
        console.log("Current Dispenser:", currentDispenser, "Type:", typeof currentDispenser);
        console.log("Previous Dispenser:", previousDispenser, "Type:", typeof previousDispenser);
        console.log("Are they different?", currentDispenser !== previousDispenser);
        
        // Sync Alert with Dispenser value
        const alertRef = ref(db, "/WareHouse/Alert");
        const currentAlert = val.Alert ? String(val.Alert) : null;
        
        if (currentDispenser !== previousDispenser) {
          console.log(`🔄 Dispenser changed: ${previousDispenser} → ${currentDispenser}`);
          
          if (currentDispenser === "1" || currentDispenser === "2") {
            console.log("✅ Setting Alert=1 and sending Telegram");
            if (!telegramSentRef.current) {
              sendTelegramMessage(val);
              telegramSentRef.current = true;
            }
            set(alertRef, 1).then(() => {
              console.log("✅ Alert set to 1");
              showToast("🔔 Alert set to 1", "info");
            }).catch((error) => {
              console.error("❌ Failed to set Alert=1:", error);
            });
          } else if (currentDispenser === "0") {
            console.log("✅ Setting Alert=0 (Dispenser is 0)");
            telegramSentRef.current = false;
            set(alertRef, 0).then(() => {
              console.log("✅ Alert set to 0");
              showToast("🔕 Alert set to 0", "info");
            }).catch((error) => {
              console.error("❌ Failed to set Alert=0:", error);
            });
          }
          
          previousDispenserRef.current = currentDispenser;
        } else if (currentDispenser === "0" && currentAlert !== "0") {
          // Force sync when Dispenser is 0 but Alert is not 0
          console.log("🔧 Force syncing Alert=0 (Dispenser is 0, Alert is", currentAlert, ")");
          set(alertRef, 0).then(() => {
            console.log("✅ Alert force-synced to 0");
          }).catch((error) => {
            console.error("❌ Failed to force-sync Alert:", error);
          });
        }
        
        // Check for alerts and show toast notifications
        if (val.Gas === "1" || val.Gas === 1) {
          showToast("🔥 GAS LEAK DETECTED! Immediate attention required!", "error");
        }
        if (val.Door === "2" || val.Door === 2) {
          showToast("⚠️ Pressed Wrong Pattern!", "error");
        }
        if (val.Fan === "1" || val.Fan === 1) {
          showToast("🌀 Fan is ON", "success");
        }
        if (val.Door === "1" || val.Door === 1) {
          showToast("🚪 Door is ON", "info");
        }
        
        setLatest(val);
        latestDataRef.current = val;
        setSeries({});
        return;
      }

      // fallback single value
      const fallbackData = { value: val };
      setLatest(fallbackData);
      latestDataRef.current = fallbackData;
      setSeries({});
    });

    return () => unsub();
  }, [path]);

  // Animated particles background effect
  useEffect(() => {
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const particles = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
      });
    }

    const animate = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 * (1 - distance / 100)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Get icon for each field
  const getFieldIcon = (field) => {
    const icons = {
      Dispenser: "💧",
      Door: "🚪",
      Fan: "🌀",
      Gas: "🔥",
      Humidity: "💨",
      Pin: "🔐",
      Temperature: "🌡️",
      Weight1: "⚖️",
      Weight2: "⚖️",
    };
    return icons[field] || "📊";
  };

  // Get status color based on field and value
  const getFieldStatus = (field, value) => {
    if (field === "Door") {
      return value === "0" ? "status-closed" : "status-open";
    }
    if (field === "Fan" || field === "Dispenser") {
      return value === "0" ? "status-off" : "status-on";
    }
    if (field === "Temperature") {
      const temp = parseFloat(value);
      if (temp > 35) return "status-high";
      if (temp < 15) return "status-low";
      return "status-normal";
    }
    if (field === "Humidity") {
      const hum = parseFloat(value);
      if (hum > 70) return "status-high";
      if (hum < 30) return "status-low";
      return "status-normal";
    }
    if (field === "Gas") {
      const gas = parseFloat(value);
      if (gas > 100) return "status-danger";
      return "status-safe";
    }
    return "status-normal";
  };

  // Format value display
  const formatValue = (field, value) => {
    if (field === "Temperature") return `${value}°C`;
    if (field === "Humidity") return `${value}%`;
    if (field === "Weight1" || field === "Weight2") return `${value} kg`;
    if (field === "Door") return value === "0" ? "Closed" : "Open";
    if (field === "Fan" || field === "Dispenser") return value === "0" ? "OFF" : "ON";
    return value;
  };

  // Build chart components for numeric series
  const chartFields = Object.keys(series).filter((f) => 
    isNumeric(series[f][0]?.y) && !["Dispenser", "Door", "Fan"].includes(f)
  );

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">🏭 WareHouse Admin</h1>
            <p className="login-subtitle">Secure Access Portal</p>
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="email" className="input-label">Email Address</label>
              <input
                type="email"
                id="email"
                className="input-field"
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="password" className="input-label">Password</label>
              <input
                type="password"
                id="password"
                className="input-field"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="login-button">
              Login to Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="warehouse-root">
      <div className="warehouse-header">
        <canvas ref={particlesCanvasRef} className="particles-canvas"></canvas>
        <div className="header-content">
          <h1 className="warehouse-title">🏭 WareHouse Monitoring System</h1>
          <p className="warehouse-subtitle">Real-time environmental and security monitoring</p>
          <div className="header-buttons">
            <button onClick={getChatId} className="get-chatid-button">
              🔍 Get Chat ID
            </button>
            <button onClick={() => sendTelegramMessage(latest)} className="test-telegram-button">
              📤 Test Telegram
            </button>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
        </div>
      </div>

      <div className="warehouse-grid">
        {Object.entries(latest).length === 0 && (
          <div className="no-data">No data found at path `{path}`</div>
        )}

        {Object.entries(latest).map(([key, value]) => (
          <div
            key={key}
            className={`warehouse-card ${getFieldStatus(key, value)}`}
            data-field={key}
          >
            <div className="card-icon">{getFieldIcon(key)}</div>
            <div className="card-content">
              <div className="card-label">{key}</div>
              {key === "Fan" ? (
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="fan-toggle"
                    className="toggle-input"
                    checked={value !== "0"}
                    readOnly
                  />
                  <label htmlFor="fan-toggle" className="toggle-label">
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-status">{value === "0" ? "OFF" : "ON"}</span>
                </div>
              ) : (
                <div className="card-value">{formatValue(key, value)}</div>
              )}
            </div>
            <div className="card-pulse"></div>
          </div>
        ))}
      </div>

      {/* Wave graphs for Temperature and Humidity */}
      <div className="wave-graphs-section">
        {latest.Temperature !== undefined && (
          <div className="wave-card">
            <h3 className="wave-title">🌡️ Temperature Wave</h3>
            <WaveGraph amplitude={Number(latest.Temperature)} color="#f59e0b" label={`${latest.Temperature}°C`} />
          </div>
        )}
        {latest.Humidity !== undefined && (
          <div className="wave-card">
            <h3 className="wave-title">💨 Humidity Wave</h3>
            <WaveGraph amplitude={Number(latest.Humidity)} color="#3b82f6" label={`${latest.Humidity}%`} />
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// WaveGraph component - displays animated sine wave based on amplitude value
function WaveGraph({ amplitude = 1, color = "#3b82f6", label = "" }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    let frame = 0;
    let anim;
    
    function draw() {
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Draw wave
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      
      const scaledAmplitude = (amplitude / 100) * (height / 3);
      
      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin((x + frame) * 0.03) * scaledAmplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Draw value label
      ctx.fillStyle = color;
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, width / 2, height / 2 - scaledAmplitude - 20);
      
      frame += 2;
      anim = requestAnimationFrame(draw);
    }
    
    draw();
    
    return () => {
      if (anim) cancelAnimationFrame(anim);
    };
  }, [amplitude, color, label]);
  
  return (
    <div className="wave-container">
      <canvas ref={canvasRef} className="wave-canvas" />
    </div>
  );
}
