import React, { useState, useEffect } from 'react';
import './Neural_power.css';
import { database } from '../firebaseConfig';
import { ref, onValue } from 'firebase/database';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function Neural_Power() {
  const [liveData, setLiveData] = useState({
    current_a: 0,
    distribution_on: 0,
    power_w: 0,
    voltage_v: 0,
    ts: 0
  });
  const [historyData, setHistoryData] = useState([]);
  const [sineWaveData, setSineWaveData] = useState({
    current: [],
    voltage: [],
    power: [],
    labels: []
  });
  
  // New state for advanced features
  const [harmonicData, setHarmonicData] = useState({
    harmonics: [
      { order: 1, amplitude: 0.95, phase: 0, thd: 1.2 },
      { order: 3, amplitude: 0.15, phase: 45, thd: 2.1 },
      { order: 5, amplitude: 0.08, phase: 90, thd: 3.5 },
      { order: 7, amplitude: 0.05, phase: 135, thd: 1.8 },
      { order: 9, amplitude: 0.03, phase: 180, thd: 0.9 },
    ],
    totalTHD: 2.8
  });
  
  const [mlPredictions, setMlPredictions] = useState({
    compensationLevel: 85.7,
    responseDelay: 12.3,
    nextAnomaly: '2025-10-31 16:45:00',
    confidence: 92.1
  });
  
  const [thdHistory, setThdHistory] = useState([
    // Initialize with some sample historical data
    { time: '14:45:10', thd: 2.1, anomaly: false, isLive: false, timestamp: Date.now() - 900000 },
    { time: '14:46:15', thd: 2.8, anomaly: false, isLive: false, timestamp: Date.now() - 840000 },
    { time: '14:47:20', thd: 3.2, anomaly: false, isLive: false, timestamp: Date.now() - 780000 },
    { time: '14:48:25', thd: 4.1, anomaly: false, isLive: false, timestamp: Date.now() - 720000 },
    { time: '14:49:30', thd: 5.8, anomaly: true, isLive: false, timestamp: Date.now() - 660000 },
    { time: '14:50:35', thd: 3.9, anomaly: false, isLive: false, timestamp: Date.now() - 600000 },
    { time: '14:51:40', thd: 2.7, anomaly: false, isLive: false, timestamp: Date.now() - 540000 },
    { time: '14:52:45', thd: 3.5, anomaly: false, isLive: false, timestamp: Date.now() - 480000 },
    { time: '14:53:50', thd: 4.8, anomaly: false, isLive: false, timestamp: Date.now() - 420000 },
    { time: '14:54:55', thd: 6.2, anomaly: true, isLive: false, timestamp: Date.now() - 360000 },
  ]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // Listen for live data changes
    const liveDataRef = ref(database, '30_KS5306_Neural_Power/live');
    const unsubscribeLive = onValue(liveDataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLiveData(data);
        updateSineWaveData(data);
        updateHarmonicData(data);
        updateMlPredictions(data);
        updateThdHistory(data);
        checkAlerts(data);
      }
    });

    // Listen for history data changes
    const historyRef = ref(database, '30_KS5306_Neural_Power/history');
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const historyArray = Object.entries(data)
          .map(([key, value]) => ({ id: key, ...value }))
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 5);
        setHistoryData(historyArray);
      }
    });

    // Simulate real-time harmonic updates
    const harmonicInterval = setInterval(() => {
      simulateHarmonicChanges();
    }, 3000);

    return () => {
      unsubscribeLive();
      unsubscribeHistory();
      clearInterval(harmonicInterval);
    };
  }, []);

  const updateSineWaveData = (data) => {
    const time = new Date().toLocaleTimeString();
    
    setSineWaveData(prev => {
      const maxPoints = 20;
      const newLabels = [...prev.labels, time].slice(-maxPoints);
      const newCurrent = [...prev.current, data.current_a].slice(-maxPoints);
      const newVoltage = [...prev.voltage, data.voltage_v].slice(-maxPoints);
      const newPower = [...prev.power, data.power_w].slice(-maxPoints);
      
      return {
        labels: newLabels,
        current: newCurrent,
        voltage: newVoltage,
        power: newPower
      };
    });
  };

  const updateHarmonicData = (data) => {
    // Simulate harmonic analysis based on live data
    const baseAmplitude = data.current_a || 0.5;
    const newHarmonics = harmonicData.harmonics.map(harmonic => ({
      ...harmonic,
      amplitude: baseAmplitude * (Math.random() * 0.3 + 0.1) / harmonic.order,
      thd: Math.random() * 5 + 0.5
    }));
    
    const totalTHD = Math.sqrt(newHarmonics.slice(1).reduce((sum, h) => sum + h.amplitude * h.amplitude, 0)) / newHarmonics[0].amplitude * 100;
    
    setHarmonicData({
      harmonics: newHarmonics,
      totalTHD
    });
  };

  const updateMlPredictions = (data) => {
    // Simulate ML predictions based on current data
    setMlPredictions(prev => ({
      compensationLevel: 80 + Math.random() * 20,
      responseDelay: 10 + Math.random() * 10,
      nextAnomaly: new Date(Date.now() + Math.random() * 3600000).toLocaleString(),
      confidence: 85 + Math.random() * 15
    }));
  };

  const updateThdHistory = (data) => {
    const time = new Date().toLocaleTimeString();
    const currentTHD = harmonicData.totalTHD;
    
    setThdHistory(prev => {
      const maxPoints = 50; // Increased to show more historical data
      const newEntry = { 
        time, 
        thd: currentTHD, 
        anomaly: currentTHD > 5,
        isLive: true,
        timestamp: Date.now()
      };
      
      // Mark previous entries as not live
      const updatedHistory = prev.map(entry => ({ ...entry, isLive: false }));
      
      return [...updatedHistory, newEntry].slice(-maxPoints);
    });
  };

  const checkAlerts = (data) => {
    const newAlerts = [];
    const currentTime = new Date().toLocaleString();
    
    // Check for overload
    if (data.power_w > 0.005) {
      newAlerts.push({
        id: Date.now() + 1,
        type: 'overload',
        message: 'Power overload detected',
        severity: 'high',
        timestamp: currentTime
      });
    }
    
    // Check for unbalanced load
    if (Math.abs(data.current_a - data.voltage_v) > 0.1) {
      newAlerts.push({
        id: Date.now() + 2,
        type: 'unbalanced',
        message: 'Unbalanced load detected',
        severity: 'medium',
        timestamp: currentTime
      });
    }
    
    // Check for high THD
    if (harmonicData.totalTHD > 5) {
      newAlerts.push({
        id: Date.now() + 3,
        type: 'thd',
        message: `High THD detected: ${harmonicData.totalTHD.toFixed(2)}%`,
        severity: 'high',
        timestamp: currentTime
      });
    }
    
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
    }
  };

  const simulateHarmonicChanges = () => {
    setHarmonicData(prev => ({
      ...prev,
      harmonics: prev.harmonics.map(harmonic => ({
        ...harmonic,
        amplitude: harmonic.amplitude * (0.9 + Math.random() * 0.2),
        thd: Math.max(0.1, harmonic.thd + (Math.random() - 0.5) * 0.5)
      }))
    }));
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

  const currentChartData = {
    labels: sineWaveData.labels,
    datasets: [
      {
        label: 'Current (A)',
        data: sineWaveData.current,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const voltageChartData = {
    labels: sineWaveData.labels,
    datasets: [
      {
        label: 'Voltage (V)',
        data: sineWaveData.voltage,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const powerChartData = {
    labels: sineWaveData.labels,
    datasets: [
      {
        label: 'Power (W)',
        data: sineWaveData.power,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
      },
    ],
  };

  // Harmonic Analysis Chart Data
  const harmonicChartData = {
    labels: harmonicData.harmonics.map(h => `${h.order}th`),
    datasets: [
      {
        label: 'Amplitude',
        data: harmonicData.harmonics.map(h => h.amplitude),
        backgroundColor: harmonicData.harmonics.map(h => 
          h.thd < 2 ? 'rgba(46, 204, 113, 0.8)' : 
          h.thd > 4 ? 'rgba(231, 76, 60, 0.8)' : 
          'rgba(241, 196, 15, 0.8)'
        ),
        borderColor: harmonicData.harmonics.map(h => 
          h.thd < 2 ? 'rgb(46, 204, 113)' : 
          h.thd > 4 ? 'rgb(231, 76, 60)' : 
          'rgb(241, 196, 15)'
        ),
        borderWidth: 2,
      },
    ],
  };

  // THD History Chart Data
  const thdHistoryChartData = {
    labels: thdHistory.map(item => item.time),
    datasets: [
      {
        label: 'THD (%)',
        data: thdHistory.map(item => item.thd),
        borderColor: 'rgb(155, 89, 182)',
        backgroundColor: 'rgba(155, 89, 182, 0.2)',
        pointBackgroundColor: thdHistory.map(item => {
          if (item.isLive) return 'rgb(46, 204, 113)'; // Green for live data
          if (item.anomaly) return 'rgb(231, 76, 60)'; // Red for anomalies
          return 'rgb(155, 89, 182)'; // Purple for normal historical data
        }),
        pointBorderColor: thdHistory.map(item => {
          if (item.isLive) return 'rgb(39, 174, 96)';
          if (item.anomaly) return 'rgb(192, 57, 43)';
          return 'rgb(142, 68, 173)';
        }),
        pointRadius: thdHistory.map(item => {
          if (item.isLive) return 8; // Larger for live data
          if (item.anomaly) return 6; // Medium for anomalies
          return 3; // Small for normal data
        }),
        pointBorderWidth: thdHistory.map(item => item.isLive ? 3 : 2),
        tension: 0.4,
      },
      {
        label: 'THD Threshold (5%)',
        data: Array(thdHistory.length).fill(5),
        borderColor: 'rgb(231, 76, 60)',
        borderDash: [5, 5],
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getBestHarmonic = () => {
    return harmonicData.harmonics.reduce((best, current) => 
      current.thd < best.thd ? current : best
    );
  };

  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Neural Power Monitoring System</h1>
        <div className="status-indicator">
          <span className={`status-dot ${liveData.distribution_on ? 'online' : 'offline'}`}></span>
          <span className="status-text">
            {liveData.distribution_on ? 'Distribution ON' : 'Distribution OFF'}
          </span>
          <div className="thd-indicator">
            <span className={`thd-badge ${harmonicData.totalTHD > 5 ? 'high' : 'normal'}`}>
              THD: {harmonicData.totalTHD.toFixed(2)}%
            </span>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Alerts Section */}
        {alerts.length > 0 && (
          <section className="alerts-section">
            <div className="alerts-container">
              {alerts.slice(0, 3).map(alert => (
                <div key={alert.id} className={`alert alert-${alert.severity}`}>
                  <div className="alert-content">
                    <span className="alert-icon">
                      {alert.type === 'overload' ? '⚠️' : 
                       alert.type === 'unbalanced' ? '⚖️' : '📊'}
                    </span>
                    <div className="alert-text">
                      <div className="alert-message">{alert.message}</div>
                      <div className="alert-time">{alert.timestamp}</div>
                    </div>
                  </div>
                  <button 
                    className="alert-dismiss"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Live Data Cards Section */}
        <section className="live-data-section">
          <h2>Live Data</h2>
          <div className="data-cards">
            <div className="data-card current">
              <div className="card-icon">⚡</div>
              <div className="card-content">
                <h3>Current</h3>
                <div className="card-value">{liveData.current_a.toFixed(4)}</div>
                <div className="card-unit">Amperes</div>
              </div>
            </div>
            
            <div className="data-card voltage">
              <div className="card-icon">🔋</div>
              <div className="card-content">
                <h3>Voltage</h3>
                <div className="card-value">{liveData.voltage_v.toFixed(4)}</div>
                <div className="card-unit">Volts</div>
              </div>
            </div>
            
            <div className="data-card power">
              <div className="card-icon">⚙️</div>
              <div className="card-content">
                <h3>Power</h3>
                <div className="card-value">{liveData.power_w.toFixed(4)}</div>
                <div className="card-unit">Watts</div>
              </div>
            </div>
            
            <div className="data-card distribution">
              <div className="card-icon">🔌</div>
              <div className="card-content">
                <h3>Distribution</h3>
                <div className="card-value">{liveData.distribution_on}</div>
                <div className="card-unit">Status</div>
              </div>
            </div>
          </div>
        </section>

        {/* Harmonic Analysis Panel */}
        <section className="harmonic-section">
          <h2>Harmonic Analysis</h2>
          <div className="harmonic-panel">
            <div className="harmonic-overview">
              <div className="harmonic-card">
                <h3>Total THD</h3>
                <div className={`thd-value ${harmonicData.totalTHD > 5 ? 'high' : 'normal'}`}>
                  {harmonicData.totalTHD.toFixed(2)}%
                </div>
              </div>
              <div className="harmonic-card">
                <h3>Best Harmonic</h3>
                <div className="best-harmonic">
                  <span className="harmonic-order">{getBestHarmonic().order}th</span>
                  <span className="noise-indicator green">Low Noise</span>
                </div>
              </div>
            </div>
            <div className="harmonic-chart">
              <h3>Harmonic Spectrum</h3>
              <Bar data={harmonicChartData} options={chartOptions} />
            </div>
          </div>
        </section>

        {/* ML Predictions Section */}
        <section className="ml-section">
          <h2>ML Predictions</h2>
          <div className="ml-cards">
            <div className="ml-card">
              <div className="ml-icon">🤖</div>
              <div className="ml-content">
                <h3>Compensation Level</h3>
                <div className="ml-value">{mlPredictions.compensationLevel.toFixed(1)}%</div>
                <div className="ml-confidence">Confidence: {mlPredictions.confidence.toFixed(1)}%</div>
              </div>
            </div>
            <div className="ml-card">
              <div className="ml-icon">⏱️</div>
              <div className="ml-content">
                <h3>Response Delay</h3>
                <div className="ml-value">{mlPredictions.responseDelay.toFixed(1)}ms</div>
                <div className="ml-confidence">Predicted</div>
              </div>
            </div>
            <div className="ml-card">
              <div className="ml-icon">🔮</div>
              <div className="ml-content">
                <h3>Next Anomaly</h3>
                <div className="ml-value-small">{mlPredictions.nextAnomaly}</div>
                <div className="ml-confidence">Forecast</div>
              </div>
            </div>
          </div>
        </section>

        {/* THD Historical Trends */}
        <section className="thd-history-section">
          <h2>THD Historical Trends</h2>
          <div className="thd-chart-container compact">
            <div className="thd-legend">
              <div className="legend-item">
                <span className="legend-dot live"></span>
                <span>Live Data</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot anomaly"></span>
                <span>Anomaly (&gt;5%)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot normal"></span>
                <span>Historical</span>
              </div>
            </div>
            <Line data={thdHistoryChartData} options={{
              ...chartOptions,
              maintainAspectRatio: false,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  display: true,
                  text: 'THD Trends with Real-time Monitoring & Anomaly Detection',
                  font: {
                    size: 14,
                    weight: 'bold'
                  }
                },
                legend: {
                  display: true,
                  position: 'bottom',
                  labels: {
                    boxWidth: 12,
                    padding: 15
                  }
                }
              },
              scales: {
                ...chartOptions.scales,
                x: {
                  display: true,
                  title: {
                    display: true,
                    text: 'Time'
                  },
                  ticks: {
                    maxTicksLimit: 10
                  }
                },
                y: {
                  beginAtZero: true,
                  max: Math.max(8, Math.max(...thdHistory.map(item => item.thd)) + 1),
                  title: {
                    display: true,
                    text: 'THD (%)'
                  }
                }
              }
            }} height={200} />
          </div>
        </section>

        {/* Sine Wave Charts Section */}
        <section className="charts-section">
          <h2>Real-time Waveforms</h2>
          <div className="charts-grid">
            <div className="chart-container">
              <h3>Current Waveform</h3>
              <Line data={currentChartData} options={chartOptions} />
            </div>
            
            <div className="chart-container">
              <h3>Voltage Waveform</h3>
              <Line data={voltageChartData} options={chartOptions} />
            </div>
            
            <div className="chart-container">
              <h3>Power Waveform</h3>
              <Line data={powerChartData} options={chartOptions} />
            </div>
          </div>
        </section>

        {/* History Section */}
        <section className="history-section">
          <h2>Recent History (Last 5 Records)</h2>
          <div className="history-table">
            <div className="table-header">
              <div>Timestamp</div>
              <div>Current (A)</div>
              <div>Voltage (V)</div>
              <div>Power (W)</div>
              <div>Distribution</div>
            </div>
            {historyData.map((record, index) => (
              <div key={record.id} className="table-row">
                <div>{formatTimestamp(record.ts)}</div>
                <div>{record.current_a?.toFixed(4) || 'N/A'}</div>
                <div>{record.voltage_v?.toFixed(4) || 'N/A'}</div>
                <div>{record.power_w?.toFixed(4) || 'N/A'}</div>
                <div>
                  <span className={`status-badge ${record.distribution_on ? 'on' : 'off'}`}>
                    {record.distribution_on ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>Neural Power Monitoring © 2025 | Last Update: {formatTimestamp(liveData.ts)}</p>
      </footer>
    </div>
  );
}

export default Neural_Power;
