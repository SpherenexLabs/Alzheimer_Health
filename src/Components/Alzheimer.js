import React, { useState, useEffect } from 'react';
import { database } from '../firebaseConfig';
import { ref, onValue } from 'firebase/database';
import './Alzheimer.css';

const Alzheimer = () => {
  const [sensorData, setSensorData] = useState({
    hr: 0,
    spo2: 0,
    bp: "0/0",
    angle: 0,
    accel: 0,
    eng: 0,
    temp: 0,
    hum: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);

  const GOOGLE_MAPS_API_KEY = 'AIzaSyA5ReIwel6soo1uIWWRvAIdIubZQKnbjfc';

  // Alzheimer's Disease Detection Thresholds
  const ALZHEIMER_THRESHOLDS = {
    hr: { min: 55, max: 90, weight: 0.15 }, // Lower heart rate variability
    spo2: { min: 92, max: 96, weight: 0.20 }, // Reduced oxygen saturation
    temp: { min: 36.0, max: 36.8, weight: 0.10 }, // Lower body temperature
    angle: { min: 0.05, max: 0.15, weight: 0.15 }, // Balance issues
    accel: { min: 0.6, max: 0.9, weight: 0.15 }, // Reduced movement coordination
    eng: { min: 3, max: 7, weight: 0.15 }, // Lower energy levels
    hum: { min: 50, max: 70, weight: 0.10 } // Environmental factor
  };

  useEffect(() => {
    // Reference to the sensor data path
    const sensorRef = ref(database, '48_KS5282_Soldier_ECG/1_Sensor_Data');

    // Listen for real-time updates
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setSensorData({
          hr: data['1_HR'] || 0,
          spo2: data['2_SPO2'] || 0,
          bp: data['3_BP'] || "0/0",
          angle: data['4_Angle'] || 0,
          accel: data['5_Accel'] || 0,
          eng: data['6_ENG'] || 0,
          temp: data['7_Temp'] || 0,
          hum: data['8_Hum'] || 0
        });
        setLastUpdate(new Date().toLocaleTimeString());
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching data:", error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Track patient location in real-time
  useEffect(() => {
    if ('geolocation' in navigator) {
      // Get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toLocaleTimeString()
          };
          setLocation(newLocation);
          setLocationError(null);
          console.log('Location acquired:', newLocation);
        },
        (error) => {
          console.error('Location error:', error);
          let errorMessage = 'Unable to retrieve location';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please check your GPS/network connection.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = error.message;
          }
          setLocationError(errorMessage);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Watch position continuously
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toLocaleTimeString()
          };
          setLocation(newLocation);
          setLocationError(null);
          console.log('Location updated:', newLocation);
        },
        (error) => {
          console.error('Location watch error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      setWatchId(id);

      // Cleanup
      return () => {
        if (id) {
          navigator.geolocation.clearWatch(id);
        }
      };
    } else {
      setLocationError('Geolocation is not supported by your browser. Please use a modern browser like Chrome, Firefox, or Safari.');
    }
  }, []);

  // Initialize Google Map when location is available
  useEffect(() => {
    if (location && window.google && window.google.maps) {
      const mapElement = document.getElementById('patient-location-map');
      if (mapElement && !map) {
        const newMap = new window.google.maps.Map(mapElement, {
          center: { lat: location.latitude, lng: location.longitude },
          zoom: 17,
          mapTypeId: 'roadmap',
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: true,
          fullscreenControl: true
        });

        const newMarker = new window.google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: newMap,
          title: 'Patient Location',
          animation: window.google.maps.Animation.DROP,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding: 10px;">
            <h3 style="margin: 0 0 5px 0; color: #667eea;">Patient Location</h3>
            <p style="margin: 0; font-size: 12px;">
              <strong>Coordinates:</strong><br/>
              ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}<br/>
              <strong>Accuracy:</strong> ${location.accuracy.toFixed(0)}m
            </p>
          </div>`
        });

        newMarker.addListener('click', () => {
          infoWindow.open(newMap, newMarker);
        });

        setMap(newMap);
        setMarker(newMarker);
      } else if (map && marker) {
        // Update existing marker position
        const newPosition = { lat: location.latitude, lng: location.longitude };
        marker.setPosition(newPosition);
        map.panTo(newPosition);
      }
    }
  }, [location, map, marker]);

  const getStatusColor = (type, value) => {
    switch(type) {
      case 'hr':
        if (value < 60) return 'status-low';
        if (value > 100) return 'status-high';
        return 'status-normal';
      case 'spo2':
        if (value < 95) return 'status-low';
        return 'status-normal';
      case 'temp':
        if (value < 36) return 'status-low';
        if (value > 37.5) return 'status-high';
        return 'status-normal';
      default:
        return 'status-normal';
    }
  };

  // Check for Alzheimer's Disease
  const checkAlzheimerDisease = () => {
    let riskScore = 0;
    let matchedFactors = [];
    let totalWeight = 0;

    // Check Heart Rate
    if (sensorData.hr >= ALZHEIMER_THRESHOLDS.hr.min && sensorData.hr <= ALZHEIMER_THRESHOLDS.hr.max) {
      riskScore += ALZHEIMER_THRESHOLDS.hr.weight;
      matchedFactors.push({
        name: 'Heart Rate',
        value: sensorData.hr,
        threshold: `${ALZHEIMER_THRESHOLDS.hr.min}-${ALZHEIMER_THRESHOLDS.hr.max} BPM`,
        reason: 'Reduced heart rate variability is associated with Alzheimer\'s disease'
      });
    }
    totalWeight += ALZHEIMER_THRESHOLDS.hr.weight;

    // Check SPO2
    if (sensorData.spo2 >= ALZHEIMER_THRESHOLDS.spo2.min && sensorData.spo2 <= ALZHEIMER_THRESHOLDS.spo2.max) {
      riskScore += ALZHEIMER_THRESHOLDS.spo2.weight;
      matchedFactors.push({
        name: 'Blood Oxygen',
        value: sensorData.spo2 + '%',
        threshold: `${ALZHEIMER_THRESHOLDS.spo2.min}-${ALZHEIMER_THRESHOLDS.spo2.max}%`,
        reason: 'Chronic hypoxia (low oxygen) can contribute to cognitive decline'
      });
    }
    totalWeight += ALZHEIMER_THRESHOLDS.spo2.weight;

    // Check Temperature
    if (sensorData.temp >= ALZHEIMER_THRESHOLDS.temp.min && sensorData.temp <= ALZHEIMER_THRESHOLDS.temp.max) {
      riskScore += ALZHEIMER_THRESHOLDS.temp.weight;
      matchedFactors.push({
        name: 'Body Temperature',
        value: sensorData.temp.toFixed(1) + '°C',
        threshold: `${ALZHEIMER_THRESHOLDS.temp.min}-${ALZHEIMER_THRESHOLDS.temp.max}°C`,
        reason: 'Lower body temperature can indicate metabolic changes in Alzheimer\'s patients'
      });
    }
    totalWeight += ALZHEIMER_THRESHOLDS.temp.weight;

    // Check Angle (Balance)
    if (sensorData.angle >= ALZHEIMER_THRESHOLDS.angle.min && sensorData.angle <= ALZHEIMER_THRESHOLDS.angle.max) {
      riskScore += ALZHEIMER_THRESHOLDS.angle.weight;
      matchedFactors.push({
        name: 'Balance/Angle',
        value: sensorData.angle.toFixed(4),
        threshold: `${ALZHEIMER_THRESHOLDS.angle.min}-${ALZHEIMER_THRESHOLDS.angle.max}`,
        reason: 'Balance problems and postural instability are common in Alzheimer\'s patients'
      });
    }
    totalWeight += ALZHEIMER_THRESHOLDS.angle.weight;

    // Check Acceleration (Movement)
    if (sensorData.accel >= ALZHEIMER_THRESHOLDS.accel.min && sensorData.accel <= ALZHEIMER_THRESHOLDS.accel.max) {
      riskScore += ALZHEIMER_THRESHOLDS.accel.weight;
      matchedFactors.push({
        name: 'Movement/Acceleration',
        value: sensorData.accel.toFixed(4) + 'g',
        threshold: `${ALZHEIMER_THRESHOLDS.accel.min}-${ALZHEIMER_THRESHOLDS.accel.max}g`,
        reason: 'Reduced motor coordination and slower movements are Alzheimer\'s symptoms'
      });
    }
    totalWeight += ALZHEIMER_THRESHOLDS.accel.weight;

    // Check Energy Level
    if (sensorData.eng >= ALZHEIMER_THRESHOLDS.eng.min && sensorData.eng <= ALZHEIMER_THRESHOLDS.eng.max) {
      riskScore += ALZHEIMER_THRESHOLDS.eng.weight;
      matchedFactors.push({
        name: 'Energy Level',
        value: sensorData.eng,
        threshold: `${ALZHEIMER_THRESHOLDS.eng.min}-${ALZHEIMER_THRESHOLDS.eng.max}`,
        reason: 'Fatigue and low energy are early signs of Alzheimer\'s disease'
      });
    }
    totalWeight += ALZHEIMER_THRESHOLDS.eng.weight;

    // Check Humidity (Environmental factor)
    if (sensorData.hum >= ALZHEIMER_THRESHOLDS.hum.min && sensorData.hum <= ALZHEIMER_THRESHOLDS.hum.max) {
      riskScore += ALZHEIMER_THRESHOLDS.hum.weight;
      matchedFactors.push({
        name: 'Humidity Level',
        value: sensorData.hum + '%',
        threshold: `${ALZHEIMER_THRESHOLDS.hum.min}-${ALZHEIMER_THRESHOLDS.hum.max}%`,
        reason: 'Environmental factors can affect patient comfort and symptoms'
      });
    }
    totalWeight += ALZHEIMER_THRESHOLDS.hum.weight;

    // Calculate percentage
    const riskPercentage = (riskScore / totalWeight) * 100;
    const detected = riskPercentage >= 60; // 60% threshold for detection

    // Determine risk level and stage
    let riskLevel = 'Low';
    let diseaseStage = 'No Significant Risk';
    
    if (riskPercentage >= 80) {
      riskLevel = 'Critical';
      diseaseStage = 'Advanced Stage';
    } else if (riskPercentage >= 70) {
      riskLevel = 'High';
      diseaseStage = 'Moderate to Severe';
    } else if (riskPercentage >= 60) {
      riskLevel = 'Moderate';
      diseaseStage = 'Mild to Moderate';
    } else if (riskPercentage >= 40) {
      riskLevel = 'Low-Moderate';
      diseaseStage = 'Early Warning Signs';
    }

    setDiagnosisResult({
      detected,
      riskPercentage: riskPercentage.toFixed(1),
      riskLevel,
      diseaseStage,
      matchedFactors,
      totalFactors: matchedFactors.length,
      timestamp: new Date().toLocaleString()
    });

    setShowDiagnosis(true);
  };

  // Get medical suggestions based on risk level
  const getMedicalSuggestions = (riskLevel, diseaseStage) => {
    const suggestions = {
      'Critical': {
        urgency: 'IMMEDIATE MEDICAL ATTENTION REQUIRED',
        medications: [
          'Donepezil (Aricept) - 10mg daily - Cholinesterase inhibitor to improve cognitive function',
          'Memantine (Namenda) - 20mg daily - NMDA receptor antagonist for moderate to severe Alzheimer\'s',
          'Rivastigmine (Exelon) - 9.5mg patch - Alternative cholinesterase inhibitor',
          'Galantamine (Razadyne) - 16-24mg daily - Enhances cholinergic function',
          'Anti-anxiety medications as needed - Lorazepam or Alprazolam for agitation',
          'Antidepressants - Sertraline or Citalopram for mood disorders'
        ],
        memoryAids: [
          '🔔 Automated medication dispensers with alarms and voice reminders',
          '📱 GPS tracking devices for patient safety and wandering prevention',
          '🏠 24/7 supervised care or memory care facility placement recommended',
          '📋 Digital memory boards with photos, daily schedules, and family information',
          '🎵 Music therapy programs with familiar songs from patient\'s past',
          '💡 Smart home automation: labeled rooms, automatic lights, door sensors',
          '📝 Simplified picture-based communication boards',
          '⏰ Large digital clocks with day, date, and time visible',
          '🖼️ Reality orientation boards updated daily',
          '📞 Emergency contact buttons and medical alert systems'
        ],
        caregiverSupport: [
          'Hire professional full-time caregiver or consider memory care facility',
          'Establish power of attorney and advance healthcare directives immediately',
          'Join Alzheimer\'s Association caregiver support groups',
          'Implement safety measures: remove hazards, install locks on dangerous areas',
          'Create structured daily routines with minimal changes',
          'Respite care services to prevent caregiver burnout'
        ],
        lifestyle: [
          'Highly structured environment with consistent daily routine',
          'Cognitive stimulation through simple, familiar activities',
          'Physical therapy for mobility and fall prevention',
          'Nutritional support: high-calorie, easy-to-eat foods',
          'Regular medical monitoring (weekly to bi-weekly)',
          'End-of-life planning and palliative care discussions'
        ]
      },
      'High': {
        urgency: 'URGENT - Schedule neurologist appointment within 48 hours',
        medications: [
          'Donepezil (Aricept) - 5-10mg daily - First-line treatment for Alzheimer\'s',
          'Memantine (Namenda) - 10-20mg daily - Often combined with Donepezil',
          'Rivastigmine (Exelon) - 6-12mg daily or patch - Alternative option',
          'Vitamin E - 1000 IU twice daily - Antioxidant support',
          'Omega-3 fatty acids - 2000mg daily - Brain health support',
          'Low-dose aspirin - 81mg daily - Cardiovascular protection (if approved by doctor)'
        ],
        memoryAids: [
          '📱 Smartphone apps with medication reminders and daily task prompts',
          '📝 Memory journals with daily entries and photo albums',
          '🏷️ Label all household items, cabinets, and rooms with pictures and words',
          '📅 Large wall calendars with important dates and daily activities',
          '🔊 Voice-activated assistants (Alexa/Google Home) for reminders',
          '👥 Photo albums with names and relationships clearly labeled',
          '🗺️ Familiar environment setup with minimal changes',
          '⏰ Multiple alarm clocks and timers for different activities',
          '📞 Simplified phone with photo speed dial buttons',
          '🎯 Checklists for daily routines (morning, evening, meals)'
        ],
        caregiverSupport: [
          'Part-time professional caregiver assistance (4-8 hours daily)',
          'Family training on Alzheimer\'s care techniques',
          'Establish medical power of attorney',
          'Join local and online support groups',
          'Install home safety features: grab bars, non-slip mats',
          'Create emergency response plan'
        ],
        lifestyle: [
          'Consistent daily schedule and routine',
          'Supervised cooking and household activities',
          'Gentle exercise programs (walking, tai chi)',
          'Mediterranean diet rich in vegetables, fish, olive oil',
          'Social engagement in supervised settings',
          'Monthly neurologist check-ups'
        ]
      },
      'Moderate': {
        urgency: 'Important - Schedule neurologist consultation within 1 week',
        medications: [
          'Donepezil (Aricept) - 5mg daily initially - May increase to 10mg',
          'Rivastigmine (Exelon) - 3-6mg twice daily - Start low, increase gradually',
          'Vitamin B complex - Daily supplement - Supports brain function',
          'Vitamin D3 - 2000 IU daily - Cognitive health support',
          'Ginkgo Biloba - 120-240mg daily - May improve memory (consult doctor)',
          'Coenzyme Q10 - 200mg daily - Cellular energy support'
        ],
        memoryAids: [
          '📱 Digital reminder apps for medications and appointments',
          '📖 Memory notebooks to record daily events and tasks',
          '🏷️ Label important items and frequently used spaces',
          '📋 Whiteboards for daily to-do lists and notes',
          '📸 Photo displays of family members with names',
          '🗓️ Daily planners with hour-by-hour schedules',
          '🔔 Pill organizers with built-in alarms',
          '📝 Sticky notes in strategic locations for reminders',
          '⏰ Routine-based alarms for meals, medications, activities',
          '💻 Computer bookmarks and desktop shortcuts for important tasks'
        ],
        caregiverSupport: [
          'Regular check-ins from family members (daily if possible)',
          'Part-time assistance for complex tasks (3-4 hours, 2-3 times weekly)',
          'Educate family about disease progression',
          'Prepare legal documents (living will, healthcare proxy)',
          'Home safety assessment',
          'Establish support network of family and friends'
        ],
        lifestyle: [
          'Maintain regular sleep schedule (7-8 hours nightly)',
          'Daily physical exercise (30 minutes walking or swimming)',
          'Brain-training games and puzzles',
          'Social activities and community engagement',
          'Balanced diet with emphasis on brain-healthy foods',
          'Bi-monthly medical check-ups'
        ]
      },
      'Low-Moderate': {
        urgency: 'Monitor closely - Schedule evaluation within 2 weeks',
        medications: [
          'Consider starting low-dose Donepezil (5mg) after neurologist evaluation',
          'Vitamin B12 - 1000mcg daily - Essential for nerve health',
          'Omega-3 fish oil - 1000mg daily - Brain cell support',
          'Multivitamin with antioxidants - Daily',
          'Turmeric/Curcumin - 500mg daily - Anti-inflammatory properties',
          'Resveratrol - 250mg daily - Neuroprotective effects'
        ],
        memoryAids: [
          '📱 Phone reminders for important tasks and medications',
          '📝 Daily journals to track activities and memory',
          '📅 Wall calendars in visible locations',
          '✅ To-do lists and checklists',
          '📋 Routine cards for morning and evening activities',
          '🗂️ Organized filing system for important documents',
          '⏰ Standard alarm system for regular activities',
          '📞 Contact list with photos next to phone',
          '🎯 Mnemonic devices and memory techniques',
          '💡 Keep familiar items in consistent locations'
        ],
        caregiverSupport: [
          'Family awareness and education about early symptoms',
          'Weekly check-ins to monitor changes',
          'Encourage independence while providing support',
          'Begin discussing future care planning',
          'Create emergency contact list',
          'Consider medical alert system'
        ],
        lifestyle: [
          'Regular physical exercise (150 minutes weekly)',
          'Cognitive activities: reading, puzzles, learning new skills',
          'Active social life and community involvement',
          'Mediterranean or MIND diet',
          'Stress management techniques',
          'Quarterly medical evaluations'
        ]
      }
    };

    return suggestions[riskLevel] || {
      urgency: 'Continue monitoring',
      medications: ['Preventive vitamins and healthy lifestyle'],
      memoryAids: ['Standard organizational tools'],
      caregiverSupport: ['Regular family contact'],
      lifestyle: ['Healthy lifestyle practices']
    };
  };

  if (loading) {
    return (
      <div className="alzheimer-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Sensor Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="alzheimer-container">
      <div className="header-section">
        <h1 className="main-title">Alzheimer Health Monitoring System</h1>
        <p className="subtitle">Real-time ECG & Sensor Data</p>
        {lastUpdate && (
          <div className="last-update">
            <span className="update-icon">🔄</span>
            Last Updated: {lastUpdate}
          </div>
        )}
      </div>

      {/* Live Location Monitoring */}
      <div className="location-monitoring-section">
        <div className="location-header">
          <h2 className="location-title">📍 Live Patient Location Tracking</h2>
          <p className="location-subtitle">Real-time GPS monitoring for patient safety</p>
        </div>

        <div className="location-content">
          {locationError ? (
            <div className="location-error">
              <div className="error-icon">⚠️</div>
              <h3>Location Access Error</h3>
              <p>{locationError}</p>
              <div className="error-help">
                <p><strong>To enable location access:</strong></p>
                <ol style={{ textAlign: 'left', margin: '1rem auto', maxWidth: '500px' }}>
                  <li>Click the lock/info icon in your browser's address bar</li>
                  <li>Find "Location" permissions</li>
                  <li>Select "Allow" or "Ask"</li>
                  <li>Refresh this page</li>
                </ol>
                <button 
                  onClick={() => window.location.reload()}
                  className="location-btn retry-btn"
                  style={{ marginTop: '1rem' }}
                >
                  🔄 Retry Location Access
                </button>
              </div>
            </div>
          ) : location ? (
            <div className="location-display">
              <div className="location-map">
                <div 
                  id="patient-location-map" 
                  style={{ 
                    width: '100%', 
                    height: '400px', 
                    borderRadius: '15px',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)'
                  }}
                ></div>
              </div>

              <div className="location-details-grid">
                <div className="location-detail-card">
                  <div className="detail-icon">🌍</div>
                  <div className="detail-content">
                    <h4>Latitude</h4>
                    <p className="detail-value">{location.latitude.toFixed(6)}°</p>
                  </div>
                </div>

                <div className="location-detail-card">
                  <div className="detail-icon">🗺️</div>
                  <div className="detail-content">
                    <h4>Longitude</h4>
                    <p className="detail-value">{location.longitude.toFixed(6)}°</p>
                  </div>
                </div>

                <div className="location-detail-card">
                  <div className="detail-icon">🎯</div>
                  <div className="detail-content">
                    <h4>Accuracy</h4>
                    <p className="detail-value">{location.accuracy.toFixed(0)}m</p>
                  </div>
                </div>

                <div className="location-detail-card">
                  <div className="detail-icon">⏰</div>
                  <div className="detail-content">
                    <h4>Last Updated</h4>
                    <p className="detail-value">{location.timestamp}</p>
                  </div>
                </div>
              </div>

              <div className="location-actions">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="location-btn open-maps-btn"
                >
                  🗺️ Open in Google Maps
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="location-btn directions-btn"
                >
                  🧭 Get Directions
                </a>
                <button
                  onClick={() => {
                    const coords = `${location.latitude},${location.longitude}`;
                    navigator.clipboard.writeText(coords);
                    alert('Coordinates copied to clipboard!');
                  }}
                  className="location-btn copy-btn"
                >
                  📋 Copy Coordinates
                </button>
              </div>

              <div className="location-info">
                <div className="info-badge live-badge">
                  <span className="live-indicator"></span>
                  Live Tracking Active
                </div>
                <p className="tracking-note">
                  Location updates automatically every few seconds for real-time patient monitoring.
                  This helps caregivers quickly locate patients who may wander or become disoriented.
                </p>
              </div>
            </div>
          ) : (
            <div className="location-loading">
              <div className="spinner"></div>
              <p>Acquiring patient location...</p>
            </div>
          )}
        </div>

        {/* Emergency Caretakers Contact Section */}
        <div className="caretakers-section">
          <h3 className="caretakers-title">👥 Emergency Caretakers Contact</h3>
          <p className="caretakers-subtitle">In case of emergency, contact these designated caretakers immediately</p>
          
          <div className="caretakers-grid">
            <div className="caretaker-card">
              <div className="caretaker-header">
                <div className="caretaker-avatar">M</div>
                <div className="caretaker-info">
                  <h4 className="caretaker-name">Monisha SN</h4>
                  <span className="caretaker-role">Emergency Contact</span>
                </div>
              </div>
              <div className="caretaker-contact">
                <a href="tel:6363018700" className="contact-btn call-btn">
                  <span className="contact-icon">📞</span>
                  <span className="contact-number">6363018700</span>
                </a>
              </div>
            </div>

            <div className="caretaker-card">
              <div className="caretaker-header">
                <div className="caretaker-avatar">A</div>
                <div className="caretaker-info">
                  <h4 className="caretaker-name">Arpitha</h4>
                  <span className="caretaker-role">Emergency Contact</span>
                </div>
              </div>
              <div className="caretaker-contact">
                <a href="tel:7760956771" className="contact-btn call-btn">
                  <span className="contact-icon">📞</span>
                  <span className="contact-number">7760956771</span>
                </a>
              </div>
            </div>

            <div className="caretaker-card">
              <div className="caretaker-header">
                <div className="caretaker-avatar">C</div>
                <div className="caretaker-info">
                  <h4 className="caretaker-name">Chandana</h4>
                  <span className="caretaker-role">Emergency Contact</span>
                </div>
              </div>
              <div className="caretaker-contact">
                <a href="tel:7892739967" className="contact-btn call-btn">
                  <span className="contact-icon">📞</span>
                  <span className="contact-number">7892739967</span>
                </a>
              </div>
            </div>

            <div className="caretaker-card">
              <div className="caretaker-header">
                <div className="caretaker-avatar">V</div>
                <div className="caretaker-info">
                  <h4 className="caretaker-name">Vinitha</h4>
                  <span className="caretaker-role">Emergency Contact</span>
                </div>
              </div>
              <div className="caretaker-contact">
                <a href="tel:9591587455" className="contact-btn call-btn">
                  <span className="contact-icon">📞</span>
                  <span className="contact-number">9591587455</span>
                </a>
              </div>
            </div>
          </div>

          <div className="emergency-notice">
            <div className="notice-icon">🚨</div>
            <div className="notice-content">
              <h4>Emergency Protocol</h4>
              <p>If the patient is missing or in distress, call any of the emergency contacts immediately for quick response and assistance.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="cards-grid">
        {/* Heart Rate Card */}
        <div className={`sensor-card ${getStatusColor('hr', sensorData.hr)}`}>
          <div className="card-icon heart-icon">❤️</div>
          <div className="card-content">
            <h3 className="card-title">Heart Rate</h3>
            <div className="card-value">{sensorData.hr}</div>
            <div className="card-unit">BPM</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            {sensorData.hr >= 60 && sensorData.hr <= 100 ? 'Normal' : 'Alert'}
          </div>
        </div>

        {/* SPO2 Card */}
        <div className={`sensor-card ${getStatusColor('spo2', sensorData.spo2)}`}>
          <div className="card-icon oxygen-icon">💨</div>
          <div className="card-content">
            <h3 className="card-title">Blood Oxygen</h3>
            <div className="card-value">{sensorData.spo2}</div>
            <div className="card-unit">%</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            {sensorData.spo2 >= 95 ? 'Normal' : 'Low'}
          </div>
        </div>

        {/* Blood Pressure Card */}
        <div className="sensor-card status-normal">
          <div className="card-icon bp-icon">🩺</div>
          <div className="card-content">
            <h3 className="card-title">Blood Pressure</h3>
            <div className="card-value">{sensorData.bp}</div>
            <div className="card-unit">mmHg</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            Monitoring
          </div>
        </div>

        {/* Temperature Card */}
        <div className={`sensor-card ${getStatusColor('temp', sensorData.temp)}`}>
          <div className="card-icon temp-icon">🌡️</div>
          <div className="card-content">
            <h3 className="card-title">Temperature</h3>
            <div className="card-value">{sensorData.temp.toFixed(1)}</div>
            <div className="card-unit">°C</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            {sensorData.temp >= 36 && sensorData.temp <= 37.5 ? 'Normal' : 'Alert'}
          </div>
        </div>

        {/* Humidity Card */}
        <div className="sensor-card status-normal">
          <div className="card-icon humidity-icon">💧</div>
          <div className="card-content">
            <h3 className="card-title">Humidity</h3>
            <div className="card-value">{sensorData.hum}</div>
            <div className="card-unit">%</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            Environmental
          </div>
        </div>

        {/* Angle Card */}
        <div className="sensor-card status-normal">
          <div className="card-icon angle-icon">📐</div>
          <div className="card-content">
            <h3 className="card-title">Angle</h3>
            <div className="card-value">{sensorData.angle.toFixed(4)}</div>
            <div className="card-unit">degrees</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            Position
          </div>
        </div>

        {/* Acceleration Card */}
        <div className="sensor-card status-normal">
          <div className="card-icon accel-icon">⚡</div>
          <div className="card-content">
            <h3 className="card-title">Acceleration</h3>
            <div className="card-value">{sensorData.accel.toFixed(4)}</div>
            <div className="card-unit">g</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            Movement
          </div>
        </div>

        {/* Energy Card */}
        <div className="sensor-card status-normal">
          <div className="card-icon energy-icon">🔋</div>
          <div className="card-content">
            <h3 className="card-title">Energy Level</h3>
            <div className="card-value">{sensorData.eng}</div>
            <div className="card-unit">units</div>
          </div>
          <div className="card-footer">
            <span className="status-indicator"></span>
            Active
          </div>
        </div>
      </div>

      {/* Alzheimer's Detection Button */}
      <div className="detection-section">
        <button className="check-alzheimer-btn" onClick={checkAlzheimerDisease}>
          🧠 Check for Alzheimer's Disease
        </button>
      </div>

      {/* Diagnosis Result */}
      {showDiagnosis && diagnosisResult && (
        <div className={`diagnosis-container ${diagnosisResult.detected ? 'diagnosis-positive' : 'diagnosis-negative'}`}>
          <div className="diagnosis-header">
            <div className="diagnosis-icon">
              {diagnosisResult.detected ? '⚠️' : '✅'}
            </div>
            <h2 className="diagnosis-title">
              {diagnosisResult.detected ? 'Alzheimer\'s Disease Detected' : 'No Alzheimer\'s Disease Detected'}
            </h2>
            <p className="diagnosis-subtitle">
              Risk Assessment: {diagnosisResult.riskPercentage}% | Stage: {diagnosisResult.diseaseStage}
            </p>
            <div className="risk-level-badge" style={{
              background: diagnosisResult.riskLevel === 'Critical' ? '#dc3545' :
                         diagnosisResult.riskLevel === 'High' ? '#fd7e14' :
                         diagnosisResult.riskLevel === 'Moderate' ? '#ffc107' : '#28a745',
              color: 'white',
              padding: '0.5rem 1.5rem',
              borderRadius: '25px',
              display: 'inline-block',
              marginTop: '1rem',
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}>
              Risk Level: {diagnosisResult.riskLevel}
            </div>
          </div>

          <div className="diagnosis-body">
            <div className="diagnosis-summary">
              <h3>📋 Diagnosis Summary</h3>
              <p>
                {diagnosisResult.detected ? (
                  <>
                    Based on the current sensor readings, the system has detected <strong>{diagnosisResult.totalFactors} risk factors</strong> that 
                    match the established Alzheimer's disease indicators. The overall risk score is <strong>{diagnosisResult.riskPercentage}%</strong>, 
                    which exceeds the 60% threshold for positive detection. Disease Stage: <strong>{diagnosisResult.diseaseStage}</strong>.
                  </>
                ) : (
                  <>
                    Based on the current sensor readings, the system has detected <strong>{diagnosisResult.totalFactors} risk factors</strong>, 
                    resulting in a risk score of <strong>{diagnosisResult.riskPercentage}%</strong>. This is below the 60% threshold, 
                    indicating no significant Alzheimer's disease markers at this time.
                  </>
                )}
              </p>
              <p className="diagnosis-timestamp">Analysis performed at: {diagnosisResult.timestamp}</p>
            </div>

            {/* Medical Suggestions Section for Detected Alzheimer's */}
            {diagnosisResult.detected && (() => {
              const suggestions = getMedicalSuggestions(diagnosisResult.riskLevel, diagnosisResult.diseaseStage);
              return (
                <div className="medical-suggestions">
                  <div className="urgency-banner" style={{
                    background: diagnosisResult.riskLevel === 'Critical' ? '#dc3545' :
                               diagnosisResult.riskLevel === 'High' ? '#fd7e14' : '#ffc107',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '15px',
                    marginBottom: '2rem',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.3rem',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}>
                    ⚕️ {suggestions.urgency}
                  </div>

                  <h3 className="suggestions-title">💊 Prescribed Medications & Treatment Plan</h3>
                  <div className="suggestions-section medications-section">
                    <p className="section-intro">
                      <strong>Memory Loss Management:</strong> {
                        diagnosisResult.riskLevel === 'Critical' ? 'Advanced stage requires intensive medication regimen and symptom management.' :
                        diagnosisResult.riskLevel === 'High' ? 'Moderate to severe symptoms require combination therapy to slow progression.' :
                        diagnosisResult.riskLevel === 'Moderate' ? 'Early-stage medications can help preserve cognitive function and delay progression.' :
                        'Preventive supplements and early intervention may help reduce risk.'
                      }
                    </p>
                    <ul className="suggestions-list">
                      {suggestions.medications.slice(0, diagnosisResult.riskLevel === 'Critical' ? 6 : 
                                                          diagnosisResult.riskLevel === 'High' ? 4 : 
                                                          diagnosisResult.riskLevel === 'Moderate' ? 3 : 2).map((med, index) => (
                        <li key={index} className="suggestion-item medication-item">
                          <span className="item-icon">💊</span>
                          <span className="item-text">{med}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="medication-note">
                      ⚠️ <strong>Important:</strong> All medications must be prescribed and monitored by a neurologist. 
                      {diagnosisResult.riskLevel === 'Critical' || diagnosisResult.riskLevel === 'High' ? 
                        ' Weekly to bi-weekly monitoring required.' : ' Regular follow-up appointments recommended.'}
                    </p>
                  </div>

                  <h3 className="suggestions-title">🧠 Memory Aids & Cognitive Support Tools</h3>
                  <div className="suggestions-section memory-aids-section">
                    <p className="section-intro">
                      <strong>Combating Memory Loss:</strong> {
                        diagnosisResult.riskLevel === 'Critical' ? 'Severe memory impairment requires 24/7 supervision and comprehensive memory support systems.' :
                        diagnosisResult.riskLevel === 'High' ? 'Significant memory loss requires extensive daily reminders and structured environment.' :
                        diagnosisResult.riskLevel === 'Moderate' ? 'Mild memory issues benefit from organizational tools and routines.' :
                        'Basic memory aids help maintain independence and organization.'
                      }
                    </p>
                    <ul className="suggestions-list">
                      {suggestions.memoryAids.slice(0, diagnosisResult.riskLevel === 'Critical' ? 10 : 
                                                          diagnosisResult.riskLevel === 'High' ? 6 : 
                                                          diagnosisResult.riskLevel === 'Moderate' ? 4 : 3).map((aid, index) => (
                        <li key={index} className="suggestion-item memory-item">
                          <span className="item-text">{aid}</span>
                        </li>
                      ))}
                    </ul>
                    {(diagnosisResult.riskLevel === 'Critical' || diagnosisResult.riskLevel === 'High') && (
                      <div className="memory-tips">
                        <h4>🎯 Critical Memory Strategies:</h4>
                        <ul>
                          <li><strong>Repetition & Routine:</strong> Establish fixed daily schedules that repeat every day</li>
                          <li><strong>Visual Cues:</strong> Use photos, colors, and symbols instead of text when possible</li>
                          <li><strong>Simplification:</strong> Break complex tasks into simple, single-step instructions</li>
                          <li><strong>Validation:</strong> Don't correct false memories; redirect gently instead</li>
                          <li><strong>Familiar Environment:</strong> Keep furniture and items in the same place always</li>
                        </ul>
                      </div>
                    )}
                  </div>

                  <h3 className="suggestions-title">👨‍⚕️ Caregiver Support & Patient Safety</h3>
                  <div className="suggestions-section caregiver-section">
                    <p className="section-intro">
                      <strong>Essential Care Requirements:</strong> {
                        diagnosisResult.riskLevel === 'Critical' ? 'Full-time professional care or memory care facility required for safety.' :
                        diagnosisResult.riskLevel === 'High' ? 'Part-time professional assistance needed for daily activities and safety.' :
                        diagnosisResult.riskLevel === 'Moderate' ? 'Regular check-ins and assistance with complex tasks recommended.' :
                        'Family support and monitoring to ensure safety and well-being.'
                      }
                    </p>
                    <ul className="suggestions-list">
                      {suggestions.caregiverSupport.map((support, index) => (
                        <li key={index} className="suggestion-item caregiver-item">
                          <span className="item-icon">👥</span>
                          <span className="item-text">{support}</span>
                        </li>
                      ))}
                    </ul>
                    {(diagnosisResult.riskLevel === 'Critical' || diagnosisResult.riskLevel === 'High') && (
                      <div className="caregiver-warning">
                        <h4>⚠️ Critical Safety Measures:</h4>
                        <ul>
                          <li><strong>Wandering Prevention:</strong> Install door alarms, GPS trackers, ID bracelets</li>
                          <li><strong>Kitchen Safety:</strong> Disable stove when unsupervised, remove sharp objects</li>
                          <li><strong>Medication Management:</strong> Supervised administration only - never leave pills accessible</li>
                          <li><strong>Financial Protection:</strong> Limit access to bank accounts, credit cards, checkbooks</li>
                          <li><strong>Driving:</strong> Assess driving ability immediately - most patients should stop driving</li>
                        </ul>
                      </div>
                    )}
                  </div>

                  <h3 className="suggestions-title">🏃 Lifestyle Modifications & Daily Care</h3>
                  <div className="suggestions-section lifestyle-section">
                    <p className="section-intro">
                      <strong>Maintaining Quality of Life:</strong> {
                        diagnosisResult.riskLevel === 'Critical' ? 'Highly structured environment with 24/7 supervision essential.' :
                        diagnosisResult.riskLevel === 'High' ? 'Consistent daily routines with supervised activities recommended.' :
                        diagnosisResult.riskLevel === 'Moderate' ? 'Regular exercise, cognitive activities, and social engagement beneficial.' :
                        'Healthy lifestyle practices support brain health and reduce risk progression.'
                      }
                    </p>
                    <ul className="suggestions-list">
                      {suggestions.lifestyle.map((lifestyle, index) => (
                        <li key={index} className="suggestion-item lifestyle-item">
                          <span className="item-icon">🌟</span>
                          <span className="item-text">{lifestyle}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {(diagnosisResult.riskLevel === 'Critical' || diagnosisResult.riskLevel === 'High') && (
                    <div className="communication-strategies">
                      <h3>💬 Communicating with Memory-Impaired Patients</h3>
                      <div className="communication-grid">
                        <div className="comm-card">
                          <h4>✅ DO:</h4>
                          <ul>
                            <li>Speak slowly and clearly in short sentences</li>
                            <li>Maintain eye contact and use gentle touch</li>
                            <li>Ask one question at a time</li>
                            <li>Use patient's name frequently</li>
                            <li>Respond to emotions, not just words</li>
                            <li>Show photos to trigger memories</li>
                            <li>Praise and encourage any success</li>
                          </ul>
                        </div>
                        <div className="comm-card">
                          <h4>❌ DON'T:</h4>
                          <ul>
                            <li>Argue about facts or correct memories</li>
                            <li>Ask "Do you remember...?"</li>
                            <li>Talk about them as if they're not there</li>
                            <li>Rush or show frustration</li>
                            <li>Use complex sentences or questions</li>
                            <li>Change topics suddenly</li>
                            <li>Test their memory repeatedly</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {diagnosisResult.riskLevel === 'Critical' && (
                    <div className="emergency-plan">
                      <h3>🚨 Emergency Response Plan</h3>
                      <div className="emergency-content">
                        <p><strong>If patient becomes disoriented, aggressive, or goes missing:</strong></p>
                        <ol>
                          <li><strong>Stay Calm:</strong> Patient mirrors your emotions</li>
                          <li><strong>Contact Emergency Contacts:</strong> Family members first, then 911 if necessary</li>
                          <li><strong>Wandering:</strong> Check familiar places, alert neighbors, contact police immediately</li>
                          <li><strong>Behavioral Crisis:</strong> Remove from triggering situation, redirect attention, contact doctor</li>
                          <li><strong>Medical Emergency:</strong> Call 911 and inform them of Alzheimer's diagnosis</li>
                        </ol>
                        <p className="emergency-note">
                          📞 <strong>Keep a current photo and medical information card ready at all times</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="resources-section">
                    <h3>📚 Support Resources</h3>
                    <ul>
                      <li><strong>Alzheimer's Association 24/7 Helpline:</strong> 1-800-272-3900</li>
                      {(diagnosisResult.riskLevel === 'Critical' || diagnosisResult.riskLevel === 'High') && (
                        <>
                          <li><strong>Online Support Communities:</strong> ALZConnected.org</li>
                          <li><strong>Caregiver Education:</strong> Local Alzheimer's Association chapters</li>
                          <li><strong>Respite Care:</strong> Adult day programs and in-home respite services</li>
                          <li><strong>Legal/Financial Planning:</strong> Elder law attorneys, financial planners</li>
                        </>
                      )}
                      {(diagnosisResult.riskLevel === 'Moderate' || diagnosisResult.riskLevel === 'Low-Moderate') && (
                        <>
                          <li><strong>Educational Resources:</strong> Alzheimer's disease information and support</li>
                          <li><strong>Cognitive Health Programs:</strong> Brain training and memory workshops</li>
                          <li><strong>Support Groups:</strong> Connect with others experiencing similar challenges</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {diagnosisResult.totalFactors > 0 && (
              <div className="matched-factors">
                <h3>🔍 Detected Risk Factors ({diagnosisResult.totalFactors})</h3>
                <div className="factors-grid">
                  {diagnosisResult.matchedFactors.map((factor, index) => (
                    <div key={index} className="factor-card">
                      <div className="factor-header">
                        <h4>{factor.name}</h4>
                        <span className="factor-badge">Risk Factor</span>
                      </div>
                      <div className="factor-values">
                        <div className="factor-value">
                          <span className="label">Current Value:</span>
                          <span className="value">{factor.value}</span>
                        </div>
                        <div className="factor-threshold">
                          <span className="label">Risk Range:</span>
                          <span className="value">{factor.threshold}</span>
                        </div>
                      </div>
                      <p className="factor-reason">{factor.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="clinical-explanation">
              <h3>📖 Clinical Explanation</h3>
              <div className="explanation-content">
                <h4>Understanding Alzheimer's Disease Detection</h4>
                <p>
                  This system uses multi-parameter sensor analysis to detect potential Alzheimer's disease indicators. 
                  Alzheimer's disease is a progressive neurodegenerative disorder that affects memory, thinking, and behavior.
                </p>

                <h4>Key Biomarkers Monitored:</h4>
                <ul>
                  <li>
                    <strong>Heart Rate (55-90 BPM):</strong> Studies show reduced heart rate variability and autonomic dysfunction 
                    in Alzheimer's patients due to damage to the autonomic nervous system.
                  </li>
                  <li>
                    <strong>Blood Oxygen (92-96%):</strong> Chronic cerebral hypoxia (reduced brain oxygen) is linked to cognitive 
                    decline and may accelerate Alzheimer's progression through oxidative stress.
                  </li>
                  <li>
                    <strong>Body Temperature (36.0-36.8°C):</strong> Lower core body temperature can indicate hypothalamic dysfunction 
                    and metabolic changes commonly observed in Alzheimer's patients.
                  </li>
                  <li>
                    <strong>Balance/Angle (0.05-0.15):</strong> Postural instability and gait disturbances are early motor signs of 
                    Alzheimer's, caused by damage to brain regions controlling motor coordination.
                  </li>
                  <li>
                    <strong>Movement/Acceleration (0.6-0.9g):</strong> Reduced motor activity and slower movement patterns reflect 
                    cognitive-motor integration decline in Alzheimer's disease.
                  </li>
                  <li>
                    <strong>Energy Level (3-7 units):</strong> Chronic fatigue and reduced energy are common early symptoms, 
                    related to mitochondrial dysfunction and neuronal energy metabolism impairment.
                  </li>
                  <li>
                    <strong>Environmental Humidity (50-70%):</strong> While not a direct biomarker, environmental factors can 
                    influence patient comfort and symptom manifestation.
                  </li>
                </ul>

                <h4>Detection Methodology:</h4>
                <p>
                  The system assigns weighted importance to each parameter based on clinical research. When multiple factors 
                  fall within the risk ranges, the cumulative risk score increases. A risk score of 60% or higher triggers 
                  a positive detection, indicating the patient exhibits multiple Alzheimer's-related physiological patterns.
                </p>

                <h4>Important Disclaimer:</h4>
                <p className="disclaimer">
                  ⚕️ This system provides preliminary screening based on sensor data and should NOT be used as a definitive 
                  diagnosis. Alzheimer's disease requires comprehensive clinical evaluation including cognitive assessments, 
                  brain imaging (MRI/PET scans), biomarker testing (CSF amyloid-beta and tau proteins), and neurological examination 
                  by qualified healthcare professionals. If risk factors are detected, please consult a neurologist or 
                  memory disorder specialist for proper evaluation.
                </p>

                <h4>Recommended Actions:</h4>
                <ul>
                  {diagnosisResult.detected ? (
                    <>
                      <li>Schedule an appointment with a neurologist immediately</li>
                      <li>Undergo comprehensive cognitive assessment (MMSE, MoCA tests)</li>
                      <li>Request brain imaging studies (MRI, PET scan)</li>
                      <li>Consider biomarker testing (CSF analysis, blood tests)</li>
                      <li>Monitor symptoms and maintain a health diary</li>
                      <li>Engage in cognitive stimulation activities</li>
                    </>
                  ) : (
                    <>
                      <li>Continue regular health monitoring and check-ups</li>
                      <li>Maintain healthy lifestyle: exercise, diet, sleep</li>
                      <li>Engage in cognitive activities and social interaction</li>
                      <li>Monitor for any changes in cognitive function</li>
                      <li>Schedule periodic reassessments if concerns arise</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="info-section">
        <div className="info-card">
          <h3>🎯 System Status</h3>
          <p>All sensors are operational and transmitting data in real-time.</p>
        </div>
        <div className="info-card">
          <h3>📊 Data Source</h3>
          <p>Firebase Realtime Database - 48_KS5282_Soldier_ECG</p>
        </div>
      </div>
    </div>
  );
};

export default Alzheimer;
