import React, { useState, useEffect } from 'react';
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

const normalizeLocation = (loc) => Array.isArray(loc) ? loc : [loc.lat, loc.lng];

const getDistanceFromLatLng = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
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

const calculateSafetyScore = (safetyScore) => {
  const weights = {
    danger: 3,
    caution: 2,
    safe: 1
  };

  const weightedSum =
    safetyScore.danger * weights.danger +
    safetyScore.caution * weights.caution -
    safetyScore.safe * weights.safe;

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

const RoutingMachine = ({
  startPoint,
  endPoint,
  reports,
  onRoutesComputed,
  showDirections,
  selectedRouteIndex
}) => {
  const map = useMap();
  const [routingControl, setRoutingControl] = useState(null);
  const [routeLayers, setRouteLayers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [previousSelectedIndex, setPreviousSelectedIndex] = useState(null);

  useEffect(() => {
    if (routingControl) {
      const container = routingControl.getContainer();
      if (container) {
        container.style.display = showDirections ? 'block' : 'none';
        
        // Only update instructions visibility, keep routes visible
        const alternatives = container.querySelectorAll('.leaflet-routing-alt');
        alternatives.forEach((alt, index) => {
          alt.style.display = showDirections && index === selectedRouteIndex ? 'block' : 'none';
        });

        // Update selected route
        if (routes[selectedRouteIndex]) {
          routingControl._selectedRoute = selectedRouteIndex;
          routingControl.fire('routeselected', { route: routes[selectedRouteIndex] });
        }
      }
    }
  }, [showDirections, selectedRouteIndex, routingControl, routes]);

  useEffect(() => {
    if (previousSelectedIndex !== null && previousSelectedIndex !== selectedRouteIndex && routeLayers[previousSelectedIndex]) {
      routeLayers[previousSelectedIndex].setStyle({
        dashArray: '10, 10',
        weight: 4,
        opacity: 0.6,
      });
    }

    if (routeLayers[selectedRouteIndex]) {
      routeLayers[selectedRouteIndex].setStyle({
        dashArray: null,
        weight: 8,
        opacity: 1,
      });

      const bounds = routeLayers[selectedRouteIndex].getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    setPreviousSelectedIndex(selectedRouteIndex);
  }, [selectedRouteIndex]);

  useEffect(() => {
    if (!startPoint || !endPoint) return;

    routeLayers.forEach(layer => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    if (routingControl) {
      routingControl.remove();
    }

    const routeStyles = [
      { color: '#059669', name: 'Safest Route' },
      { color: '#2563eb', name: 'Alternative 1' },
      { color: '#dc2626', name: 'Alternative 2' },
      { color: '#7c3aed', name: 'Alternative 3' },
    ];

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
      show: showDirections,
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

    const container = control.getContainer();
    Object.assign(container.style, {
      position: 'absolute',
      top: '70px',
      right: '10px',
      display: showDirections ? 'block' : 'none',
      backgroundColor: '#1F2937',
      padding: '10px',
      borderRadius: '4px',
      boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
      maxHeight: '400px',
      overflowY: 'auto',
      zIndex: 999,
      color:"#fffff0",
    });

    setRoutingControl(control);

    control.on('routesfound', (e) => {
      setRoutes(e.routes);
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

        return {
          route,
          index: i,
          safetyScore,
          overallSafetyScore,
        };
      });

      // Sort routes by safety score (highest first)
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

        if (isSelected) {
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

        newLayers.push(polyline);

        return {
          ...data,
          name: i === 0 ? style.name : `Alternative ${i}`,
          summary: data.route.summary,
          color: style.color,
          isDashed: !isSelected,
        };
      });

      setRouteLayers(newLayers);
      onRoutesComputed(routeData);
    });

    return () => {
      control.remove();
      routeLayers.forEach((layer) => map.removeLayer(layer));
    };
  }, [startPoint, endPoint, reports]);

  return null;
};

const HeatmapLayer = ({ reports }) => {
  const map = useMap();

  useEffect(() => {
    const heatPoints = reports.map((r) => {
      const [lat, lng] = normalizeLocation(r.location);
      return [lat, lng, r.category === 'danger' ? 1.0 : r.category === 'caution' ? 0.5 : 0.2];
    });

    const layer = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      gradient: {
        0.2: '#22c55e',
        0.5: '#facc15',
        1.0: '#ef4444',
      },
    }).addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [reports]);

  return null;
};

const getColor = (category) => {
  const type = category?.toLowerCase();
  if (type === 'danger') return '#ef4444';
  if (type === 'caution') return '#facc15';
  return '#22c55e';
};

const DotsLayer = ({ reports }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(reports)) return;

    const markers = reports.map((r) => {
      const [lat, lng] = normalizeLocation(r.location);
      return L.circleMarker([lat, lng], {
        radius: 6,
        color: getColor(r.category),
        fillColor: getColor(r.category),
        fillOpacity: 0.8,
      }).addTo(map);
    });

    return () => markers.forEach((m) => map.removeLayer(m));
  }, [reports]);

  return null;
};

const UserLocationMarker = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (!position) return;

    const marker = L.circleMarker(position, {
      radius: 8,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.8,
    }).addTo(map);

    map.setView(position, 13);

    return () => map.removeLayer(marker);
  }, [position]);

  return null;
};

const RouteSafetyPanel = ({ routes, visible, onToggle, selectedRouteIndex, onRouteSelect }) => {
  if (!visible) {
    return (
      <button
        onClick={onToggle}
        className="absolute bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-[999] hover:bg-blue-700 transition-colors"
      >
        Show Safe Routes
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 bg-gray-800 rounded-lg shadow-xl p-4 w-80 z-[999] text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Safe Routes</h2>
        <button onClick={onToggle} className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
          Hide
        </button>
      </div>
      {routes.map((r, i) => {
        const safetyLabel = getSafetyLabel(r.overallSafetyScore);
        return (
          <div
            key={i}
            className={`mb-4 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedRouteIndex === i
                ? 'bg-gray-700 border-blue-500'
                : 'hover:bg-gray-700 border-gray-600'
            }`}
            onClick={() => onRouteSelect(i)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-16 h-2 rounded ${r.isDashed ? 'border-t-2' : ''}`}
                  style={{
                    backgroundColor: r.isDashed ? 'transparent' : r.color,
                    borderColor: r.isDashed ? r.color : 'transparent',
                    borderStyle: r.isDashed ? 'dashed' : 'solid',
                  }}
                ></span>
                <span className="font-medium text-gray-200">{r.name}</span>
              </div>
              {selectedRouteIndex === i && (
                <span className="text-blue-400 text-sm">Selected</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="text-sm text-gray-400">
                <div>Distance: {(r.summary.totalDistance / 1000).toFixed(2)} km</div>
                <div>Duration: {(r.summary.totalTime / 60).toFixed(1)} min</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-white">{Math.round(r.overallSafetyScore)}</div>
                <div className={`text-sm ${safetyLabel.color}`}>{safetyLabel.text}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex flex-col items-center p-2 bg-red-900/30 rounded">
                <span className="text-red-400 font-semibold">{r.safetyScore.danger}</span>
                <span className="text-xs text-gray-400">Danger</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-yellow-900/30 rounded">
                <span className="text-yellow-400 font-semibold">{r.safetyScore.caution}</span>
                <span className="text-xs text-gray-400">Caution</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-green-900/30 rounded">
                <span className="text-green-400 font-semibold">{r.safetyScore.safe}</span>
                <span className="text-xs text-gray-400">Safe</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Map = ({ startPoint, endPoint, showHeatmap = false }) => {
  const [userLocation, setUserLocation] = useState([28.6139, 77.209]);
  const [reports, setReports] = useState([]);
  const [routeSafetyInfo, setRouteSafetyInfo] = useState([]);
  const [panelVisible, setPanelVisible] = useState(true);
  const [showDirections, setShowDirections] = useState(true);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

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
    fetch('/api/reports')
      .then(res => res.json())
      .then(data => setReports(data))
      .catch(err => console.error('Failed to fetch reports:', err));
  }, []);

  return (
    <div className="relative w-full h-full bg-[#1E1E1E]">
      <MapContainer 
        center={userLocation} 
        zoom={13} 
        className="h-[calc(100vh-4rem)] w-full z-0"
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />
        <UserLocationMarker position={userLocation} />
        {showHeatmap ? <HeatmapLayer reports={reports} /> : <DotsLayer reports={reports} />}
        {startPoint && <Marker position={[startPoint.lat, startPoint.lng]} icon={blueIcon}><Popup className="dark-popup">Start Point</Popup></Marker>}
        {endPoint && <Marker position={[endPoint.lat, endPoint.lng]} icon={redIcon}><Popup className="dark-popup">End Point</Popup></Marker>}

        {startPoint && endPoint && (
          <RoutingMachine
            startPoint={startPoint}
            endPoint={endPoint}
            reports={reports}
            onRoutesComputed={setRouteSafetyInfo}
            showDirections={showDirections}
            selectedRouteIndex={selectedRouteIndex}
          />
        )}
      </MapContainer>

      <RouteSafetyPanel
        routes={routeSafetyInfo}
        visible={panelVisible}
        onToggle={() => setPanelVisible(prev => !prev)}
        selectedRouteIndex={selectedRouteIndex}
        onRouteSelect={setSelectedRouteIndex}
      />

      <button
        onClick={() => setShowDirections((prev) => !prev)}
        className="absolute top-4 right-4 bg-gray-800 text-gray-200 px-4 py-2 rounded shadow-lg z-[999] hover:bg-gray-700 transition-colors"
      >
        {showDirections ? 'Hide Directions' : 'Show Directions'}
      </button>
    </div>
  );
};

export default Map;