import React, { useState, useEffect } from 'react';
import { database } from '../firebaseConfig_Tangnano';
import { ref, onValue } from 'firebase/database';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Tangnano.css';

const Tangnano = () => {
  const [sensorData, setSensorData] = useState({
    DHT_Status: 'Loading...',
    Humidity_Pct: 0,
    Last_Update_ms: 0,
    Relay_On: false,
    Soil_Digital: 0,
    Soil_IsDry: false,
    Soil_IsWet: false,
    Temp_C: 0,
    pH_Raw: 0,
    pH_Value: 0
  });
  
  const [lastUpdate, setLastUpdate] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    const sensorRef = ref(database, '43_TANG_NANO_20K/1_Sensor_Data');
    
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setSensorData(data);
        setConnectionStatus('connected');
        
        // Convert timestamp to readable format
        if (data.Last_Update_ms) {
          const date = new Date(data.Last_Update_ms);
          setLastUpdate(date.toLocaleString());
        }

        // Update history data for graphs (keep last 20 readings)
        setHistoryData(prevHistory => {
          const newDataPoint = {
            time: new Date(data.Last_Update_ms).toLocaleTimeString(),
            temperature: data.Temp_C,
            humidity: data.Humidity_Pct,
            soilMoisture: data.Soil_Digital,
            pH: data.pH_Value,
            pHRaw: data.pH_Raw
          };
          const newHistory = [...prevHistory, newDataPoint];
          return newHistory.slice(-20); // Keep only last 20 data points
        });
      } else {
        setConnectionStatus('no-data');
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setConnectionStatus('error');
    });

    return () => unsubscribe();
  }, []);

  const getStatusClass = () => {
    if (connectionStatus === 'connected') return 'status-connected';
    if (connectionStatus === 'error') return 'status-error';
    return 'status-connecting';
  };

  return (
    <div className="tangnano-container">
      <header className="tangnano-header">
        <h1>🔬 Tang Nano 20K Sensor Monitor</h1>
        <div className={`connection-status ${getStatusClass()}`}>
          <span className="status-dot"></span>
          {connectionStatus === 'connected' ? 'Connected' : 
           connectionStatus === 'error' ? 'Connection Error' : 'Connecting...'}
        </div>
      </header>

      <div className="last-update">
        <span>Last Update: {lastUpdate || 'Waiting for data...'}</span>
      </div>

      <div className="cards-grid">
        {/* Temperature Card */}
        <div className="sensor-card temperature-card">
          <div className="card-icon">🌡️</div>
          <div className="card-content">
            <h3>Temperature</h3>
            <div className="card-value">{sensorData.Temp_C}°C</div>
            <div className="card-label">Current Temperature</div>
          </div>
        </div>

        {/* Humidity Card */}
        <div className="sensor-card humidity-card">
          <div className="card-icon">💧</div>
          <div className="card-content">
            <h3>Humidity</h3>
            <div className="card-value">{sensorData.Humidity_Pct}%</div>
            <div className="card-label">Relative Humidity</div>
          </div>
        </div>

        {/* DHT Status Card */}
        <div className={`sensor-card status-card ${sensorData.DHT_Status === 'ERROR' ? 'error' : 'success'}`}>
          <div className="card-icon">{sensorData.DHT_Status === 'ERROR' ? '⚠️' : '✅'}</div>
          <div className="card-content">
            <h3>DHT Sensor Status</h3>
            <div className="card-value">{sensorData.DHT_Status}</div>
            <div className="card-label">Sensor Health</div>
          </div>
        </div>

        {/* Soil Moisture Digital */}
        <div className="sensor-card soil-card">
          <div className="card-icon">🌱</div>
          <div className="card-content">
            <h3>Soil Moisture</h3>
            <div className="card-value">{sensorData.Soil_Digital}</div>
            <div className="card-label">Digital Reading</div>
          </div>
        </div>

        {/* Soil Dry/Wet Status */}
        <div className={`sensor-card soil-status-card ${sensorData.Soil_IsDry ? 'dry' : sensorData.Soil_IsWet ? 'wet' : 'normal'}`}>
          <div className="card-icon">
            {sensorData.Soil_IsDry ? '🏜️' : sensorData.Soil_IsWet ? '💦' : '🌿'}
          </div>
          <div className="card-content">
            <h3>Soil Condition</h3>
            <div className="card-value">
              {sensorData.Soil_IsDry ? 'DRY' : sensorData.Soil_IsWet ? 'WET' : 'NORMAL'}
            </div>
            <div className="card-label">
              Dry: {sensorData.Soil_IsDry ? 'Yes' : 'No'} | 
              Wet: {sensorData.Soil_IsWet ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        {/* Relay Status Card */}
        <div className={`sensor-card relay-card ${sensorData.Relay_On ? 'relay-on' : 'relay-off'}`}>
          <div className="card-icon">{sensorData.Relay_On ? '🔌' : '⭕'}</div>
          <div className="card-content">
            <h3>Relay Control</h3>
            <div className="card-value">{sensorData.Relay_On ? 'ON' : 'OFF'}</div>
            <div className="card-label">Relay Status</div>
          </div>
        </div>

        {/* pH Raw Reading */}
        <div className="sensor-card ph-raw-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>pH Raw Value</h3>
            <div className="card-value">{sensorData.pH_Raw}</div>
            <div className="card-label">Analog Reading</div>
          </div>
        </div>

        {/* pH Value Card */}
        <div className="sensor-card ph-card">
          <div className="card-icon">🧪</div>
          <div className="card-content">
            <h3>pH Level</h3>
            <div className="card-value">{sensorData.pH_Value}</div>
            <div className="card-label">
              {sensorData.pH_Value < 7 ? 'Acidic' : 
               sensorData.pH_Value > 7 ? 'Alkaline' : 'Neutral'}
            </div>
          </div>
        </div>
      </div>

      {/* Graphs Section */}
      <div className="graphs-section">
        <h2 className="graphs-title">📈 Real-time Analytics</h2>
        
        {/* Temperature & Humidity Chart */}
        <div className="chart-container">
          <h3>Temperature & Humidity Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#ff6b6b" strokeWidth={2} name="Temperature (°C)" />
              <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#4ecdc4" strokeWidth={2} name="Humidity (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Soil Moisture Chart */}
        <div className="chart-container">
          <h3>Soil Moisture Level</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="soilMoisture" stroke="#95e1d3" fill="#95e1d3" name="Soil Moisture" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* pH Level Chart */}
        <div className="chart-container">
          <h3>pH Level Monitoring</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 14]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pH" stroke="#a29bfe" strokeWidth={2} name="pH Value" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* pH Raw Reading Chart */}
        <div className="chart-container">
          <h3>pH Raw Sensor Reading</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pHRaw" fill="#fd79a8" name="pH Raw Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <footer className="tangnano-footer">
        <p>Tang Nano 20K Real-time Monitoring System</p>
      </footer>
    </div>
  );
};

export default Tangnano;
