import React, { useState, useEffect } from 'react';
import './Solar_Power.css';
import { databaseSolar } from '../firebaseConfig_Solar';
import { ref, onValue } from 'firebase/database';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function Solar_Power() {
  const [hybridData, setHybridData] = useState({
    Battery_Percent: 0,
    Car_Current: 0,
    Car_Voltage: 0,
    Wired: 0,
    Wired_Voltage: 0,
    Wireless: 0,
    Wireless_Voltage: 0
  });

  const [waveformData, setWaveformData] = useState({
    batteryPercent: [],
    carCurrent: [],
    carVoltage: [],
    wiredVoltage: [],
    wirelessVoltage: [],
    labels: []
  });

  // Map special wireless voltage encoding: if backend sends 2, display as 220 V
  const normalizeWirelessVoltage = (val) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n === 2) return 220;
    return isNaN(n) ? 0 : n;
  };

  useEffect(() => {
    // Listen for Hybrid_Power data changes
    const hybridRef = ref(databaseSolar, 'Hybrid_Power');
    
  // Also listen to Wired_Voltage separately (handle both spellings)
  const wiredVoltageRef = ref(databaseSolar, 'Hybrid_Power/Wired_Voltage');
  const wiredVolatgeRef = ref(databaseSolar, 'Hybrid_Power/Wired_Volatge');
    
    const unsubscribe = onValue(hybridRef, (snapshot) => {
      const data = snapshot.val() || {};
      console.log('Raw Firebase Data:', data); // Debug log

      // Merge with previous state so missing fields don't reset to 0 (especially Wired_Voltage)
      let mergedState;
      setHybridData(prev => {
        const toFloat = (v, fb) => (v === undefined || v === null || v === '') ? fb : parseFloat(v);
        const toInt = (v, fb) => (v === undefined || v === null || v === '') ? fb : parseInt(v);

        mergedState = {
          Battery_Percent: toFloat(data.Battery_Percent, prev.Battery_Percent || 0),
          Car_Current: toFloat(data.Car_Current, prev.Car_Current || 0),
          Car_Voltage: toFloat(data.Car_Voltage, prev.Car_Voltage || 0),
          Wired: (data.Wired !== undefined) ? toInt(data.Wired, prev.Wired || 0) : prev.Wired,
          // Keep existing Wired_Voltage if snapshot doesn't contain it (supports misspelling 'Wired_Volatge')
          Wired_Voltage: (() => {
            const wiredRaw = (data.Wired_Voltage !== undefined) ? data.Wired_Voltage
                              : (data.Wired_Volatge !== undefined ? data.Wired_Volatge : undefined);
            return (wiredRaw !== undefined)
              ? toFloat(wiredRaw, prev.Wired_Voltage || 0)
              : prev.Wired_Voltage;
          })(),
          Wireless: (data.Wireless !== undefined) ? toInt(data.Wireless, prev.Wireless || 0) : prev.Wireless,
          Wireless_Voltage: (data.Wireless_Voltage !== undefined)
            ? normalizeWirelessVoltage(data.Wireless_Voltage)
            : prev.Wireless_Voltage
        };
        console.log('Merged State:', mergedState);
        return mergedState;
      });

      if (mergedState) {
        updateWaveformData(mergedState);
      }
    });
    
    // Listen specifically to Wired_Voltage in case it's nested
    const unsubscribeWired = onValue(wiredVoltageRef, (snapshot) => {
      const wiredVoltageData = snapshot.val();
      console.log('Direct Wired_Voltage data:', wiredVoltageData);
      if (wiredVoltageData !== null) {
        setHybridData(prev => ({
          ...prev,
          Wired_Voltage: parseFloat(wiredVoltageData.Wired_Voltage || wiredVoltageData) || 0
        }));
      }
    });

    // Listen to alternate misspelling 'Wired_Volatge'
    const unsubscribeWiredAlt = onValue(wiredVolatgeRef, (snapshot) => {
      const wiredVoltageData = snapshot.val();
      console.log('Direct Wired_Volatge data:', wiredVoltageData);
      if (wiredVoltageData !== null) {
        setHybridData(prev => ({
          ...prev,
          Wired_Voltage: parseFloat(wiredVoltageData.Wired_Volatge || wiredVoltageData) || 0
        }));
      }
    });

    return () => {
      unsubscribe();
      unsubscribeWired();
      unsubscribeWiredAlt();
    };
  }, []);

  const updateWaveformData = (data) => {
    const time = new Date().toLocaleTimeString();
    
    setWaveformData(prev => {
      const maxPoints = 20;
      const newLabels = [...prev.labels, time].slice(-maxPoints);
      const newBatteryPercent = [...prev.batteryPercent, parseFloat(data.Battery_Percent) || 0].slice(-maxPoints);
      const newCarCurrent = [...prev.carCurrent, parseFloat(data.Car_Current) || 0].slice(-maxPoints);
      const newCarVoltage = [...prev.carVoltage, parseFloat(data.Car_Voltage) || 0].slice(-maxPoints);
      const newWiredVoltage = [...prev.wiredVoltage, parseFloat(data.Wired_Voltage) || 0].slice(-maxPoints);
  const newWirelessVoltage = [...prev.wirelessVoltage, normalizeWirelessVoltage(data.Wireless_Voltage)].slice(-maxPoints);
      
      return {
        labels: newLabels,
        batteryPercent: newBatteryPercent,
        carCurrent: newCarCurrent,
        carVoltage: newCarVoltage,
        wiredVoltage: newWiredVoltage,
        wirelessVoltage: newWirelessVoltage
      };
    });
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
      x: {
        ticks: {
          maxTicksLimit: 6
        }
      }
    },
    animation: {
      duration: 300,
    },
  };

  const createChartData = (data, label, color) => ({
    labels: waveformData.labels,
    datasets: [
      {
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: `${color}20`,
        tension: 0.4,
        fill: true,
      },
    ],
  });

  return (
    <div className="solar-power-container">
      <header className="solar-header">
        <h1>🔋 Solar Power Monitoring System</h1>
        <div className="system-status">
          <span className="status-dot active"></span>
          <span>System Active</span>
        </div>
      </header>

      <main className="solar-main">
        {/* Data Cards Section */}
        <section className="data-section">
          <h2>Live System Data</h2>
          <div className="solar-cards">
            {/* Battery Percent Card */}
            <div className="solar-card battery-card">
              <div className="card-header">
                <span className="card-icon">🔋</span>
                <h3>Battery Level</h3>
              </div>
              <div className="card-value">{hybridData.Battery_Percent}%</div>
              <div className="card-subtitle">State of Charge</div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${hybridData.Battery_Percent}%` }}
                ></div>
              </div>
            </div>

            {/* Car Current Card */}
            <div className="solar-card current-card">
              <div className="card-header">
                <span className="card-icon">⚡</span>
                <h3>Car Current</h3>
              </div>
              <div className="card-value">{hybridData.Car_Current}</div>
              <div className="card-subtitle">Amperes (A)</div>
            </div>

            {/* Car Voltage Card */}
            <div className="solar-card voltage-card">
              <div className="card-header">
                <span className="card-icon">🔌</span>
                <h3>Car Voltage</h3>
              </div>
              <div className="card-value">{hybridData.Car_Voltage.toFixed(5)}</div>
              <div className="card-subtitle">Volts (V)</div>
            </div>

            {/* Wired Status Card */}
            <div className="solar-card wired-card">
              <div className="card-header">
                <span className="card-icon">🔗</span>
                <h3>Wired Connection</h3>
              </div>
              <div className="card-value status-value">
                {hybridData.Wired === 1 ? 'Active' : 'Inactive'}
              </div>
              <div className="card-subtitle">Status: {hybridData.Wired}</div>
            </div>

            {/* Wired Voltage Card */}
            <div className="solar-card wired-voltage-card">
              <div className="card-header">
                <span className="card-icon">📊</span>
                <h3>Solar Voltage</h3>
              </div>
              <div className="card-value">{parseFloat(hybridData.Wired_Voltage || 0).toFixed(2)}</div>
              <div className="card-subtitle">Volts (V)</div>
            </div>

            {/* Wireless Status Card */}
            <div className="solar-card wireless-card">
              <div className="card-header">
                <span className="card-icon">📡</span>
                <h3>Wireless Connection</h3>
              </div>
              <div className="card-value status-value">
                {hybridData.Wireless === 1 ? 'Active' : 'Inactive'}
              </div>
              <div className="card-subtitle">Status: {hybridData.Wireless}</div>
            </div>

            {/* Wireless Voltage Card */}
            <div className="solar-card wireless-voltage-card">
              <div className="card-header">
                <span className="card-icon">📈</span>
                <h3>Wireless Voltage</h3>
              </div>
              <div className="card-value">{normalizeWirelessVoltage(hybridData.Wireless_Voltage).toFixed(2)}</div>
              <div className="card-subtitle">Volts (V)</div>
            </div>
          </div>
        </section>

        {/* Waveform Charts Section */}
        <section className="waveform-section">
          <h2>Real-time Waveforms</h2>
          <div className="waveform-grid">
            {/* Battery Percent Waveform */}
            <div className="waveform-card battery-wave">
              <h3>Battery Level Trend</h3>
              <div className="chart-wrapper">
                <Line 
                  data={createChartData(
                    waveformData.batteryPercent, 
                    'Battery %', 
                    'rgb(52, 211, 153)'
                  )} 
                  options={chartOptions} 
                />
              </div>
            </div>

            {/* Car Current Waveform */}
            <div className="waveform-card current-wave">
              <h3>Car Current Waveform</h3>
              <div className="chart-wrapper">
                <Line 
                  data={createChartData(
                    waveformData.carCurrent, 
                    'Car Current (A)', 
                    'rgb(251, 146, 60)'
                  )} 
                  options={chartOptions} 
                />
              </div>
            </div>

            {/* Car Voltage Waveform */}
            <div className="waveform-card voltage-wave">
              <h3>Car Voltage Waveform</h3>
              <div className="chart-wrapper">
                <Line 
                  data={createChartData(
                    waveformData.carVoltage, 
                    'Car Voltage (V)', 
                    'rgb(59, 130, 246)'
                  )} 
                  options={chartOptions} 
                />
              </div>
            </div>

            {/* Wired Voltage Waveform */}
            <div className="waveform-card wired-wave">
              <h3>Solar Voltage Waveform</h3>
              <div className="chart-wrapper">
                <Line 
                  data={createChartData(
                    waveformData.wiredVoltage, 
                    'Wired Voltage (V)', 
                    'rgb(168, 85, 247)'
                  )} 
                  options={chartOptions} 
                />
              </div>
            </div>

            {/* Wireless Voltage Waveform */}
            <div className="waveform-card wireless-wave">
              <h3>Wireless Voltage Waveform</h3>
              <div className="chart-wrapper">
                <Line 
                  data={createChartData(
                    waveformData.wirelessVoltage, 
                    'Wireless Voltage (V)', 
                    'rgb(236, 72, 153)'
                  )} 
                  options={chartOptions} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Summary Section */}
        <section className="summary-section">
          <h2>System Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Wired Status:</span>
              <span className={`summary-value ${hybridData.Wired === 1 ? 'active' : 'inactive'}`}>
                {hybridData.Wired === 1 ? '✓ Connected' : '✗ Disconnected'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Wireless Status:</span>
              <span className={`summary-value ${hybridData.Wireless === 1 ? 'active' : 'inactive'}`}>
                {hybridData.Wireless === 1 ? '✓ Connected' : '✗ Disconnected'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Power Sources:</span>
              <span className="summary-value">
                {(hybridData.Wired === 1 ? 1 : 0) + (hybridData.Wireless === 1 ? 1 : 0)} Active
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Battery Health:</span>
              <span className="summary-value">
                {hybridData.Battery_Percent > 80 ? '🟢 Excellent' : 
                 hybridData.Battery_Percent > 50 ? '🟡 Good' : 
                 hybridData.Battery_Percent > 20 ? '🟠 Low' : '🔴 Critical'}
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="solar-footer">
        <p>Hybrid Power Monitoring System © 2025 | Real-time Data Visualization</p>
      </footer>
    </div>
  );
}

export default Solar_Power;
