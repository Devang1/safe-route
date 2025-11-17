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
const base_url = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
    this.isSpeaking = false;
    
    console.log('VoiceService initialized - Supported:', this.isSupported());
  }

  isSupported() {
    const supported = 'speechSynthesis' in window;
    console.log('Speech synthesis supported:', supported);
    return supported;
  }

  speak(instruction, force = false) {
    if (!this.isEnabled) {
      console.log('Voice disabled, skipping:', instruction);
      return;
    }
    
    if (!this.isSupported()) {
      console.warn('Speech synthesis not supported');
      return;
    }

    const now = Date.now();
    if (!force && instruction === this.lastInstruction && (now - this.lastSpokeTime) < 5000) {
      console.log('Skipping duplicate instruction:', instruction);
      return;
    }

    this.cancel();

    console.log('Speaking instruction:', instruction);

    try {
      this.utterance = new SpeechSynthesisUtterance(instruction);
      this.utterance.rate = 0.9;
      this.utterance.pitch = 1.0;
      this.utterance.volume = 0.8;

      this.utterance.onstart = () => {
        this.isSpeaking = true;
        console.log('Speech started:', instruction);
      };

      this.utterance.onend = () => {
        this.isSpeaking = false;
        this.lastInstruction = instruction;
        this.lastSpokeTime = Date.now();
        console.log('Speech ended:', instruction);
      };

      this.utterance.onerror = (event) => {
        this.isSpeaking = false;
        console.error('Speech synthesis error:', event.error, 'for instruction:', instruction);
      };

      this.synth.speak(this.utterance);
      
    } catch (error) {
      console.error('Error in speech synthesis:', error);
    }
  }

  cancel() {
    if (this.synth.speaking) {
      console.log('Cancelling ongoing speech');
      this.synth.cancel();
    }
    this.isSpeaking = false;
  }

  setEnabled(enabled) {
    console.log('Setting voice enabled:', enabled);
    this.isEnabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  testVoice() {
    console.log('Testing voice...');
    this.speak('Voice guidance test. If you can hear this, voice is working properly.', true);
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

// *** NEW FUNCTION ***
const getRouteSegments = (coordinates, reports) => {
  const segments = [];
  const chunkSize = 10;
  const tolerance = 200; // 200 meters

  for (let i = 0; i < coordinates.length - 1; i += chunkSize) {
    const end = Math.min(i + chunkSize + 1, coordinates.length);
    const segmentCoords = coordinates.slice(i, end);

    if (segmentCoords.length < 2) continue;

    let danger = 0;
    let caution = 0;
    let safe = 0;

    for (const report of reports) {
      const reportLoc = normalizeLocation(report.location);
      if (isPointNearPolyline(reportLoc, segmentCoords, tolerance)) {
        const cat = (report.category || '').toLowerCase();
        if (cat === 'danger') danger++;
        else if (cat === 'caution') caution++;
        else if (cat === 'safe') safe++;
      }
    }

    let color = null; // null means use the default route color
    if (danger > 0) {
      color = '#ef4444'; // Red for Danger
    } else if (caution > 0) {
      color = '#facc15'; // Yellow for Caution
    } else if (safe > 0) {
      color = '#22c55e'; // Green for Safe
    }

    segments.push({
      coordinates: segmentCoords,
      color: color,
    });
  }
  return segments;
};


// Route Selection Panel
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
  distanceToNext,
  distanceLeft, 
  timeRemaining 
}) => {
  if (!selectedRoute || !isNavigating) return null;

  const testVoice = () => {
    console.log('Manual voice test triggered');
    voiceService.testVoice();
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };

  const formatTime = (seconds) => {
    if (seconds < 60) {
      return '<1 min';
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)} min`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 bg-gray-800 rounded-lg shadow-xl p-3 z-[1000] text-white max-w-2xl mx-auto">
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

      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <div className="text-gray-400 text-xs">Distance Left</div>
              <div className="font-semibold">{formatDistance(distanceLeft)}</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400 text-xs">Time Remaining</div>
              <div className="font-semibold">{formatTime(timeRemaining)}</div>
            </div>
          </div>
          
          <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ 
                width: `${Math.min(100, Math.max(0, (selectedRoute?.summary?.totalDistance ? 
                  ((selectedRoute.summary.totalDistance - distanceLeft) / selectedRoute.summary.totalDistance) * 100 : 0)))}%` 
              }}
            ></div>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs text-gray-400">
              <div>Voice: {voiceEnabled ? 'ENABLED' : 'DISABLED'}</div>
              <div>Next: "{nextInstruction}"</div>
              <div>Next in: {Math.round(distanceToNext)}m</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
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
const calculateBearing = (point1, point2) => {
  const lat1 = typeof point1[0] === 'number' ? point1[0] : parseFloat(point1[0]);
  const lng1 = typeof point1[1] === 'number' ? point1[1] : parseFloat(point1[1]);
  const lat2 = typeof point2[0] === 'number' ? point2[0] : parseFloat(point2[0]);
  const lng2 = typeof point2[1] === 'number' ? point2[1] : parseFloat(point2[1]);
  
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  
  return (θ * 180 / Math.PI + 360) % 360;
};

const generateInstructionsFromCoordinates = (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    console.warn('Insufficient coordinates for instructions');
    return [];
  }

  console.log('Generating instructions from', coordinates.length, 'coordinates');
  
  const instructions = [];
  
  const startCoord = Array.isArray(coordinates[0]) ? coordinates[0] : [coordinates[0].lat, coordinates[0].lng];
  instructions.push({
    point: startCoord,
    text: 'Start navigation and follow the route',
    type: 'depart',
    distance: 0,
    isStart: true
  });

  let accumulatedDistance = 0;
  let lastInstructionIndex = 0;
  
  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const current = Array.isArray(coordinates[i]) ? coordinates[i] : [coordinates[i].lat, coordinates[i].lng];
    const next = Array.isArray(coordinates[i + 1]) ? coordinates[i + 1] : [coordinates[i + 1].lat, coordinates[i + 1].lng];
    totalDistance += getDistanceFromLatLng(current[0], current[1], next[0], next[1]);
  }

  console.log('Total route distance:', totalDistance, 'meters');
  
  for (let i = 1; i < coordinates.length - 1; i++) {
    const prev = Array.isArray(coordinates[i - 1]) ? coordinates[i - 1] : [coordinates[i - 1].lat, coordinates[i - 1].lng];
    const curr = Array.isArray(coordinates[i]) ? coordinates[i] : [coordinates[i].lat, coordinates[i].lng];
    const next = Array.isArray(coordinates[i + 1]) ? coordinates[i + 1] : [coordinates[i + 1].lat, coordinates[i + 1].lng];
    
    const segmentDistance = getDistanceFromLatLng(prev[0], prev[1], curr[0], curr[1]);
    
    if (!isNaN(segmentDistance) && isFinite(segmentDistance)) {
      accumulatedDistance += segmentDistance;
    } else {
      console.warn('Invalid segment distance at index', i, ':', segmentDistance);
      continue; 
    }
    
    const bearing1 = calculateBearing(prev, curr);
    const bearing2 = calculateBearing(curr, next);
    
    let angleDiff = Math.abs(bearing2 - bearing1);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    
    const shouldAddInstruction = 
      angleDiff > 25 || 
      accumulatedDistance > 300 || 
      (i - lastInstructionIndex) > 15 || 
      i === Math.floor(coordinates.length / 2); 

    if (shouldAddInstruction) {
      let instructionType = 'continue';
      let instructionText = 'Continue straight';
      
      if (angleDiff > 25 && angleDiff < 120) {
        let turnDirection = ((bearing2 - bearing1 + 360) % 360);
        if (turnDirection > 180) turnDirection -= 360;
        
        if (turnDirection > 0) {
          instructionType = angleDiff > 60 ? 'turn right' : 'bear right';
          instructionText = angleDiff > 60 ? 'Turn right' : 'Bear right';
        } else {
          instructionType = angleDiff > 60 ? 'turn left' : 'bear left';
          instructionText = angleDiff > 60 ? 'Turn left' : 'Bear left';
        }
      } else if (angleDiff >= 120) {
        instructionType = 'turn around';
        instructionText = 'Make a U-turn';
      } else if (accumulatedDistance > 300) {
        const distanceText = accumulatedDistance < 1000 ? 
          `${Math.round(accumulatedDistance)} meters` : 
          `${(accumulatedDistance / 1000).toFixed(1)} kilometers`;
        instructionText = `Continue for ${distanceText}`;
      }

      instructions.push({
        point: curr,
        text: instructionText,
        type: instructionType,
        distance: accumulatedDistance,
        isIntermediate: true
      });
      
      accumulatedDistance = 0;
      lastInstructionIndex = i;
    }
  }

  const destCoord = Array.isArray(coordinates[coordinates.length - 1]) ? 
    coordinates[coordinates.length - 1] : 
    [coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lng];
    
  instructions.push({
    point: destCoord,
    text: 'You have reached your destination',
    type: 'arrive',
    distance: totalDistance,
    isDestination: true
  });

  console.log('Generated', instructions.length, 'instructions:', instructions);
  return instructions;
};

// *** UPDATED COMPONENT ***
const RealTimeNavigation = ({ 
  isActive, 
  onStopNavigation, 
  selectedRoute,
  reports, // <-- NEW PROP
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
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  
  const [routeInstructions, setRouteInstructions] = useState([]);
  const [routeProgress, setRouteProgress] = useState({
    distanceLeft: 0,
    timeRemaining: 0,
    progressPercentage: 0
  });

  // *** NEW: Refs to prevent stale closures in callbacks ***
  const reportsRef = useRef(reports);
  const voiceEnabledRef = useRef(voiceEnabled);
  const activeZoneAlertRef = useRef(null); // Tracks { reportId: string, stage: 'approaching' | 'entered' }

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);


  const calculateTotalRouteDistance = useCallback((coordinates) => {
    if (!coordinates || coordinates.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const current = Array.isArray(coordinates[i]) ? coordinates[i] : [coordinates[i].lat, coordinates[i].lng];
      const next = Array.isArray(coordinates[i + 1]) ? coordinates[i + 1] : [coordinates[i + 1].lat, coordinates[i + 1].lng];
      total += getDistanceFromLatLng(current[0], current[1], next[0], next[1]);
    }
    return total;
  }, []);

  const calculateEstimatedTime = useCallback((distance) => {
    const averageSpeedKmh = 40;
    const averageSpeedMs = (averageSpeedKmh * 1000) / 3600;
    return Math.max(0, distance / averageSpeedMs);
  }, []);

  const calculateRemainingRoute = useCallback((currentPosition, coordinates) => {
    if (!coordinates || coordinates.length < 2) return { distance: 0, time: 0 };
    
    let remainingDistance = 0;
    let closestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < coordinates.length; i++) {
      const point = Array.isArray(coordinates[i]) ? coordinates[i] : [coordinates[i].lat, coordinates[i].lng];
      const distance = getDistanceFromLatLng(
        currentPosition.lat, currentPosition.lng,
        point[0], point[1]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    for (let i = closestIndex; i < coordinates.length - 1; i++) {
      const current = Array.isArray(coordinates[i]) ? coordinates[i] : [coordinates[i].lat, coordinates[i].lng];
      const next = Array.isArray(coordinates[i + 1]) ? coordinates[i + 1] : [coordinates[i + 1].lat, coordinates[i + 1].lng];
      remainingDistance += getDistanceFromLatLng(current[0], current[1], next[0], next[1]);
    }
    
    remainingDistance += minDistance;
    
    const remainingTime = calculateEstimatedTime(remainingDistance);
    
    return {
      distance: remainingDistance,
      time: remainingTime
    };
  }, [calculateEstimatedTime]);

  useEffect(() => {
    if (selectedRoute?.coordinates) {
      console.log('Generating instructions for new route...');
      const instructions = selectedRoute.instructions || 
                           generateInstructionsFromCoordinates(selectedRoute.coordinates);
      setRouteInstructions(instructions);
      console.log('Instructions generated:', instructions.length);
      
      const totalDistance = selectedRoute.summary?.totalDistance || 
                            calculateTotalRouteDistance(selectedRoute.coordinates);
      const totalTime = selectedRoute.summary?.totalTime || 
                        calculateEstimatedTime(totalDistance);
      
      setRouteProgress({
        distanceLeft: totalDistance,
        timeRemaining: totalTime,
        progressPercentage: 0
      });
      
      if (instructions.length > 0 && onInstructionUpdate) {
        onInstructionUpdate(instructions[0].text, 0, totalDistance, totalTime);
      }
    }
  }, [selectedRoute, onInstructionUpdate, calculateTotalRouteDistance, calculateEstimatedTime]);

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

  // *** NEW FUNCTION for Zone Alerts ***
  const checkZoneAlerts = (currentPosition) => {
    if (!voiceEnabledRef.current) return;
    const reports = reportsRef.current;
    if (!reports || reports.length === 0) return;

    const ENTRY_THRESHOLD = 50; // meters
    const APPROACH_THRESHOLD = 200; // meters

    let closestDanger = { distance: Infinity, report: null };
    let closestCaution = { distance: Infinity, report: null };

    for (const report of reports) {
      const cat = (report.category || '').toLowerCase();
      if (cat !== 'danger' && cat !== 'caution') continue;

      const [lat, lng] = normalizeLocation(report.location);
      if (isNaN(lat) || isNaN(lng)) continue;

      const distance = getDistanceFromLatLng(currentPosition.lat, currentPosition.lng, lat, lng);

      if (cat === 'danger' && distance < closestDanger.distance) {
        closestDanger = { distance, report };
      } else if (cat === 'caution' && distance < closestCaution.distance) {
        closestCaution = { distance, report };
      }
    }

    // Prioritize Danger over Caution
    let targetZone = null;
    if (closestDanger.distance <= APPROACH_THRESHOLD) {
      targetZone = { ...closestDanger, category: 'danger' };
    } else if (closestCaution.distance <= APPROACH_THRESHOLD) {
      targetZone = { ...closestCaution, category: 'caution' };
    }

    const activeAlert = activeZoneAlertRef.current;

    if (targetZone) {
      const { distance, report, category } = targetZone;
      // Use a combination of lat/lng as a fallback ID
      const reportId = report._id || `${report.location.lat},${report.location.lng}`;

      // 1. Approaching Zone
      if (distance > ENTRY_THRESHOLD && distance <= APPROACH_THRESHOLD) {
        // Only alert if not already alerted for this report
        if (!activeAlert || activeAlert.reportId !== reportId) {
          const roundedDistance = Math.round(distance / 50) * 50; // e.g., 200, 150, 100
          voiceService.speak(`You are approaching a ${category} zone in ${roundedDistance} meters.`);
          activeZoneAlertRef.current = { reportId: reportId, stage: 'approaching' };
        }
      }
      // 2. Entered Zone
      else if (distance <= ENTRY_THRESHOLD) {
        // Only alert if not already alerted for "entered" stage
        if (!activeAlert || activeAlert.reportId !== reportId || activeAlert.stage !== 'entered') {
          voiceService.speak(`You are now in a ${category} zone. Please be cautious.`);
          activeZoneAlertRef.current = { reportId: reportId, stage: 'entered' };
        }
      }
    }
    // 3. Left Zone
    else if (activeAlert) {
      // User is no longer near any zone, and we were tracking an alert
      activeZoneAlertRef.current = null;
    }
  };


  const updateNavigationInstructions = (currentPosition) => {
    if (routeInstructions.length === 0 || !selectedRoute?.coordinates) {
      console.log('No instructions or coordinates available yet');
      return;
    }

    // *** NEW: Check for zone alerts on every update ***
    checkZoneAlerts(currentPosition);

    const remaining = calculateRemainingRoute(currentPosition, selectedRoute.coordinates);
    const totalDistance = selectedRoute.summary?.totalDistance || 
                            calculateTotalRouteDistance(selectedRoute.coordinates);
    const progressPercentage = totalDistance > 0 ? 
                                 Math.max(0, Math.min(100, ((totalDistance - remaining.distance) / totalDistance) * 100)) : 0;

    setRouteProgress({
      distanceLeft: remaining.distance,
      timeRemaining: remaining.time,
      progressPercentage: progressPercentage
    });

    let closestStep = 0;
    let minDistance = Infinity;

    for (let i = 0; i < routeInstructions.length; i++) {
      const instruction = routeInstructions[i];
      const instructionPoint = instruction.point;
      
      const distance = getDistanceFromLatLng(
        currentPosition.lat, currentPosition.lng,
        instructionPoint[0], instructionPoint[1]
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestStep = i;
      }
    }

    if (closestStep === routeInstructions.length - 1 && minDistance > 100) {
      closestStep = Math.max(0, routeInstructions.length - 2);
    }

    setCurrentStep(closestStep);

    let nextStep = null;
    let distanceToNextStep = 0;

    if (closestStep < routeInstructions.length - 1) {
      nextStep = routeInstructions[closestStep + 1];
      const nextStepPoint = nextStep.point;
      
      distanceToNextStep = getDistanceFromLatLng(
        currentPosition.lat, currentPosition.lng,
        nextStepPoint[0], nextStepPoint[1]
      );

      if (nextStep.isDestination && distanceToNextStep < 50) {
        nextStep = routeInstructions[routeInstructions.length - 1];
      }
    } else {
      nextStep = routeInstructions[closestStep];
      distanceToNextStep = minDistance;
    }

    if (nextStep && onInstructionUpdate) {
      console.log('Updating instruction:', nextStep.text, 'Distance to next:', distanceToNextStep);
      console.log('Route progress - Distance left:', Math.round(remaining.distance), 'm, Time remaining:', Math.round(remaining.time), 's');
      
      onInstructionUpdate(
        nextStep.text, 
        distanceToNextStep, 
        remaining.distance, 
        remaining.time
      );

      // *** UPDATED: Use voiceEnabledRef.current to avoid stale prop ***
      if (voiceEnabledRef.current && !nextStep.isStart) {
        console.log('Voice enabled, checking if should speak...');
        
        if (nextStep.isDestination) {
          if (distanceToNextStep < 25) {
            console.log('Speaking arrival instruction');
            voiceService.speak('You have arrived at your destination', true);
          }
        } 
        else {
          if (distanceToNextStep < 80) {
            const proximityInstruction = NavigationInstructionGenerator.getProximityInstruction(
              distanceToNextStep, 
              nextStep.type
            );
            
            if (proximityInstruction) {
              console.log('Speaking proximity instruction:', proximityInstruction);
              voiceService.speak(proximityInstruction);
            }
          }

          if (distanceToNextStep < 150 && 
              (nextStep.type.includes('turn') || 
               nextStep.type.includes('merge') || 
               nextStep.type.includes('roundabout') ||
               nextStep.type.includes('fork'))) {
            
            const voiceInstruction = NavigationInstructionGenerator.getInstruction(
              nextStep.type,
              distanceToNextStep,
              '' // Road name if available
            );
            
            console.log('Speaking main instruction:', voiceInstruction);
            voiceService.speak(voiceInstruction);
          }
        }
      }

      if (!hasStarted && !nextStep.isStart && distanceToNextStep < 1000) {
        setHasStarted(true);
        // *** UPDATED: Use voiceEnabledRef.current ***
        if (voiceEnabledRef.current) {
          console.log('Navigation started, speaking welcome message');
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
      console.log('RealTimeNavigation deactivating...');
      
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
      activeZoneAlertRef.current = null; // Clear zone alert
      setCurrentStep(0);
      setHasStarted(false);
      setRouteInstructions([]);
      setRouteProgress({
        distanceLeft: 0,
        timeRemaining: 0,
        progressPercentage: 0
      });
      
      if (onInstructionUpdate) {
        onInstructionUpdate('Navigation ended', 0, 0, 0);
      }
      return;
    }

    console.log('RealTimeNavigation activating...');

    const initialIcon = createNavigationIcon(navigationIconType, currentHeading);
    markerRef.current = L.marker([0, 0], { 
      icon: initialIcon,
      zIndexOffset: 1000
    }).addTo(map);

    let initialDistanceLeft = 0;
    let initialTimeRemaining = 0;
    
    if (selectedRoute?.coordinates) {
      const totalDistance = selectedRoute.summary?.totalDistance || 
                            calculateTotalRouteDistance(selectedRoute.coordinates);
      initialDistanceLeft = totalDistance;
      initialTimeRemaining = selectedRoute.summary?.totalTime || calculateEstimatedTime(totalDistance);
    }

    if (onInstructionUpdate) {
      onInstructionUpdate('Starting navigation... Follow the route.', 0, initialDistanceLeft, initialTimeRemaining);
    }
    
    // *** UPDATED: Use voiceEnabledRef.current ***
    if (voiceEnabledRef.current) {
      voiceService.speak('Navigation starting. Please follow the route.');
    }

    instructionCheckRef.current = setInterval(() => {
      if (previousPositionRef.current && routeInstructions.length > 0 && selectedRoute?.coordinates) {
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

        console.log('New position:', newPosition.lat.toFixed(6), newPosition.lng.toFixed(6));

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

        if (routeInstructions.length > 0 && selectedRoute?.coordinates) {
          updateNavigationInstructions(newPosition);
        }

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
      console.log('RealTimeNavigation cleanup');
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
      activeZoneAlertRef.current = null; // Clear zone alert
    };
  }, [
    isActive, 
    map, 
    navigationIconType, 
    onStopNavigation, 
    routeInstructions, 
    // voiceEnabled (removed, using ref)
    onInstructionUpdate, 
    selectedRoute,
    calculateTotalRouteDistance,
    calculateEstimatedTime
  ]);

  useEffect(() => {
    updateMarkerRotation();
  }, [currentHeading, navigationIconType]);

  return null;
};


// *** FIXED RoutingMachine Component - Properly handles route selection ***
const RoutingMachine = ({
  startPoint,
  endPoint,
  reports,
  onRoutesComputed,
  selectedRouteIndex,
  onRouteChange,
  isNavigating,
}) => {
  const map = useMap();
  const routingControlRef = useRef(null);
  const routeLayersRef = useRef([]);
  const [allRoutesData, setAllRoutesData] = useState([]);
  const [routesFetched, setRoutesFetched] = useState(false);

  const extractInstructionsFromRoute = (route) => {
    if (!route?.coordinates) {
      console.log('No route coordinates available');
      return [];
    }
    const instructions = generateInstructionsFromCoordinates(route.coordinates);
    if (instructions.length === 0) {
      console.warn('No instructions generated from coordinates!');
    }
    return instructions;
  };

  const cleanup = useCallback(() => {
    console.log('Cleaning up routing machine...');
    routeLayersRef.current.forEach((layer) => {
      if (layer && map.hasLayer(layer)) {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.log('Error removing layer:', e);
        }
      }
    });
    routeLayersRef.current = [];
    if (routingControlRef.current) {
      try {
        routingControlRef.current.remove();
      } catch (e) {
        console.log('Error removing routing control:', e);
      }
      routingControlRef.current = null;
    }
  }, [map]);

  const drawSelectedRoute = useCallback((routeData, selectedIndex) => {
    console.log('Drawing selected route:', selectedIndex);
    
    // Clean up any existing routes
    routeLayersRef.current.forEach((layer) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    routeLayersRef.current = [];

    if (!routeData || routeData.length === 0) {
      console.log('No route data to draw');
      return;
    }

    const routeStyles = [
      { color: '#f97316', name: 'Safest Route' },
      { color: '#2563eb', name: 'Alternative 1' },
      { color: '#dc2626', name: 'Alternative 2' },
      { color: '#7c3aed', name: 'Alternative 3' },
    ];

    const data = routeData[selectedIndex];
    if (!data) {
      console.error('No route data for selected index:', selectedIndex);
      return;
    }

    const style = routeStyles[selectedIndex % routeStyles.length];
    const defaultColor = style.color;

    let routeLayer;

    if (isNavigating) {
      // NAVIGATION MODE: Multi-color LayerGroup
      console.log(`Drawing route ${selectedIndex} in NAVIGATION mode`);
      const segments = getRouteSegments(data.route.coordinates, reports);
      const routeLayerGroup = L.layerGroup();
      segments.forEach((segment) => {
        L.polyline(segment.coordinates, {
          color: segment.color || defaultColor,
          weight: 6,
          opacity: 1,
          dashArray: null,
          lineCap: 'round',
        }).addTo(routeLayerGroup);
      });
      routeLayer = routeLayerGroup;
    } else {
      // PREVIEW MODE: Single-color Polyline for selected route
      console.log(`Drawing selected route ${selectedIndex} in PREVIEW mode`);
      routeLayer = L.polyline(data.route.coordinates, {
        color: defaultColor,
        weight: 8,
        opacity: 1,
        dashArray: null,
        lineCap: 'round',
      });
    }

    routeLayer.addTo(map);
    routeLayersRef.current.push(routeLayer);

    // Fit bounds to the selected route (only in preview mode)
    if (!isNavigating) {
      map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
    }

    console.log('Successfully drew route:', selectedIndex);
  }, [map, isNavigating, reports]);

  // This useEffect handles initial route fetching
  useEffect(() => {
    console.log('RoutingMachine useEffect triggered', {
      startPoint,
      endPoint,
      isNavigating, 
      selectedRouteIndex
    });
    
    cleanup();
    onRoutesComputed([]);
    setRoutesFetched(false);
    setAllRoutesData([]);

    if (!startPoint || !endPoint) {
      console.log('No start/end points, skipping route calculation');
      return;
    }

    console.log('Setting up new routing control...');

    try {
      const control = L.Routing.control({
        waypoints: [
          L.latLng(startPoint.lat, startPoint.lng),
          L.latLng(endPoint.lat, endPoint.lng),
        ],
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
        plan: new L.Routing.Plan(
          [
            L.latLng(startPoint.lat, startPoint.lng),
            L.latLng(endPoint.lat, endPoint.lng),
          ],
          {
            createMarker: () => null,
            draggableWaypoints: false,
            addWaypoints: false,
          }
        ),
      }).addTo(map);

      routingControlRef.current = control;

      control.on('routesfound', (e) => {
        console.log('Routes found:', e.routes.length);
        
        // 1. Map to initial data object
        const allRouteData = e.routes.map((route, i) => {
          const nearReports = reports.filter((report) => {
            const reportLocation = normalizeLocation(report.location);
            return isPointNearPolyline(reportLocation, route.coordinates);
          });
          const safetyScore = {
            danger: nearReports.filter((r) => r.category === 'danger').length,
            caution: nearReports.filter((r) => r.category === 'caution').length,
            safe: nearReports.filter((r) => r.category === 'safe').length,
          };
          const overallSafetyScore = calculateSafetyScore(safetyScore);
          const instructions = extractInstructionsFromRoute(route);
          return {
            route: { ...route, instructions: instructions },
            originalIndex: i,
            safetyScore,
            overallSafetyScore,
          };
        });

        // 2. Sort by safety
        allRouteData.sort((a, b) => b.overallSafetyScore - a.overallSafetyScore);
        
        // 3. Store all routes data
        setAllRoutesData(allRouteData);
        setRoutesFetched(true);

        // 4. Prepare panel data (all routes)
        const routeStyles = [
          { color: '#f97316', name: 'Safest Route' },
          { color: '#2563eb', name: 'Alternative 1' },
          { color: '#dc2626', name: 'Alternative 2' },
          { color: '#7c3aed', name: 'Alternative 3' },
        ];

        const routesForPanel = allRouteData.map((data, index) => ({
          ...data,
          name: index === 0 ? routeStyles[index % routeStyles.length].name : `Alternative ${index}`,
          summary: data.route.summary,
          color: routeStyles[index % routeStyles.length].color,
          isDashed: index !== selectedRouteIndex,
        }));
        
        onRoutesComputed(routesForPanel);

        // 5. Draw the selected route
        drawSelectedRoute(allRouteData, selectedRouteIndex);
      });

      control.on('routingerror', (e) => {
        console.error('Routing error:', e.error);
        onRoutesComputed([]);
        setRoutesFetched(false);
      });
    } catch (error) {
      console.error('Error setting up routing control:', error);
      onRoutesComputed([]);
      setRoutesFetched(false);
    }

    return () => {
      console.log('RoutingMachine cleanup');
      cleanup();
    };
  }, [
    startPoint,
    endPoint,
    reports,
    map,
    cleanup,
    onRoutesComputed,
    drawSelectedRoute,
    selectedRouteIndex
  ]);

  // This useEffect handles route selection changes AFTER initial fetch
  useEffect(() => {
    if (!routesFetched || allRoutesData.length === 0) {
      console.log('Routes not fetched yet, skipping selection change');
      return;
    }

    console.log('Route selection changed to:', selectedRouteIndex);
    
    // Update panel data with new selection
    const routeStyles = [
      { color: '#f97316', name: 'Safest Route' },
      { color: '#2563eb', name: 'Alternative 1' },
      { color: '#dc2626', name: 'Alternative 2' },
      { color: '#7c3aed', name: 'Alternative 3' },
    ];

    const routesForPanel = allRoutesData.map((data, index) => ({
      ...data,
      name: index === 0 ? routeStyles[index % routeStyles.length].name : `Alternative ${index}`,
      summary: data.route.summary,
      color: routeStyles[index % routeStyles.length].color,
      isDashed: index !== selectedRouteIndex,
    }));
    
    onRoutesComputed(routesForPanel);

    // Draw the newly selected route
    drawSelectedRoute(allRoutesData, selectedRouteIndex);

  }, [selectedRouteIndex, routesFetched, allRoutesData, onRoutesComputed, drawSelectedRoute]);

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
    if (!Array.isArray(reports) || reports.length === 0) {
      clearGroup(); // Clear layers if reports array is empty
      return;
    }
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

// *** UPDATED COMPONENT ***
const UserLocationMarker = ({ position, isNavigating }) => {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    
    // Do not show the blue dot when in active navigation
    // (RealTimeNavigation will show the car/arrow marker)
    if (isNavigating) return; 

    const marker = L.circleMarker(position, {
      radius: 8,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.8,
    }).addTo(map);

    // *** REMOVED map.setView(position, 13); ***
    // This was the bug causing the map to re-center on your location
    // after the route was calculated and drawn.

    return () => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    };
  }, [position, isNavigating, map]); // Added map to dependency array

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
              // *** UPDATED: In nav mode, index is always 0 ***
              (isNavigating ? index === 0 : index === selectedRouteIndex)
                ? 'bg-gray-700 border-blue-500'
                : 'border-gray-600 hover:bg-gray-700'
            } ${isNavigating && index !== 0 ? 'opacity-40' : ''}`} // This class will now hide non-selected routes
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
              {/* *** UPDATED: In nav mode, index is always 0 *** */}
              {(isNavigating ? index === 0 : index === selectedRouteIndex) && (
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

// ... (Other UI components like Header, RouteCard, etc. remain unchanged) ...
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
const Map = ({ startPoint, endPoint }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [reports, setReports] = useState([]);
  const [routeSafetyInfo, setRouteSafetyInfo] = useState([]);
  const [panelVisible, setPanelVisible] = useState(true);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationIconType, setNavigationIconType] = useState('car');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [nextInstruction, setNextInstruction] = useState('Starting navigation...');
  const [distanceToNext, setDistanceToNext] = useState(0);
  const [distanceLeft, setDistanceLeft] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [navigationStopped, setNavigationStopped] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [shouldShowRoutes, setShouldShowRoutes] = useState(true);

  useEffect(() => {
    const event = new CustomEvent('navigationStateChange', {
      detail: { isNavigating }
    });
    window.dispatchEvent(event);
  }, [isNavigating]);

  useEffect(() => {
    if (startPoint && endPoint) {
      console.log('Start/end points changed, resetting route display');
      setShouldShowRoutes(true);
      setNavigationStopped(false);
      
      // Also reset navigation state and clear old routes
      setIsNavigating(false);
      setRouteSafetyInfo([]);
      setSelectedRouteIndex(0); 
      setPanelVisible(true);
      setNextInstruction('Starting navigation...');
      setDistanceLeft(0);
      setTimeRemaining(0);
    }
  }, [startPoint, endPoint]);

  useEffect(() => {
    const getUserLocation = () => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by this browser';
        console.warn(error);
        setLocationError(error);
        setUserLocation([0, 0]); // Default fallback
        setLocationLoaded(true);
        return;
      }

      console.log('Getting user location...');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = [position.coords.latitude, position.coords.longitude];
          console.log('User location found:', userPos);
          setUserLocation(userPos);
          setLocationLoaded(true);
          setLocationError(null);
        },
        (error) => {
          console.error('Error getting location:', error);
          let errorMessage = '';
          let fallbackLocation;
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Using default location.';
              fallbackLocation = [40.7128, -74.0060]; // New York
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable. Using default location.';
              fallbackLocation = [51.5074, -0.1278]; // London
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Using default location.';
              fallbackLocation = [48.8566, 2.3522]; // Paris
              break;
            default:
              errorMessage = 'Unknown location error. Using default location.';
              fallbackLocation = [35.6762, 139.6503]; // Tokyo
              break;
          }
          
          setLocationError(errorMessage);
          setUserLocation(fallbackLocation);
          setLocationLoaded(true);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    };

    getUserLocation();
  }, []);

  const handleRoutesComputed = useCallback((routes) => {
    setRouteSafetyInfo(routes);
    setShouldShowRoutes(true); 
    
    if (routes.length > 0) {
      setNavigationStopped(false);
      // set selectedRouteIndex to 0 (safest route) is already the default
      const selectedRoute = routes[0]; // Safest route (index 0)
      if (selectedRoute) {
        setDistanceLeft(selectedRoute.summary?.totalDistance || 0);
        setTimeRemaining(selectedRoute.summary?.totalTime || 0);
      }
    }
  }, []); 

  useEffect(() => {
    // This effect updates the panel when the index *or* the route info changes
    // This is especially important for navigation mode where the index is always 0
    // but the route info array changes to have only 1 item.
    let routeToShow;
    if (isNavigating) {
      routeToShow = routeSafetyInfo[0]; // In nav mode, always show the first (and only) route
    } else {
      routeToShow = routeSafetyInfo[selectedRouteIndex]; // In preview, show the selected one
    }

    if (routeToShow) {
      setDistanceLeft(routeToShow.summary?.totalDistance || 0);
      setTimeRemaining(routeToShow.summary?.totalTime || 0);
    }
  }, [selectedRouteIndex, routeSafetyInfo, isNavigating]); // Added isNavigating

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
    setDistanceLeft(0);
    setTimeRemaining(0);
    
    setRouteSafetyInfo([]);
    setSelectedRouteIndex(0);
    setShouldShowRoutes(false); 
    
    setMapKey(prev => prev + 1);
  };

  const handleVoiceToggle = () => {
    const newVoiceEnabled = !voiceEnabled;
    setVoiceEnabled(newVoiceEnabled);
    voiceService.setEnabled(newVoiceEnabled);
    
    if (newVoiceEnabled && isNavigating) {
      voiceService.speak('Voice guidance enabled');
    }
  };

  const handleInstructionUpdate = useCallback((instruction, distance, newDistanceLeft = 0, newTimeRemaining = 0) => {
    setNextInstruction(instruction);
    setDistanceToNext(distance);
    
    if (newDistanceLeft >= 0) {
      setDistanceLeft(newDistanceLeft);
    }
    if (newTimeRemaining >= 0) {
      setTimeRemaining(newTimeRemaining);
    }
  }, []);

  // *** UPDATED to handle navigation mode ***
  const selectedRoute = isNavigating 
    ? routeSafetyInfo[0]?.route // In nav mode, it's always the first (and only) one
    : routeSafetyInfo[selectedRouteIndex]?.route; // In preview, it's the selected one

  const selectedRouteInfo = isNavigating
    ? routeSafetyInfo[0]
    : routeSafetyInfo[selectedRouteIndex];

  const retryLocation = () => {
    setLocationLoaded(false);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      setLocationLoaded(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = [position.coords.latitude, position.coords.longitude];
        setUserLocation(userPos);
        setLocationLoaded(true);
        setLocationError(null);
      },
      (error) => {
        setLocationError('Failed to get location. Please check permissions.');
        setLocationLoaded(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="relative w-full h-full bg-[#1E1E1E]">
      {!locationLoaded ? (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg font-medium">Getting your location...</p>
            <p className="text-sm text-gray-400 mt-2">Please allow location access for accurate navigation</p>
          </div>
        </div>
      ) : locationError ? (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center max-w-md p-6 bg-gray-800 rounded-lg">
            <div className="text-yellow-500 text-4xl mb-4">📍</div>
            <h3 className="text-lg font-medium mb-2">Location Access Needed</h3>
            <p className="text-gray-300 mb-4">{locationError}</p>
            <div className="space-y-3">
              <button
                onClick={retryLocation}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
              >
                Retry Location
              </button>
              <button
                onClick={() => {
                  setLocationError(null);
                  setUserLocation([40.7128, -74.0060]); // Continue with fallback
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
              >
                Use Default Location
              </button>
            </div>
          </div>
        </div>
      ) : userLocation ? (
        <MapContainer
          key={mapKey}
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

          {startPoint && endPoint && shouldShowRoutes && (
              <>
                <Marker position={[startPoint.lat, startPoint.lng]} icon={blueIcon}>
                  <Popup className="dark-popup">Start Point</Popup>
                </Marker>
                
                <Marker position={[endPoint.lat, endPoint.lng]} icon={redIcon}>
                  <Popup className="dark-popup">End Point</Popup>
                </Marker>
              </>
            )}

          {startPoint && endPoint && shouldShowRoutes && (
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
              reports={reports} // *** NEW: Pass reports for zone alerts ***
              navigationIconType={navigationIconType}
              voiceEnabled={voiceEnabled}
              onInstructionUpdate={handleInstructionUpdate}
            />
          )}
        </MapContainer>
      ) : null}

      {routeSafetyInfo.length > 0 && (
        <RouteSafetyPanel
          routes={routeSafetyInfo}
          visible={panelVisible}
          onToggle={() => setPanelVisible(prev => !prev)}
          selectedRouteIndex={isNavigating ? 0 : selectedRouteIndex} // *** UPDATED ***
          onRouteSelect={setSelectedRouteIndex}
          isNavigating={isNavigating}
        />
      )}

      {routeSafetyInfo.length > 0 && selectedRoute && (
        <>
          {!isNavigating && !navigationStopped && (
            <RouteSelectionPanel
              selectedRoute={selectedRouteInfo} // *** UPDATED ***
              onStartNavigation={handleStartNavigation}
              voiceEnabled={voiceEnabled}
              onVoiceToggle={handleVoiceToggle}
            />
          )}
          
          {isNavigating && (
            <NavigationPanel
              isNavigating={isNavigating}
              onStopNavigation={handleStopNavigation}
              selectedRoute={selectedRouteInfo} // *** UPDATED ***
              voiceEnabled={voiceEnabled}
              onVoiceToggle={handleVoiceToggle}
              nextInstruction={nextInstruction}
              distanceToNext={distanceToNext}
              distanceLeft={distanceLeft}
              timeRemaining={timeRemaining}
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