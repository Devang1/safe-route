import React, { useEffect, useRef, useState,useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet.heat';
import { FaLocationArrow, FaCar, FaPlay, FaStop, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
const base_url = import.meta.env.REACT_APP_API_URL || "http://localhost:5000";
// Default Marker Fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const blueIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Voice Instruction Service
class VoiceNavigationService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.isEnabled = true;
    this.utterance = null;
    this.lastInstruction = '';
    this.lastSpokeTime = 0;
  }

  isSupported() {
    return 'speechSynthesis' in window;
  }

  speak(instruction, force = false) {
    if (!this.isEnabled || !this.isSupported()) return;

    const now = Date.now();
    if (!force && instruction === this.lastInstruction && (now - this.lastSpokeTime) < 5000) return;

    this.cancel();

    this.utterance = new SpeechSynthesisUtterance(instruction);
    this.utterance.rate = 0.9;
    this.utterance.pitch = 1.0;
    this.utterance.volume = 0.8;

    this.utterance.onend = () => {
      this.lastInstruction = instruction;
      this.lastSpokeTime = Date.now();
    };

    this.synth.speak(this.utterance);
  }

  cancel() {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }
}

const voiceService = new VoiceNavigationService();

// Navigation Instruction Generator
class NavigationInstructionGenerator {
  static getInstruction(maneuver, distance, name = '') {
    const roundedDistance = this.roundDistance(distance);
    
    const cleanManeuver = maneuver?.toLowerCase().replace('-', ' ') || 'continue';
    
    switch (cleanManeuver) {
      case 'depart':
      case 'start':
        return `Start navigation and follow the route for ${roundedDistance}`;
      
      case 'arrive':
      case 'destination':
        if (distance < 50) {
          return `You have arrived at your destination`;
        } else {
          return `Approaching destination - ${roundedDistance} remaining`;
        }
      
      case 'turn left':
        return `In ${roundedDistance}, turn left${name ? ` onto ${name}` : ''}`;
      
      case 'turn right':
        return `In ${roundedDistance}, turn right${name ? ` onto ${name}` : ''}`;
      
      case 'continue':
      case 'straight':
        return `Continue straight for ${roundedDistance}`;
      
      case 'merge':
        return `In ${roundedDistance}, merge${name ? ` onto ${name}` : ''}`;
      
      case 'roundabout':
        return `In ${roundedDistance}, enter the roundabout`;
      
      case 'fork':
        return `In ${roundedDistance}, keep ${name || 'left'} at the fork`;
      
      case 'end of road':
        return `In ${roundedDistance}, turn ${name || 'right'} at the end of the road`;
      
      default:
        if (cleanManeuver.includes('left')) {
          return `In ${roundedDistance}, turn left${name ? ` onto ${name}` : ''}`;
        } else if (cleanManeuver.includes('right')) {
          return `In ${roundedDistance}, turn right${name ? ` onto ${name}` : ''}`;
        } else {
          return `In ${roundedDistance}, ${cleanManeuver}${name ? ` onto ${name}` : ''}`;
        }
    }
  }

  static roundDistance(meters) {
    if (meters < 20) {
      return 'a short distance';
    } else if (meters < 100) {
      return Math.round(meters / 10) * 10 + ' meters';
    } else if (meters < 1000) {
      return Math.round(meters / 50) * 50 + ' meters';
    } else {
      const km = (meters / 1000).toFixed(1);
      return km.endsWith('.0') ? km.slice(0, -2) + ' kilometers' : km + ' kilometers';
    }
  }

  static getProximityInstruction(distanceToNext, maneuver) {
    if (distanceToNext < 30) {
      if (maneuver?.includes('left')) return 'Prepare to turn left now';
      if (maneuver?.includes('right')) return 'Prepare to turn right now';
      if (maneuver?.includes('arrive')) return 'Arriving at destination';
      return 'Prepare for maneuver now';
    } else if (distanceToNext < 80) {
      if (maneuver?.includes('arrive')) return `Approaching destination in ${Math.round(distanceToNext)} meters`;
      return `Prepare to turn in ${Math.round(distanceToNext)} meters`;
    }
    return null;
  }
}

// Custom navigation icon creator
const createNavigationIcon = (iconType = 'arrow', heading = 0) => {
  const iconSize = 32;
  const iconColor = '#3b82f6';
  
  const iconSvg = iconType === 'car' 
    ? `<svg viewBox="0 0 24 24" fill="${iconColor}" style="transform: rotate(${heading}deg); transition: transform 0.5s ease-out;">
         <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
       </svg>`
    : `<svg viewBox="0 0 24 24" fill="${iconColor}" style="transform: rotate(${heading}deg); transition: transform 0.5s ease-out;">
         <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
       </svg>`;

  return L.divIcon({
    html: iconSvg,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    className: `navigation-marker ${iconType}-marker`
  });
};

const normalizeLocation = (loc) => {
  if (!loc) return [0, 0];
  return Array.isArray(loc) ? loc : [loc.lat ?? loc.latitude, loc.lng ?? loc.longitude ?? loc.lon];
};

const getDistanceFromLatLng = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getPointToLineDistance = (point, lineStart, lineEnd) => {
  const [pointLat, pointLng] = point;
  const startLat = lineStart.lat || lineStart[0];
  const startLng = lineStart.lng || lineStart[1];
  const endLat = lineEnd.lat || lineEnd[0];
  const endLng = lineEnd.lng || lineEnd[1];

  const lat = Number(pointLat);
  const lng = Number(pointLng);
  const lat1 = Number(startLat);
  const lng1 = Number(startLng);
  const lat2 = Number(endLat);
  const lng2 = Number(endLng);

  if (Math.abs(lat1 - lat2) < 0.00001 && Math.abs(lng1 - lng2) < 0.00001) {
    return getDistanceFromLatLng(lat, lng, lat1, lng1);
  }

  const d1 = getDistanceFromLatLng(lat, lng, lat1, lng1);
  const d2 = getDistanceFromLatLng(lat, lng, lat2, lng2);
  const lineLength = getDistanceFromLatLng(lat1, lng1, lat2, lng2);

  const bearing1 = Math.atan2(
    Math.sin(lng2 - lng1) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
  );

  const bearing2 = Math.atan2(
    Math.sin(lng - lng1) * Math.cos(lat),
    Math.cos(lat1) * Math.sin(lat) - Math.sin(lat1) * Math.cos(lat) * Math.cos(lng - lng1)
  );

  const latRad = lat * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const R = 6371e3;

  const dxt = Math.asin(
    Math.sin(d1 / R) * Math.sin(bearing2 - bearing1)
  ) * R;

  const dat = Math.acos(
    Math.cos(d1 / R) / Math.cos(dxt / R)
  ) * R;

  if (dat > lineLength) return d2;
  if (dat < 0) return d1;

  return Math.abs(dxt);
};

const isPointNearPolyline = (point, coordinates, tolerance = 1000) => {
  let minDistance = Infinity;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const distance = getPointToLineDistance(
      point,
      coordinates[i],
      coordinates[i + 1]
    );
    minDistance = Math.min(minDistance, distance);
    if (minDistance <= tolerance) return true;
  }
  return false;
};
// Add this RouteSelectionPanel component before the NavigationPanel component

// Route Selection Panel - Shows when route is selected but not navigating
const RouteSelectionPanel = ({ 
  selectedRoute,
  onStartNavigation,
  voiceEnabled,
  onVoiceToggle
}) => {
  if (!selectedRoute) return null;

  return (
    <div className="absolute top-0 sm:top-0.5 left-15 right-4 bg-gray-800 rounded-lg shadow-xl p-3 z-[1000] text-white max-w-2xl mx-auto">
      <div className="flex flex-row items-center justify-between gap-4">
        {/* Route Information */}
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <div className="text-gray-400 text-xs">Distance</div>
              <div className="font-semibold">{(selectedRoute.summary.totalDistance / 1000).toFixed(1)} km</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400 text-xs">Est. Time</div>
              <div className="font-semibold">{(selectedRoute.summary.totalTime / 60).toFixed(0)} min</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Voice Control */}
          <div className="flex items-center gap-2 bg-gray-700 rounded px-3 py-2">
            <span className="text-sm">Voice</span>
            <button
              onClick={onVoiceToggle}
              className={`p-1 rounded transition-colors ${
                voiceEnabled 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-600 text-gray-400'
              }`}
            >
              {voiceEnabled ? <FaVolumeUp size={12} /> : <FaVolumeMute size={12} />}
            </button>
          </div>

          {/* Start Button */}
          <button
            onClick={onStartNavigation}
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <FaPlay className="w-3 h-3" />
            Start Navigation
          </button>
        </div>
      </div>
    </div>
  );
};
// Unified Navigation Panel Component
const NavigationPanel = ({ 
  isNavigating, 
  onStartNavigation, 
  onStopNavigation, 
  selectedRoute,
  voiceEnabled,
  onVoiceToggle,
  nextInstruction,
  distanceToNext
}) => {
  // Hide completely when not navigating
  if (!selectedRoute || !isNavigating) return null;

  return (
    <div className="absolute top-4 left-4 right-4 bg-gray-800 rounded-lg shadow-xl p-3 z-[1000] text-white max-w-2xl mx-auto">
      {/* Navigation Status Banner */}
      <div className="mb-2 p-2 bg-gray-700 rounded border-l-2 border-green-500">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-green-400">Navigation Active</span>
          </div>
          <div className="text-sm font-medium flex-1 mx-3 text-center">{nextInstruction}</div>
          <div className="text-xs text-gray-400 whitespace-nowrap">
            {distanceToNext > 0 ? `${Math.round(distanceToNext)}m ahead` : 'Following route'}
          </div>
        </div>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="flex flex-row items-center justify-between gap-4">
        {/* Route Progress Information */}
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <div className="text-gray-400 text-xs">Distance Left</div>
              <div className="font-semibold">21.6 km</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400 text-xs">Time Remaining</div>
              <div className="font-semibold">24 min</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Voice Control - Speaker Icon Only */}
          <button
            onClick={onVoiceToggle}
            className={`p-2 rounded transition-colors ${
              voiceEnabled 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-400'
            }`}
            title={voiceEnabled ? 'Mute voice guidance' : 'Unmute voice guidance'}
          >
            {voiceEnabled ? <FaVolumeUp size={14} /> : <FaVolumeMute size={14} />}
          </button>

          {/* Stop Navigation Button */}
          <button
            onClick={onStopNavigation}
            className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-medium transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <FaStop className="w-3 h-3" />
            Stop Navigation
          </button>
        </div>
      </div>
    </div>
  );
};
// Real-time Navigation Component
const RealTimeNavigation = ({ 
  isActive, 
  onStopNavigation, 
  selectedRoute,
  navigationIconType = 'car',
  voiceEnabled = true,
  onInstructionUpdate 
}) => {
  const map = useMap();
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);
  const previousPositionRef = useRef(null);
  const instructionCheckRef = useRef(null);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [nextInstruction, setNextInstruction] = useState('Starting navigation...');
  const [distanceToNext, setDistanceToNext] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  

  const calculateHeading = (from, to) => {
    const fromLat = from.lat * Math.PI / 180;
    const fromLng = from.lng * Math.PI / 180;
    const toLat = to.lat * Math.PI / 180;
    const toLng = to.lng * Math.PI / 180;
    
    const y = Math.sin(toLng - fromLng) * Math.cos(toLat);
    const x = Math.cos(fromLat) * Math.sin(toLat) - 
              Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLng - fromLng);
    const heading = Math.atan2(y, x) * 180 / Math.PI;
    return (heading + 360) % 360;
  };

  const calculateBearing = (point1, point2) => {
    const lat1 = point1[0] * Math.PI / 180;
    const lat2 = point2[0] * Math.PI / 180;
    const lng1 = point1[1] * Math.PI / 180;
    const lng2 = point2[1] * Math.PI / 180;
    
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - 
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };

  const generateInstructionsFromCoordinates = (coordinates) => {
    if (!coordinates || coordinates.length < 2) return [];
    
    const instructions = [];
    
    instructions.push({
      point: coordinates[0],
      text: 'Start navigation and follow the route',
      type: 'depart',
      distance: 0,
      isStart: true
    });

    const totalDistance = getDistanceFromLatLng(
      coordinates[0][0], coordinates[0][1],
      coordinates[coordinates.length - 1][0], coordinates[coordinates.length - 1][1]
    );

    let accumulatedDistance = 0;
    
    for (let i = 1; i < coordinates.length - 1; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      const next = coordinates[i + 1];
      
      const segmentDistance = getDistanceFromLatLng(prev[0], prev[1], curr[0], curr[1]);
      accumulatedDistance += segmentDistance;
      
      const bearing1 = calculateBearing(prev, curr);
      const bearing2 = calculateBearing(curr, next);
      const angleDiff = Math.abs(bearing2 - bearing1);
      
      const shouldAddInstruction = angleDiff > 45 || 
                                  accumulatedDistance > 500 || 
                                  i % 20 === 0;

      if (shouldAddInstruction) {
        let instructionType = 'continue';
        let instructionText = 'Continue straight';
        
        if (angleDiff > 45 && angleDiff < 135) {
          if (bearing2 > bearing1) {
            instructionType = 'turn right';
            instructionText = 'Turn right';
          } else {
            instructionType = 'turn left';
            instructionText = 'Turn left';
          }
        } else if (angleDiff >= 135) {
          instructionType = 'uturn';
          instructionText = 'Make a U-turn';
        } else if (accumulatedDistance > 500) {
          instructionText = `Continue for ${Math.round(accumulatedDistance / 100) / 10} km`;
        }

        instructions.push({
          point: curr,
          text: instructionText,
          type: instructionType,
          distance: accumulatedDistance,
          isIntermediate: true
        });
        
        accumulatedDistance = 0;
      }
    }

    instructions.push({
      point: coordinates[coordinates.length - 1],
      text: 'You have reached your destination',
      type: 'arrive',
      distance: totalDistance,
      isDestination: true
    });

    return instructions;
  };

  const updateNavigationInstructions = (currentPosition) => {
    if (!selectedRoute?.coordinates) return;

    const instructions = selectedRoute.instructions || 
                       generateInstructionsFromCoordinates(selectedRoute.coordinates);

    if (instructions.length === 0) return;

    let closestStep = 0;
    let minDistance = Infinity;

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      const distance = getDistanceFromLatLng(
        currentPosition.lat, currentPosition.lng,
        instruction.point[0] || instruction.point.lat,
        instruction.point[1] || instruction.point.lng
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestStep = i;
      }
    }

    if (closestStep === instructions.length - 1 && minDistance > 100) {
      closestStep = Math.max(0, instructions.length - 2);
    }

    setCurrentStep(closestStep);

    let nextStep = null;
    if (closestStep < instructions.length - 1) {
      nextStep = instructions[closestStep + 1];
      
      if (nextStep.isDestination && minDistance > 50) {
        nextStep = instructions[closestStep];
      }
    } else {
      nextStep = instructions[closestStep];
    }

    if (nextStep) {
      const distanceToNextStep = getDistanceFromLatLng(
        currentPosition.lat, currentPosition.lng,
        nextStep.point[0] || nextStep.point.lat,
        nextStep.point[1] || nextStep.point.lng
      );

      // Update local state
      setDistanceToNext(distanceToNextStep);
      setNextInstruction(nextStep.text);

      // Call the callback to update parent component (NavigationPanel)
      if (onInstructionUpdate) {
        onInstructionUpdate(nextStep.text, distanceToNextStep);
      }

      if (voiceEnabled && !nextStep.isStart) {
        if (nextStep.isDestination) {
          if (distanceToNextStep < 25) {
            voiceService.speak('You have arrived at your destination');
          }
        } 
        else if (distanceToNextStep < 150) {
          const proximityInstruction = NavigationInstructionGenerator.getProximityInstruction(
            distanceToNextStep, 
            nextStep.type
          );
          
          if (proximityInstruction && distanceToNextStep < 80) {
            voiceService.speak(proximityInstruction);
          }

          if (distanceToNextStep < 100) {
            const voiceInstruction = NavigationInstructionGenerator.getInstruction(
              nextStep.type,
              distanceToNextStep,
              nextStep.text
            );
            voiceService.speak(voiceInstruction);
          }
        }
      }

      if (!hasStarted && !nextStep.isStart && distanceToNextStep < 1000) {
        setHasStarted(true);
        if (voiceEnabled) {
          voiceService.speak('Navigation started. Follow the route.');
        }
      }
    }
  };

  const smoothRotate = (targetHeading) => {
    setCurrentHeading(prev => {
      let diff = targetHeading - prev;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return prev + diff * 0.3;
    });
  };

  const updateMarkerRotation = () => {
    if (markerRef.current) {
      const newIcon = createNavigationIcon(navigationIconType, currentHeading);
      markerRef.current.setIcon(newIcon);
    }
  };

  useEffect(() => {
    if (!isActive) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (instructionCheckRef.current) {
        clearInterval(instructionCheckRef.current);
        instructionCheckRef.current = null;
      }
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      voiceService.cancel();
      previousPositionRef.current = null;
      setCurrentStep(0);
      setNextInstruction('Starting navigation...');
      setDistanceToNext(0);
      setHasStarted(false);
      
      // Notify parent that navigation has stopped
      if (onInstructionUpdate) {
        onInstructionUpdate('Navigation ended', 0);
      }
      return;
    }

    const initialIcon = createNavigationIcon(navigationIconType, currentHeading);
    markerRef.current = L.marker([0, 0], { 
      icon: initialIcon,
      zIndexOffset: 1000
    }).addTo(map);

    setNextInstruction('Starting navigation... Follow the route.');
    
    // Notify parent about initial instruction
    if (onInstructionUpdate) {
      onInstructionUpdate('Starting navigation... Follow the route.', 0);
    }
    
    if (voiceEnabled) {
      voiceService.speak('Navigation starting. Please follow the route.');
    }

    instructionCheckRef.current = setInterval(() => {
      if (previousPositionRef.current && selectedRoute) {
        updateNavigationInstructions(previousPositionRef.current);
      }
    }, 2000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed
        };

        let heading = newPosition.heading;
        if ((heading === null || heading === undefined) && previousPositionRef.current) {
          heading = calculateHeading(previousPositionRef.current, newPosition);
        }

        if (heading !== null && heading !== undefined) {
          smoothRotate(heading);
        }

        if (markerRef.current) {
          markerRef.current.setLatLng([newPosition.lat, newPosition.lng]);
        }

        map.flyTo([newPosition.lat, newPosition.lng], 16, {
          duration: 1,
          easeLinearity: 0.25
        });

        previousPositionRef.current = newPosition;
      },
      (error) => {
        console.error('Error watching position:', error);
        onStopNavigation();
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 2000
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (instructionCheckRef.current) {
        clearInterval(instructionCheckRef.current);
      }
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
      voiceService.cancel();
    };
  }, [isActive, map, navigationIconType, onStopNavigation, selectedRoute, voiceEnabled, onInstructionUpdate]);

  useEffect(() => {
    updateMarkerRotation();
  }, [currentHeading, navigationIconType]);

  // Return null since we're now using NavigationPanel for displaying instructions
  return null;
};



// Updated Routing Machine Component - Removed directions panel
// Updated Routing Machine Component
// Updated Routing Machine Component with better cleanup
const RoutingMachine = ({
  startPoint,
  endPoint,
  reports,
  onRoutesComputed,
  selectedRouteIndex,
  onRouteChange,
  isNavigating
}) => {
  const map = useMap();
  const routingControlRef = useRef(null);
  const routeLayersRef = useRef([]);
  const [previousSelectedIndex, setPreviousSelectedIndex] = useState(null);

  const extractInstructionsFromRoute = (route) => {
    if (!route) return [];
    
    const instructions = [];
    
    if (route.legs && route.legs[0] && route.legs[0].steps) {
      route.legs[0].steps.forEach((step, index) => {
        if (step.maneuver) {
          instructions.push({
            point: [step.maneuver.location[1], step.maneuver.location[0]],
            text: step.maneuver.instruction || `Step ${index + 1}`,
            type: step.maneuver.type || 'continue',
            distance: step.distance || 0
          });
        }
      });
    }
    
    if (instructions.length === 0 && route.coordinates) {
      console.log('No OSRM instructions found, will generate from coordinates');
    }
    
    return instructions;
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up routing machine...');
    
    // Remove all route layers
    routeLayersRef.current.forEach(layer => {
      if (layer && map.hasLayer(layer)) {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.log('Error removing layer:', e);
        }
      }
    });
    routeLayersRef.current = [];

    // Remove routing control
    if (routingControlRef.current) {
      try {
        routingControlRef.current.remove();
      } catch (e) {
        console.log('Error removing routing control:', e);
      }
      routingControlRef.current = null;
    }
  }, [map]);

  useEffect(() => {
    if (previousSelectedIndex !== null && previousSelectedIndex !== selectedRouteIndex && routeLayersRef.current[previousSelectedIndex]) {
      routeLayersRef.current[previousSelectedIndex].setStyle({
        dashArray: '10, 10',
        weight: 4,
        opacity: 0.6,
      });
    }

    if (routeLayersRef.current[selectedRouteIndex]) {
      routeLayersRef.current[selectedRouteIndex].setStyle({
        dashArray: null,
        weight: isNavigating ? 6 : 8,
        opacity: 1,
      });

      if (!isNavigating) {
        const bounds = routeLayersRef.current[selectedRouteIndex].getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    setPreviousSelectedIndex(selectedRouteIndex);
  }, [selectedRouteIndex, isNavigating, map]);

  useEffect(() => {
    console.log('RoutingMachine useEffect triggered', { startPoint, endPoint });
    
    // Clean up previous routes and controls immediately
    cleanup();
    onRoutesComputed([]); // Clear routes immediately

    if (!startPoint || !endPoint) {
      console.log('No start/end points, skipping route calculation');
      return;
    }

    console.log('Setting up new routing control...');

    const routeStyles = [
      { color: '#059669', name: 'Safest Route' },
      { color: '#2563eb', name: 'Alternative 1' },
      { color: '#dc2626', name: 'Alternative 2' },
      { color: '#7c3aed', name: 'Alternative 3' },
    ];

    try {
      const control = L.Routing.control({
        waypoints: [L.latLng(startPoint.lat, startPoint.lng), L.latLng(endPoint.lat, endPoint.lng)],
        router: new L.Routing.OSRMv1({
          serviceUrl: 'https://routing.openstreetmap.de/routed-car/route/v1',
        }),
        createMarker: () => null,
        showAlternatives: true,
        addWaypoints: false,
        fitSelectedRoutes: false,
        routeWhileDragging: false,
        show: false,
        lineOptions: { styles: [] },
        plan: new L.Routing.Plan([
          L.latLng(startPoint.lat, startPoint.lng),
          L.latLng(endPoint.lat, endPoint.lng)
        ], {
          createMarker: () => null,
          draggableWaypoints: false,
          addWaypoints: false,
        }),
      }).addTo(map);

      routingControlRef.current = control;

      control.on('routesfound', (e) => {
        console.log('Routes found:', e.routes.length);
        const newLayers = [];
        let routeData = e.routes.map((route, i) => {
          const nearReports = reports.filter(report => {
            const reportLocation = normalizeLocation(report.location);
            return isPointNearPolyline(reportLocation, route.coordinates);
          });

          const safetyScore = {
            danger: nearReports.filter(r => r.category === 'danger').length,
            caution: nearReports.filter(r => r.category === 'caution').length,
            safe: nearReports.filter(r => r.category === 'safe').length,
          };

          const overallSafetyScore = calculateSafetyScore(safetyScore);

          const instructions = extractInstructionsFromRoute(route);

          return {
            route: {
              ...route,
              instructions: instructions
            },
            index: i,
            safetyScore,
            overallSafetyScore,
          };
        });

        routeData.sort((a, b) => b.overallSafetyScore - a.overallSafetyScore);

        routeData = routeData.map((data, i) => {
          const style = routeStyles[i % routeStyles.length];
          const isSelected = i === selectedRouteIndex;

          const polyline = L.polyline(data.route.coordinates, {
            color: style.color,
            weight: isSelected ? 8 : 4,
            opacity: isSelected ? 1 : 0.6,
            dashArray: isSelected ? null : '10, 10',
            lineCap: 'round',
          }).addTo(map);

          if (isSelected && !isNavigating) {
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          }

          polyline.on('mouseover', () => {
            if (!isSelected) polyline.setStyle({ weight: 6, opacity: 1 });
          });

          polyline.on('mouseout', () => {
            if (!isSelected) polyline.setStyle({
              weight: 4,
              opacity: 0.6,
              dashArray: '10, 10'
            });
          });

          polyline.on('click', () => {
            if (!isNavigating) {
              onRouteChange(i);
            }
          });

          newLayers.push(polyline);

          return {
            ...data,
            name: i === 0 ? style.name : `Alternative ${i}`,
            summary: data.route.summary,
            color: style.color,
            isDashed: !isSelected,
          };
        });

        routeLayersRef.current = newLayers;
        onRoutesComputed(routeData);
      });

      control.on('routingerror', (e) => {
        console.error('Routing error:', e.error);
        onRoutesComputed([]);
      });

    } catch (error) {
      console.error('Error setting up routing control:', error);
      onRoutesComputed([]);
    }

    return () => {
      console.log('RoutingMachine cleanup');
      cleanup();
    };
  }, [startPoint, endPoint, reports, map, cleanup]); // Add cleanup to dependencies

  return null;
};

// Utility functions
const blendHex = (hex1, hex2, t) => {
  const h1 = hex1.replace('#', '');
  const h2 = hex2.replace('#', '');
  const r1 = parseInt(h1.substring(0, 2), 16), g1 = parseInt(h1.substring(2, 4), 16), b1 = parseInt(h1.substring(4, 6), 16);
  const r2 = parseInt(h2.substring(0, 2), 16), g2 = parseInt(h2.substring(2, 4), 16), b2 = parseInt(h2.substring(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const interpolateColor = (color1, color2, factor) => {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `rgb(${r}, ${g}, ${b})`;
};

const computeClusterColor = ({ dangerCount, cautionCount, safeCount }) => {
  const total = dangerCount + cautionCount + safeCount;
  if (total === 0) return '#22c55e';

  const dangerRatio = dangerCount / total;
  const cautionRatio = cautionCount / total;

  const dangerWeight = dangerRatio * 6;
  const cautionWeight = cautionRatio * 3;

  const intensity = Math.min(1, (dangerWeight + cautionWeight) / 3);

  if (intensity <= 0.33) {
    return interpolateColor('#22c55e', '#facc15', intensity / 0.33);
  } else {
    return interpolateColor('#facc15', '#ef4444', (intensity - 0.33) / 0.67);
  }
};

// Clustered Reports Layer
const ClusteredReportsLayer = ({ reports }) => {
  const map = useMap();
  const markerGroupRef = useRef(L.layerGroup());
  const zoomRef = useRef(map.getZoom());
  const ZOOM_SWITCH = 13;

  useEffect(() => {
    const group = markerGroupRef.current;
    if (!map.hasLayer(group)) map.addLayer(group);

    const onZoomEnd = () => {
      zoomRef.current = map.getZoom();
      updateVisualization();
    };

    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
      if (map.hasLayer(group)) map.removeLayer(group);
    };
  }, [map]);

  const clearGroup = () => {
    markerGroupRef.current.clearLayers();
  };

  const buildClusters = (clusterRadiusMeters) => {
    const clusters = [];
    for (const r of reports) {
      const cat = (r.category || r.severity || '').toLowerCase();
      const [lat, lng] = normalizeLocation(r.location || { lat: r.latitude, lng: r.longitude });
      if (isNaN(lat) || isNaN(lng)) continue;

      let found = null;
      for (const c of clusters) {
        const dist = getDistanceFromLatLng(c.lat, c.lng, lat, lng);
        if (dist < clusterRadiusMeters) { found = c; break; }
      }

      if (found) {
        found.reports.push({ ...r, category: cat });
        found.lat = (found.lat * (found.reports.length - 1) + lat) / found.reports.length;
        found.lng = (found.lng * (found.reports.length - 1) + lng) / found.reports.length;
      } else {
        clusters.push({ lat, lng, reports: [{ ...r, category: cat }] });
      }
    }
    return clusters;
  };

  const updateVisualization = () => {
    if (!Array.isArray(reports) || reports.length === 0) return;
    clearGroup();

    const zoom = zoomRef.current;
    const clusterRadius = zoom < 10 ? 4000 : zoom < 12 ? 2000 : zoom < 14 ? 900 : 300;
    const clusters = buildClusters(clusterRadius);
    const showIndividual = zoom >= ZOOM_SWITCH;

    if (showIndividual) {
      for (const c of clusters) {
        for (const r of c.reports) {
          const cat = (r.category || r.severity || 'safe').toLowerCase();
          const [lat, lng] = normalizeLocation(r.location || { lat: r.latitude, lng: r.longitude });
          const color = cat === 'danger' ? '#ef4444' : cat === 'caution' ? '#facc15' : '#22c55e';
          const marker = L.circleMarker([lat, lng], {
            radius: 5,
            color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 1,
          }).bindPopup(`
            <div style="color:#111">
              <b>Category:</b> ${cat}<br/>
              ${r.title ? `<b>Title:</b> ${r.title}<br/>` : ''}
              ${r.description ? `<small>${r.description}</small>` : ''}
            </div>
          `);
          markerGroupRef.current.addLayer(marker);
        }
      }
    } else {
      for (const c of clusters) {
        const dangerCount = c.reports.filter(r => (r.category || '').toLowerCase() === 'danger').length;
        const cautionCount = c.reports.filter(r => (r.category || '').toLowerCase() === 'caution').length;
        const safeCount = c.reports.filter(r => (r.category || '').toLowerCase() === 'safe').length;

        const color = computeClusterColor({ dangerCount, cautionCount, safeCount });
        const radius = 200 + Math.sqrt(c.reports.length) * 60;

        const circle = L.circle([c.lat, c.lng], {
          color,
          fillColor: color,
          fillOpacity: 0.35,
          radius,
          weight: 1,
        }).bindPopup(`
          <div style="color:#111">
            <b>${c.reports.length} reports</b><br/>
            🔴 Danger: ${dangerCount}<br/>
            🟡 Caution: ${cautionCount}<br/>
            🟢 Safe: ${safeCount}
          </div>
        `);

        circle.on('click', () => {
          map.setView([c.lat, c.lng], Math.min(map.getZoom() + 2, 18), { animate: true });
        });

        markerGroupRef.current.addLayer(circle);
      }
    }
  };

  useEffect(() => {
    updateVisualization();
  }, [reports]);

  return null;
};

const UserLocationMarker = ({ position, isNavigating }) => {
  const map = useMap();

  useEffect(() => {
    if (!position) return;

    if (isNavigating) return;

    const marker = L.circleMarker(position, {
      radius: 8,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.8,
    }).addTo(map);

    if (!isNavigating) {
      map.setView(position, 13);
    }

    return () => map.removeLayer(marker);
  }, [position, isNavigating]);

  return null;
};

const RouteSafetyPanel = ({ routes, visible, onToggle, selectedRouteIndex, onRouteSelect, isNavigating }) => {
  if (!visible) {
    return (
      <button
        onClick={onToggle}
        className="absolute bottom-4 left-4 bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg z-[999] hover:bg-blue-700 transition-colors text-sm"
      >
        Routes
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 bg-gray-800 rounded-lg shadow-xl p-3 w-72 max-w-[85vw] z-[999] text-gray-100">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-semibold">Routes</h2>
        <button onClick={onToggle} className="text-blue-400 text-sm hover:text-blue-300">
          ×
        </button>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {routes.map((route, index) => (
          <div
            key={index}
            className={`p-2 rounded border text-sm cursor-pointer transition-colors ${
              selectedRouteIndex === index
                ? 'bg-gray-700 border-blue-500'
                : 'border-gray-600 hover:bg-gray-700'
            } ${isNavigating && selectedRouteIndex !== index ? 'opacity-40' : ''}`}
            onClick={() => !isNavigating && onRouteSelect(index)}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-12 h-1.5 rounded"
                  style={{ 
                    background: route.isDashed ? `repeating-linear-gradient(90deg, ${route.color}, ${route.color} 2px, transparent 2px, transparent 4px)` : route.color 
                  }}
                />
                <span className="font-medium">{route.name}</span>
              </div>
              {selectedRouteIndex === index && (
                <span className="text-blue-400 text-xs">{isNavigating ? '→' : '✓'}</span>
              )}
            </div>

            <div className="flex justify-between items-center text-xs">
              <span>{(route.summary.totalDistance / 1000).toFixed(1)}km</span>
              <span>{(route.summary.totalTime / 60).toFixed(0)}min</span>
              <span className="font-semibold">{Math.round(route.overallSafetyScore)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Header = ({ onToggle }) => (
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-lg font-semibold text-white">Safe Routes</h2>
    <button onClick={onToggle} className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
      Hide
    </button>
  </div>
);

const RouteCard = ({ route, index, isSelected, isNavigating, onSelect }) => {
  const safetyLabel = getSafetyLabel(route.overallSafetyScore);
  
  return (
    <div
      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
        isSelected ? 'bg-gray-700 border-blue-500' : 'hover:bg-gray-700 border-gray-600'
      } ${isNavigating && !isSelected ? 'opacity-50' : ''}`}
      onClick={() => !isNavigating && onSelect(index)}
    >
      <RouteHeader route={route} isSelected={isSelected} isNavigating={isNavigating} />
      
      <div className="grid grid-cols-2 gap-2 mb-2">
        <RouteInfo summary={route.summary} />
        <SafetyScore overallSafetyScore={route.overallSafetyScore} safetyLabel={safetyLabel} />
      </div>

      <SafetyBreakdown safetyScore={route.safetyScore} />
    </div>
  );
};

const RouteHeader = ({ route, isSelected, isNavigating }) => (
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      <RouteLine route={route} />
      <span className="font-medium text-gray-200">{route.name}</span>
    </div>
    {isSelected && (
      <span className="text-blue-400 text-sm">
        {isNavigating ? 'Navigating' : 'Selected'}
      </span>
    )}
  </div>
);

const RouteLine = ({ route }) => (
  <span
    className={`inline-block w-16 h-2 rounded ${route.isDashed ? 'border-t-2' : ''}`}
    style={{
      backgroundColor: route.isDashed ? 'transparent' : route.color,
      borderColor: route.isDashed ? route.color : 'transparent',
    }}
  />
);

const RouteInfo = ({ summary }) => (
  <div className="text-sm text-gray-400">
    <div>Distance: {(summary.totalDistance / 1000).toFixed(2)} km</div>
    <div>Duration: {(summary.totalTime / 60).toFixed(1)} min</div>
  </div>
);

const SafetyScore = ({ overallSafetyScore, safetyLabel }) => (
  <div className="text-right">
    <div className="text-lg font-semibold text-white">{Math.round(overallSafetyScore)}</div>
    <div className={`text-sm ${safetyLabel.color}`}>{safetyLabel.text}</div>
  </div>
);

const SafetyBreakdown = ({ safetyScore }) => (
  <div className="grid grid-cols-3 gap-2 text-sm">
    <SafetyMetric value={safetyScore.danger} label="Danger" color="red" />
    <SafetyMetric value={safetyScore.caution} label="Caution" color="yellow" />
    <SafetyMetric value={safetyScore.safe} label="Safe" color="green" />
  </div>
);

const SafetyMetric = ({ value, label, color }) => (
  <div className={`flex flex-col items-center p-2 bg-${color}-900/30 rounded`}>
    <span className={`text-${color}-400 font-semibold`}>{value}</span>
    <span className="text-xs text-gray-400">{label}</span>
  </div>
);

const calculateSafetyScore = (safetyScore) => {
  const weights = {
    danger: 3,
    caution: 2,
    safe: 1
  };

  const weightedSum =
    (safetyScore.danger || 0) * weights.danger +
    (safetyScore.caution || 0) * weights.caution -
    (safetyScore.safe || 0) * weights.safe;

  const maxScore = Math.max(weightedSum, 0);
  const score = Math.max(0, Math.min(100, 100 - (maxScore * 10)));

  return score;
};

const getSafetyLabel = (score) => {
  if (score >= 80) return { text: 'Very Safe', color: 'text-green-400' };
  if (score >= 60) return { text: 'Safe', color: 'text-green-500' };
  if (score >= 40) return { text: 'Moderate', color: 'text-yellow-500' };
  if (score >= 20) return { text: 'Caution', color: 'text-orange-500' };
  return { text: 'High Risk', color: 'text-red-500' };
};

// Main Map Component
// Main Map Component
const Map = ({ startPoint, endPoint }) => {
  const [userLocation, setUserLocation] = useState([28.6139, 77.209]);
  const [reports, setReports] = useState([]);
  const [routeSafetyInfo, setRouteSafetyInfo] = useState([]);
  const [panelVisible, setPanelVisible] = useState(true);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationIconType, setNavigationIconType] = useState('car');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [nextInstruction, setNextInstruction] = useState('Starting navigation...');
  const [distanceToNext, setDistanceToNext] = useState(0);
  const [navigationStopped, setNavigationStopped] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  // Clear routes when start/end points change
  useEffect(() => {
    console.log('Start/end points changed, clearing routes...', { startPoint, endPoint });
    setRouteSafetyInfo([]);
    setSelectedRouteIndex(0);
    setIsNavigating(false);
    setNavigationStopped(false);
    setPanelVisible(true);
    setNextInstruction('Starting navigation...');
    setDistanceToNext(0);
    
    // Force map re-render by changing key
    setMapKey(prev => prev + 1);
  }, [startPoint, endPoint]);

  // Handle routes computed
  const handleRoutesComputed = useCallback((routes) => {
    console.log('Routes computed in parent:', routes.length);
    setRouteSafetyInfo(routes);
    
    if (routes.length > 0) {
      setNavigationStopped(false);
    }
  }, []);

  useEffect(() => {
    // Dispatch custom event when navigation state changes
    const event = new CustomEvent('navigationStateChange', {
      detail: { isNavigating }
    });
    window.dispatchEvent(event);
  }, [isNavigating]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    let ignore = false;
    const fetchReports = async () => {
      try {
        const res = await fetch(`${base_url}/api/reports`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!ignore) setReports(Array.isArray(json) ? json : []);
      } catch (e) {
        console.error('Failed to fetch reports:', e);
      }
    };
    fetchReports();

    const id = setInterval(fetchReports, 30000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, []);

  const handleStartNavigation = () => {
    if (voiceEnabled && voiceService.isSupported()) {
      voiceService.speak('Starting navigation. Please follow the route.');
    } else if (voiceEnabled) {
      console.warn('Voice synthesis not supported in this browser');
    }
    
    setIsNavigating(true);
    setPanelVisible(false);
    setNavigationStopped(false);
  };

  const handleStopNavigation = () => {
    if (voiceEnabled) {
      voiceService.speak('Navigation ended.');
    }
    voiceService.cancel();
    setIsNavigating(false);
    setPanelVisible(true);
    setNavigationStopped(true);
    setNextInstruction('Navigation ended');
    setDistanceToNext(0);
  };

  const handleVoiceToggle = () => {
    const newVoiceEnabled = !voiceEnabled;
    setVoiceEnabled(newVoiceEnabled);
    voiceService.setEnabled(newVoiceEnabled);
    
    if (newVoiceEnabled && isNavigating) {
      voiceService.speak('Voice guidance enabled');
    }
  };

  const selectedRoute = routeSafetyInfo[selectedRouteIndex]?.route;

  return (
    <div className="relative w-full h-full bg-[#1E1E1E]">
      <MapContainer
        key={mapKey} // Force re-render when key changes
        center={userLocation}
        zoom={13}
        className="h-[calc(100vh-4rem)] w-full z-0"
        preferCanvas={true}
        style={{ background: '#111' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />

        <UserLocationMarker position={userLocation} isNavigating={isNavigating} />

        <ClusteredReportsLayer reports={reports} />

        {startPoint && <Marker position={[startPoint.lat, startPoint.lng]} icon={blueIcon}><Popup className="dark-popup">Start Point</Popup></Marker>}
        {endPoint && <Marker position={[endPoint.lat, endPoint.lng]} icon={redIcon}><Popup className="dark-popup">End Point</Popup></Marker>}

        {startPoint && endPoint && (
          <RoutingMachine
            startPoint={startPoint}
            endPoint={endPoint}
            reports={reports}
            onRoutesComputed={handleRoutesComputed}
            selectedRouteIndex={selectedRouteIndex}
            onRouteChange={setSelectedRouteIndex}
            isNavigating={isNavigating}
          />
        )}

        {isNavigating && (
          <RealTimeNavigation
            isActive={isNavigating}
            onStopNavigation={handleStopNavigation}
            selectedRoute={selectedRoute}
            navigationIconType={navigationIconType}
            voiceEnabled={voiceEnabled}
            onInstructionUpdate={(instruction, distance) => {
              setNextInstruction(instruction);
              setDistanceToNext(distance);
            }}
          />
        )}
      </MapContainer>

      {routeSafetyInfo.length > 0 && (
        <RouteSafetyPanel
          routes={routeSafetyInfo}
          visible={panelVisible}
          onToggle={() => setPanelVisible(prev => !prev)}
          selectedRouteIndex={selectedRouteIndex}
          onRouteSelect={setSelectedRouteIndex}
          isNavigating={isNavigating}
        />
      )}

      {routeSafetyInfo.length > 0 && selectedRoute && (
        <>
          {!isNavigating && !navigationStopped && (
            <RouteSelectionPanel
              selectedRoute={routeSafetyInfo[selectedRouteIndex]}
              onStartNavigation={handleStartNavigation}
              voiceEnabled={voiceEnabled}
              onVoiceToggle={handleVoiceToggle}
            />
          )}
          
          {isNavigating && (
            <NavigationPanel
              isNavigating={isNavigating}
              onStopNavigation={handleStopNavigation}
              selectedRoute={routeSafetyInfo[selectedRouteIndex]}
              voiceEnabled={voiceEnabled}
              onVoiceToggle={handleVoiceToggle}
              nextInstruction={nextInstruction}
              distanceToNext={distanceToNext}
            />
          )}
        </>
      )}

      {!voiceService.isSupported() && (
        <div className="absolute bottom-20 right-4 bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm z-[999]">
          Voice guidance not supported in this browser
        </div>
      )}
    </div>
  );
};

export default Map;