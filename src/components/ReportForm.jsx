import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Shield, MapPin, Navigation, Search, X, Loader2 } from 'lucide-react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
const base_url = import.meta.env.VITE_API_URL || "http://localhost:5000";
// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icons for different categories
const createCustomIcon = (color) => {
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
      "></div>
    `,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const categoryIcons = {
  safe: createCustomIcon('#10B981'),
  caution: createCustomIcon('#F59E0B'),
  danger: createCustomIcon('#EF4444'),
};

const LocationSelector = ({ setLocation, isSelecting }) => {
  useMapEvents({
    click(e) {
      if (isSelecting) {
        setLocation([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef(null);
  const formRef = useRef(null);

  const categoryStyles = {
    safe: { active: 'bg-green-500 text-white shadow-lg', inactive: 'hover:bg-green-500/20 text-green-400' },
    caution: { active: 'bg-yellow-500 text-white shadow-lg', inactive: 'hover:bg-yellow-500/20 text-yellow-400' },
    danger: { active: 'bg-red-500 text-white shadow-lg', inactive: 'hover:bg-red-500/20 text-red-400' },
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) {
      setLocationError('Please select a location before submitting');
      return;
    }

    setIsSubmitting(true);

    const report = {
      category,
      description,
      latitude: location[0],
      longitude: location[1],
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${base_url}/api/submitReport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!res.ok) throw new Error('Failed to submit report');
      
      alert('Report submitted successfully! 🎉');
      
      // Reset form
      setDescription('');
      setLocation(null);
      setLocationInput('');
      setLocationMode('');
      setLocationError('');
      setShowSearchResults(false);
    } catch (err) {
      console.error(err);
      alert('Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentLocation = () => {
    setLocationError('');
    setLocationMode('gps');
    setShowSearchResults(false);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLocation = [pos.coords.latitude, pos.coords.longitude];
        setLocation(newLocation);
        setLocationMode('gps');
      },
      (error) => {
        const errors = {
          1: 'Location access denied. Please enable location permissions.',
          2: 'Location unavailable. Please try again.',
          3: 'Location request timed out.',
        };
        setLocationError(errors[error.code] || 'Could not get current location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleLocationNameSearch = async () => {
    if (!locationInput.trim()) {
      setLocationError('Please enter a location name');
      return;
    }

    setIsSearching(true);
    setLocationError('');
    setShowSearchResults(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json&limit=5`
      );
      const data = await res.json();
      setSearchResults(data);
      
      if (data.length === 0) {
        setLocationError('No results found. Try a more specific name.');
      }
    } catch (err) {
      setLocationError('Search failed. Please check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (result) => {
    const newLocation = [parseFloat(result.lat), parseFloat(result.lon)];
    setLocation(newLocation);
    setLocationMode('search');
    setLocationInput(result.display_name);
    setShowSearchResults(false);
    setLocationError('');
  };

  const clearLocation = () => {
    setLocation(null);
    setLocationInput('');
    setLocationError('');
    setShowSearchResults(false);
  };

  const handleSearchInputChange = (e) => {
    setLocationInput(e.target.value);
    if (e.target.value.trim() === '') {
      setShowSearchResults(false);
    }
  };

  const showMap = ['map', 'search', 'gps'].includes(locationMode);
  const center = location || [20.5937, 78.9629];

  return (
    <div className="flex items-center justify-center max-h-[75vh] ">
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className="max-w-2xl w-full max-h-[80vh] overflow-y-auto bg-[#1E1E1E] text-[#E0E0E0] shadow-lg rounded-lg border border-gray-700"
      >
        <div className="p-4 space-y-4">
          {/* Header - More Compact */}
          <div className="text-center">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Report an Incident
            </h2>
            <p className="text-gray-400 text-sm mt-1">Help keep others informed about safety conditions</p>
          </div>

          {/* Category Selection - More Compact */}
          <div className="bg-[#2A2A2A] p-3 rounded-lg border border-gray-600">
            <label className="block font-semibold mb-2">Incident Type</label>
            <div className="flex gap-2">
              {[
                { value: 'safe', label: 'Safe', icon: <Shield size={16} /> },
                { value: 'caution', label: 'Caution', icon: <AlertCircle size={16} /> },
                { value: 'danger', label: 'Danger', icon: <AlertTriangle size={16} /> },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 flex-1 border ${
                    category === opt.value
                      ? `${categoryStyles[opt.value].active} border-transparent`
                      : `${categoryStyles[opt.value].inactive} border-gray-600 hover:scale-102`
                  }`}
                >
                  {opt.icon}
                  <span className="font-medium text-sm">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description - More Compact */}
          <div className="bg-[#2A2A2A] p-3 rounded-lg border border-gray-600">
            <label className="block font-semibold mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Provide details about the situation..."
              className="w-full border border-gray-600 px-3 py-2 rounded-lg text-white bg-[#1E1E1E] placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none text-sm"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Be specific and helpful</span>
              <span>{description.length}/500</span>
            </div>
          </div>

          {/* Location Selection - More Compact */}
          <div className="bg-[#2A2A2A] p-3 rounded-lg border border-gray-600">
            <label className="block font-semibold mb-2">
              Location <span className="text-red-400">*</span>
            </label>
            
            {/* Location Method Buttons - Compact */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={getCurrentLocation}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-600 hover:border-blue-500 hover:bg-blue-500/10 transition-all text-sm"
              >
                <Navigation size={14} />
                GPS
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setLocationMode('map');
                  setLocation(null);
                  setShowSearchResults(false);
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-600 hover:border-green-500 hover:bg-green-500/10 transition-all text-sm"
              >
                <MapPin size={14} />
                Map
              </button>
            </div>

            {/* Search Input - Compact */}
            <div className="relative" ref={searchInputRef}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    value={locationInput}
                    onChange={handleSearchInputChange}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleLocationNameSearch())}
                    placeholder="Search location..."
                    className="w-full border border-gray-600 pl-8 pr-7 py-2 rounded-lg text-white bg-[#1E1E1E] placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm"
                  />
                  {locationInput && (
                    <button
                      type="button"
                      onClick={clearLocation}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleLocationNameSearch}
                  disabled={isSearching}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-all flex items-center gap-1 text-sm"
                >
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Search
                </button>
              </div>

              {/* Search Results Dropdown - Always show when there are results */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1E1E1E] border border-gray-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-500/20 border-b border-gray-600 last:border-b-0 transition-colors text-sm"
                    >
                      <div className="font-medium text-white truncate">{result.display_name.split(',')[0]}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {result.display_name.split(',').slice(1, 3).join(',').trim()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location Status - Compact */}
            {locationError && (
              <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded p-2 mt-2">
                {locationError}
              </div>
            )}
            
            {location && (
              <div className="text-green-400 text-xs bg-green-400/10 border border-green-400/20 rounded p-2 mt-2 flex justify-between items-center">
                <span className="truncate">
                  📍 {location[0].toFixed(4)}, {location[1].toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={clearLocation}
                  className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Interactive Map - Reduced Height */}
          {showMap && (
            <div className="bg-[#2A2A2A] p-3 rounded-lg border border-gray-600">
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold text-sm">Select Location</label>
                {locationMode === 'map' && (
                  <span className="text-blue-400 text-xs bg-blue-400/10 px-2 py-1 rounded">
                    Click on map to set location
                  </span>
                )}
              </div>
              <div className="h-[250px] w-full rounded-lg overflow-hidden border border-gray-600">
                <MapContainer center={center} zoom={location ? 15 : 5} style={{ height: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  {locationMode === 'map' && (
                    <LocationSelector setLocation={setLocation} isSelecting={true} />
                  )}
                  {location && (
                    <>
                      <Marker 
                        position={location} 
                        icon={categoryIcons[category]}
                      >
                        <Popup>
                          <div className="text-gray-800 text-sm">
                            <strong>Selected Location</strong><br />
                            Lat: {location[0].toFixed(6)}<br />
                            Lng: {location[1].toFixed(6)}
                          </div>
                        </Popup>
                      </Marker>
                      <MapFocus location={location} />
                    </>
                  )}
                </MapContainer>
              </div>
            </div>
          )}

          {/* Submit Button - Compact */}
          <button
            type="submit"
            disabled={!location || isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg relative overflow-hidden group text-sm"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </span>
            ) : (
              <span className="relative z-10">Submit Safety Report</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};