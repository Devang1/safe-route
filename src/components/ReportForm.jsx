import { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Shield } from 'lucide-react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Click handler to set location on map
const LocationSelector = ({ setLocation }) => {
  useMapEvents({
    click(e) {
      setLocation([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

// Move map to selected location
const MapFocus = ({ location }) => {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.setView(location, 15);
    }
  }, [location, map]);
  return null;
};

export const ReportForm = () => {
  const [category, setCategory] = useState('safe');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [locationMode, setLocationMode] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [locationError, setLocationError] = useState('');

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) return alert('Please select a location.');

    const report = {
      category,
      description,
      location,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/submitReport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!res.ok) throw new Error('Failed to submit report');
      alert('Report submitted successfully!');
    } catch (err) {
      console.error(err);
      alert('Error submitting report.');
    }

    // Reset
    setDescription('');
    setLocation(null);
    setLocationInput('');
    setLocationMode('');
  };

  // GPS location
  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationMode('gps');
      },
      () => {
        alert('Could not get current location.');
      }
    );
  };

  // Location name -> coordinates
  const handleLocationNameSearch = async () => {
    if (!locationInput.trim()) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json`
      );
      const data = await res.json();
      if (data.length > 0) {
        const loc = data[0];
        setLocation([parseFloat(loc.lat), parseFloat(loc.lon)]);
        setLocationMode('search');
        setLocationError('');
      } else {
        setLocationError('No results found. Try a more specific name.');
      }
    } catch (err) {
      setLocationError('Geocoding failed.');
    }
  };

  const showMap = ['map', 'search', 'gps'].includes(locationMode);
  const center = location || [20.5937, 78.9629]; // Default: India

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 space-y-6 bg-[#1E1E1E] text-[#E0E0E0] shadow rounded-lg">
      {/* Category */}
      <div>
        <label className="block font-semibold mb-2">Category</label>
        <div className="flex gap-3 ">
          {[
            { value: 'safe', label: 'Safe', icon: <Shield size={18} /> },
            { value: 'caution', label: 'Caution', icon: <AlertCircle size={18} /> },
            { value: 'danger', label: 'Danger', icon: <AlertTriangle size={18} /> },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategory(opt.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                category === opt.value
                  ? {
                      safe: 'bg-green-100 text-green-800',
                      caution: 'bg-yellow-100 text-yellow-800',
                      danger: 'bg-red-100 text-red-800',
                    }[opt.value]
                  : 'text-gray-300 hover:text-white bg-[#444444a4]'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block font-semibold mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          className="w-full border px-3 py-2 rounded-md text-gray-300 bg-[#444444a4]"
        />
      </div>

      {/* Location Controls */}
      <div>
        <label className="block font-semibold mb-2">Set Location</label>
        <div className="flex flex-wrap gap-3 mb-2">
          <button
            type="button"
            onClick={getCurrentLocation}
            className="border px-4 py-2 rounded-md text-gray-300 hover:text-white bg-[#444444a4] text-sm"
          >
            Use GPS
          </button>
          <button
            type="button"
            onClick={() => {
              setLocationMode('map');
              setLocation(null);
            }}
            className="border px-4 py-2 rounded-md text-gray-300 hover:text-white bg-[#444444a4] text-sm"
          >
            Pick on Map
          </button>
          <div className="flex items-center gap-2">
            <input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Enter location name"
              className="border px-3 py-2 rounded-md text-sm  text-gray-300 bg-[#444444a4]"
            />
            <button
              type="button"
              onClick={handleLocationNameSearch}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Search
            </button>
          </div>
        </div>
        {locationError && <p className="text-sm text-red-500">{locationError}</p>}
        {location && (
          <p className="text-sm text-gray-500">
            Selected: {location[0].toFixed(4)}, {location[1].toFixed(4)}
          </p>
        )}
      </div>

      {/* Map */}
      {showMap && (
        <div className="h-[350px] w-full rounded-md overflow-hidden">
          <MapContainer center={center} zoom={5} style={{ height: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {locationMode === 'map' && <LocationSelector setLocation={setLocation} />}
            {location && <Marker position={location} />}
            {location && <MapFocus location={location} />}
          </MapContainer>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!location}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        Submit Report
      </button>
    </form>
  );
};
