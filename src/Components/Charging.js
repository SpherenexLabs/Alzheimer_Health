import React, { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
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
import "./Charging.css";

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

// Use the firebaseConfig provided by the user (overrides any global config here)
const firebaseConfig = {
  apiKey: "AIzaSyAXHnvNZkb00PXbG5JidbD4PbRgf7l6Lgg",
  authDomain: "v2v-communication-d46c6.firebaseapp.com",
  databaseURL:
    "https://v2v-communication-d46c6-default-rtdb.firebaseio.com",
  projectId: "v2v-communication-d46c6",
  storageBucket: "v2v-communication-d46c6.firebasestorage.app",
  messagingSenderId: "536888356116",
  appId: "1:536888356116:web:983424cdcaf8efdd4e2601",
  measurementId: "G-H0YN6PE3S1",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function isNumeric(v) {
  return !isNaN(parseFloat(v)) && isFinite(v);
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export default function Charging() {
  const [latest, setLatest] = useState({});
  const [series, setSeries] = useState({});
  const [path] = useState("/charging"); // change if your data sits elsewhere
  const sineCanvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const dbRef = ref(db, path);
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        setLatest({});
        setSeries({});
        return;
      }

      // If the node is a list of timestamped records (object of objects)
      if (typeof val === "object" && !Array.isArray(val)) {
        // detect if it's a map of records (timestamp keys)
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
          setLatest(lastRec);

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
        setLatest(val);
        // no historical series available
        setSeries({});
        return;
      }

      // fallback single value
      setLatest({ value: val });
      setSeries({});
    });

    return () => unsub();
  }, [path]);

  // Animated Sine Wave Effect
  useEffect(() => {
    const canvas = sineCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    let offset = 0;
    const drawWave = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      
      ctx.clearRect(0, 0, width, height);
      
      // Draw multiple sine waves with different colors
      const waves = [
        { amplitude: 30, frequency: 0.02, speed: 0.05, color: "rgba(37, 99, 235, 0.4)", offset: 0 },
        { amplitude: 25, frequency: 0.025, speed: 0.07, color: "rgba(139, 92, 246, 0.3)", offset: Math.PI / 4 },
        { amplitude: 20, frequency: 0.03, speed: 0.04, color: "rgba(16, 185, 129, 0.3)", offset: Math.PI / 2 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = wave.color;

        for (let x = 0; x < width; x++) {
          const y = height / 2 + 
                   Math.sin(x * wave.frequency + offset * wave.speed + wave.offset) * wave.amplitude;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      offset += 1;
      animationRef.current = requestAnimationFrame(drawWave);
    };

    drawWave();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Build chart components for numeric series except 'relay'
  const chartFields = Object.keys(series).filter((f) => f.toLowerCase() !== "relay");

  return (

    <div className="charging-root">
      <div className="charging-header">
        <div className="header-content">
          <h1 className="charging-title">⚡ Charging Station Monitor</h1>
          <p className="charging-subtitle">Real-time power metrics and analytics</p>
        </div>
        <canvas ref={sineCanvasRef} className="sine-wave-canvas"></canvas>
      </div>

      <div className="cards-row">
        {Object.entries(latest).length === 0 && (
          <div className="no-data">No data found at path `{path}`</div>
        )}

        {Object.entries(latest).map(([k, v]) => (
          <div
            key={k}
            className={"value-card field-" +
              k.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase()}
            data-key={k}
          >
            <div className="card-key">{k}</div>
            <div className="card-value">{String(v)}</div>
          </div>
        ))}
      </div>

      {/* Sine wave graphs for Current and Voltage, outside the value cards */}
      <div className="charts-area">
        {latest.current !== undefined && (
          <div className="chart-card">
            <div style={{width: '100%', height: '100%'}}>
              <h3 style={{marginBottom: 8, color: '#2563eb'}}>Current Sine Wave</h3>
              <SineWaveGraph amplitude={Number(latest.current)} color="#2563eb" />
            </div>
          </div>
        )}
        {latest.voltage !== undefined && (
          <div className="chart-card">
            <div style={{width: '100%', height: '100%'}}>
              <h3 style={{marginBottom: 8, color: '#16a34a'}}>Voltage Sine Wave</h3>
              <SineWaveGraph amplitude={Number(latest.voltage)} color="#16a34a" />
            </div>
          </div>
        )}

        {chartFields.length === 0 && (
          <div className="no-charts">No historical numeric series available.</div>
        )}

        {chartFields.map((field, index) => {
          const dataPoints = series[field] || [];
          // Build chart.js dataset
          const labels = dataPoints.map((d) => (typeof d.x === "number" ? new Date(d.x).toLocaleString() : d.x));
          
          // Color schemes for different fields
          const colorSchemes = [
            { border: "rgba(37, 99, 235, 1)", bg: "rgba(37, 99, 235, 0.1)" },      // Blue
            { border: "rgba(139, 92, 246, 1)", bg: "rgba(139, 92, 246, 0.1)" },    // Purple
            { border: "rgba(16, 185, 129, 1)", bg: "rgba(16, 185, 129, 0.1)" },    // Green
            { border: "rgba(245, 158, 11, 1)", bg: "rgba(245, 158, 11, 0.1)" },    // Orange
            { border: "rgba(239, 68, 68, 1)", bg: "rgba(239, 68, 68, 0.1)" },      // Red
          ];
          const colors = colorSchemes[index % colorSchemes.length];
          
          const data = {
            labels,
            datasets: [
              {
                label: field,
                data: dataPoints.map((d) => (isNumeric(d.y) ? Number(d.y) : null)),
                fill: true,
                borderColor: colors.border,
                backgroundColor: colors.bg,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 6,
                pointBackgroundColor: colors.border,
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                borderWidth: 3,
              },
            ],
          };

          const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { 
                display: true,
                labels: {
                  font: { size: 14, weight: '600' },
                  padding: 15,
                  usePointStyle: true,
                }
              },
              title: { 
                display: true, 
                text: `${field.toUpperCase()} - Historical Data`,
                font: { size: 18, weight: 'bold' },
                padding: { top: 10, bottom: 20 },
                color: '#1e293b',
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                borderColor: colors.border,
                borderWidth: 2,
              }
            },
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: { 
                display: true,
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                  drawBorder: false,
                },
                ticks: {
                  font: { size: 11 },
                  maxRotation: 45,
                  minRotation: 0,
                }
              },
              y: { 
                display: true,
                beginAtZero: false,
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                  drawBorder: false,
                },
                ticks: {
                  font: { size: 12 },
                  padding: 10,
                }
              },
            },
          };

          return (
            <div className="chart-card" key={field}>
              <div style={{width: '100%', height: '100%'}}>
                <Line data={data} options={options} height={360} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// SineWaveGraph component - displays animated sine wave based on amplitude value
function SineWaveGraph({ amplitude = 1, color = "#2563eb" }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    let frame = 0;
    let anim;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin((x + frame) * 0.04) * amplitude * 18;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame += 2;
      anim = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(anim);
  }, [amplitude, color]);
  return (
    <div style={{ width: "100%", height: 60, marginTop: 10 }}>
      <canvas ref={canvasRef} width={180} height={60} style={{ width: "100%", height: "60px" }} />
    </div>
  );
}
