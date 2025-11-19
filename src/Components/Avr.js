import React, { useState, useEffect } from 'react';
import './Avr.css';
import { databaseAVR } from '../firebaseConfig_AVR';
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

function Avr() {
  const [avrData, setAvrData] = useState({
    Any: "0",
    Line: "NONE", 
    System: "Standby",
    VIN: "0"
  });

  const [waveformData, setWaveformData] = useState({
    any: [],
    system: [],
    labels: []
  });

  useEffect(() => {
    // Listen for AVR data changes
    const avrDataRef = ref(databaseAVR, 'AVR');
    const unsubscribeAvr = onValue(avrDataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAvrData(data);
        updateWaveformData(data);
      }
    });

    return () => {
      unsubscribeAvr();
    };
  }, []);

  const updateWaveformData = (data) => {
    const time = new Date().toLocaleTimeString();
    
    setWaveformData(prev => {
      const maxPoints = 20;
      const newLabels = [...prev.labels, time].slice(-maxPoints);
      const newAny = [...prev.any, parseFloat(data.Any) || 0].slice(-maxPoints);
      const systemValue = data.System === 'Activated' ? 1 : 0;
      const newSystem = [...prev.system, systemValue].slice(-maxPoints);
      
      return {
        labels: newLabels,
        any: newAny,
        system: newSystem
      };
    });
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    animation: {
      duration: 300,
    },
  };

  const anyChartData = {
    labels: waveformData.labels,
    datasets: [
      {
        label: 'Any Value',
        data: waveformData.any,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const systemChartData = {
    labels: waveformData.labels,
    datasets: [
      {
        label: 'System Status',
        data: waveformData.system,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const formatNodeName = (line) => {
    if (line && line.includes('POLE')) {
      return line.replace('POLE', 'NODE');
    }
    return line === 'NONE' ? 'No Active NODE' : line;
  };

  const getSystemStatusIcon = () => {
    return avrData.System === 'Activated' ? '🟢' : '🔴';
  };

  const getSystemStatusColor = () => {
    return avrData.System === 'Activated' ? 'online' : 'offline';
  };

  return (
    <div className="avr-container">
      <header className="avr-header">
        <h1>AVR Monitoring System</h1>
        <div className="avr-status-indicator">
          <span className={`status-dot ${getSystemStatusColor()}`}></span>
          <span className="status-text">
            System: {avrData.System}
          </span>
          <div className="node-indicator">
            <span className="node-info">
              Active NODE: {formatNodeName(avrData.Line)}
            </span>
          </div>
        </div>
      </header>

      <main className="avr-main-content">
        {/* Live Data Cards Section */}
        <section className="avr-live-data-section">
          <h2>Live AVR Data</h2>
          <div className="avr-data-cards">
            <div className="avr-data-card any-value">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <h3>Any Value</h3>
                <div className="card-value">{avrData.Any}</div>
                <div className="card-unit">Units</div>
              </div>
            </div>
            
            <div className="avr-data-card line-status">
              <div className="card-icon">🔗</div>
              <div className="card-content">
                <h3>Active NODE</h3>
                <div className="card-value-text">{formatNodeName(avrData.Line)}</div>
                <div className="card-unit">Connection</div>
              </div>
            </div>
            
            <div className="avr-data-card system-status">
              <div className="card-icon">{getSystemStatusIcon()}</div>
              <div className="card-content">
                <h3>System Status</h3>
                <div className="card-value-text">{avrData.System}</div>
                <div className="card-unit">State</div>
              </div>
            </div>
          </div>
        </section>

        {/* Waveform Charts Section */}
        <section className="avr-charts-section">
          <h2>Real-time Waveforms</h2>
          <div className="avr-charts-grid">
            <div className="avr-chart-container">
              <h3>Any Value Waveform</h3>
              <Line data={anyChartData} options={chartOptions} />
            </div>
            
            <div className="avr-chart-container">
              <h3>System Status Waveform</h3>
              <Line data={systemChartData} options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    beginAtZero: true,
                    max: 1.2,
                    ticks: {
                      callback: function(value) {
                        return value === 1 ? 'Activated' : value === 0 ? 'Standby' : value;
                      }
                    }
                  }
                }
              }} />
            </div>
          </div>
        </section>

        {/* Node Information Section */}
        <section className="avr-node-section">
          <h2>NODE Information</h2>
          <div className="avr-node-info">
            <div className="node-details">
              <h3>Current NODE Status</h3>
              <div className="node-status-grid">
                <div className="node-item">
                  <span className="node-label">Active NODE:</span>
                  <span className="node-value">{formatNodeName(avrData.Line)}</span>
                </div>
                <div className="node-item">
                  <span className="node-label">System State:</span>
                  <span className={`node-value status-${avrData.System.toLowerCase()}`}>
                    {avrData.System}
                  </span>
                </div>
                <div className="node-item">
                  <span className="node-label">Any Parameter:</span>
                  <span className="node-value">{avrData.Any}</span>
                </div>
                <div className="node-item">
                  <span className="node-label">Last Update:</span>
                  <span className="node-value">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="avr-footer">
        <p>AVR Monitoring System © 2025 | Last Update: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}

export default Avr;