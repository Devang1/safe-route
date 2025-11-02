import { useState, useEffect, useRef } from 'react';
import { Navigation, MapPin, Locate, RouteIcon, ChevronDown, ChevronUp, Search } from 'lucide-react';
const base_url = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const RouteForm = ({
  onRouteSubmit,
  useCurrentLocation,
  onUseCurrentLocationChange,
  currentLocation,
  isPlanningRoute,
  onPlanningRouteChange,
  compact = false
}) => {
  const [startLocation, setStartLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);

  const startInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowStartSuggestions(false);
        setShowDestinationSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const geocodeLocation = async (locationName) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`
    );
    const data = await response.json();
    if (data.length === 0) throw new Error(`No results for "${locationName}"`);
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  };

  const fetchSuggestions = async (query, setSuggestions) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setFetchingSuggestions(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setFetchingSuggestions(false);
    }
  };

  // Debounced suggestion fetching for start location
  useEffect(() => {
    if (!useCurrentLocation && startLocation.trim()) {
      const timer = setTimeout(() => {
        fetchSuggestions(startLocation, setStartSuggestions);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setStartSuggestions([]);
    }
  }, [startLocation, useCurrentLocation]);

  // Debounced suggestion fetching for destination location
  useEffect(() => {
    if (destinationLocation.trim()) {
      const timer = setTimeout(() => {
        fetchSuggestions(destinationLocation, setDestinationSuggestions);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDestinationSuggestions([]);
    }
  }, [destinationLocation]);

  const handleSuggestionClick = (suggestion, isStartLocation = false) => {
    const displayName = suggestion.display_name.split(',')[0] + ', ' + 
                       suggestion.display_name.split(',').slice(1, 3).join(',').trim();
    
    if (isStartLocation) {
      setStartLocation(displayName);
      setShowStartSuggestions(false);
    } else {
      setDestinationLocation(displayName);
      setShowDestinationSuggestions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destinationLocation.trim()) {
      alert('Please enter a destination');
      return;
    }

    setLoading(true);
    onPlanningRouteChange?.(true);
    setShowStartSuggestions(false);
    setShowDestinationSuggestions(false);

    try {
      let startPoint;

      if (useCurrentLocation) {
        if (!currentLocation) {
          await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
        }
        startPoint = currentLocation;
      } else {
        if (!startLocation.trim()) {
          alert('Please enter a start location');
          setLoading(false);
          onPlanningRouteChange?.(false);
          return;
        }
        startPoint = await geocodeLocation(startLocation);
      }

      const endPoint = await geocodeLocation(destinationLocation);
      onRouteSubmit(startPoint, endPoint);
      
    } catch (error) {
      console.error('Error planning route:', error);
      if (error.message.includes('No results')) {
        alert('Could not find the location. Please try a different name or address.');
      } else if (error.code === 1) {
        alert('Location access denied. Please enable location services or enter a start location manually.');
      } else {
        alert('Could not plan route. Please check your internet connection and try again.');
      }
    } finally {
      setLoading(false);
      onPlanningRouteChange?.(false);
    }
  };

  const quickDestinations = [
  ];

  const handleQuickDestination = (searchTerm) => {
    setDestinationLocation(searchTerm);
    setShowDestinationSuggestions(true);
  };

  return (
    <form onSubmit={handleSubmit} className={`bg-[#1E1E1E]/95 backdrop-blur-sm border border-gray-700 rounded-xl shadow-xl  ${
      compact ? 'p-2' : 'p-3 sm:p-4'
    } w-full max-w-6xl mx-auto`}>
      
      {/* Collapsed Mobile View */}
      {!isExpanded && (
        <div className="sm:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#1975d8] rounded-lg">
                <RouteIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Plan Route</h3>
                <p className="text-gray-400 text-sm">Tap to plan your route</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors duration-200"
              aria-label="Expand route form"
            >
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded Mobile View */}
      {isExpanded && (
        <div className="flex flex-col gap-3 sm:hidden" ref={suggestionsRef}>
          {/* Header with Close Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#1975d8] rounded-lg">
                <RouteIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Plan Route</h3>
                <p className="text-gray-400 text-sm">Find safe path to destination</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors duration-200"
              aria-label="Collapse route form"
            >
              <ChevronUp className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Current Location Toggle */}
          <div className="bg-[#2C2C2C] rounded-lg p-3 border border-gray-600">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded ${useCurrentLocation ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-400'}`}>
                  <Locate className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium block">Current Location</span>
                  <span className="text-gray-400 text-xs block">
                    {useCurrentLocation ? 'Using your position' : 'Start from current location'}
                  </span>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useCurrentLocation}
                  onChange={(e) => onUseCurrentLocationChange(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                  useCurrentLocation ? 'bg-[#1975d8]' : 'bg-gray-600'
                }`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                    useCurrentLocation ? 'transform translate-x-5' : 'transform translate-x-0.5'
                  }`} />
                </div>
              </div>
            </label>
          </div>

          {/* Start Location Input with Suggestions */}
          {!useCurrentLocation && (
            <div className="space-y-1 relative">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1975d8]" />
                Start Location
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  ref={startInputRef}
                  type="text"
                  value={startLocation}
                  onChange={(e) => setStartLocation(e.target.value)}
                  onFocus={() => setShowStartSuggestions(true)}
                  placeholder="Enter start address..."
                  className="w-full pl-10 pr-3 py-3 text-sm bg-[#2C2C2C] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1975d8] focus:border-transparent transition-all duration-200"
                  required={!useCurrentLocation}
                />
              </div>
              
              {/* Start Location Suggestions */}
              {showStartSuggestions && startSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1E1E1E] border border-gray-600 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                  {startSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion, true)}
                      className="w-full text-left px-3 py-2 hover:bg-[#1975d8]/20 border-b border-gray-600 last:border-b-0 transition-colors text-sm"
                    >
                      <div className="font-medium text-white">
                        {suggestion.display_name.split(',')[0]}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {suggestion.display_name.split(',').slice(1, 3).join(',').trim()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Destination Input with Suggestions */}
          <div className="space-y-1 relative">
            <label className="text-white text-sm font-medium flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#1975d8]" />
              Destination
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                ref={destinationInputRef}
                type="text"
                value={destinationLocation}
                onChange={(e) => setDestinationLocation(e.target.value)}
                onFocus={() => setShowDestinationSuggestions(true)}
                placeholder="Where to go?"
                className="w-full pl-10 pr-3 py-3 text-sm bg-[#2C2C2C] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1975d8] focus:border-transparent transition-all duration-200"
                required
              />
            </div>
            
            {/* Destination Suggestions */}
            {showDestinationSuggestions && destinationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1E1E1E] border border-gray-600 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                {destinationSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion, false)}
                    className="w-full text-left px-3 py-2 hover:bg-[#1975d8]/20 border-b border-gray-600 last:border-b-0 transition-colors text-sm"
                  >
                    <div className="font-medium text-white">
                      {suggestion.display_name.split(',')[0]}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {suggestion.display_name.split(',').slice(1, 3).join(',').trim()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Destination Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {quickDestinations.map((place) => (
              <button
                key={place.name}
                type="button"
                onClick={() => handleQuickDestination(place.search)}
                className="px-2 py-2 bg-[#2C2C2C] hover:bg-[#1975d8] text-gray-300 hover:text-white rounded text-xs font-medium transition-all duration-200 border border-gray-600 hover:border-[#1975d8] text-center"
              >
                {place.name}
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !destinationLocation.trim()}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-gradient-to-r from-[#1975d8] to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:transform-none disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Finding Route...</span>
              </>
            ) : (
              <>
                <RouteIcon className="w-4 h-4" />
                <span>Find Route</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Desktop Layout - Horizontal */}
      <div className="hidden sm:flex items-center gap-3 lg:gap-4" ref={suggestionsRef}>
        {/* Header */}
        {!compact && (
          <div className="flex items-center gap-2 min-w-[120px] lg:min-w-[140px]">
            <div className="p-2 bg-[#1975d8] rounded-lg">
              <RouteIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm lg:text-base font-bold text-white">Plan Route</h3>
              <p className="text-gray-400 text-xs lg:text-sm hidden lg:block">Find safe path</p>
            </div>
          </div>
        )}

        {/* Current Location Toggle */}
        <div className="bg-[#2C2C2C] rounded-lg p-2 border border-gray-600 min-w-[140px] lg:min-w-[160px]">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`p-1.5 rounded ${useCurrentLocation ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-400'}`}>
              <Locate className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-white text-xs lg:text-sm font-medium block">Current Location</span>
              <span className="text-gray-400 text-[10px] lg:text-xs block truncate">
                {useCurrentLocation ? 'Using position' : 'Start from here'}
              </span>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={useCurrentLocation}
                onChange={(e) => onUseCurrentLocationChange(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-8 h-4 lg:w-10 lg:h-5 rounded-full transition-colors duration-200 ${
                useCurrentLocation ? 'bg-[#1975d8]' : 'bg-gray-600'
              }`}>
                <div className={`absolute top-0.5 w-3 h-3 lg:w-4 lg:h-4 rounded-full bg-white transition-transform duration-200 ${
                  useCurrentLocation ? 'transform translate-x-4 lg:translate-x-5' : 'transform translate-x-0.5'
                }`} />
              </div>
            </div>
          </label>
        </div>

        {/* Start Location Input with Suggestions */}
        {!useCurrentLocation && (
          <div className="min-w-[140px] lg:min-w-[180px] flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 lg:w-4 lg:h-4" />
              <input
                ref={startInputRef}
                type="text"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                onFocus={() => setShowStartSuggestions(true)}
                placeholder="Start address..."
                className="w-full pl-9 lg:pl-10 pr-3 py-2.5 lg:py-3 text-sm bg-[#2C2C2C] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1975d8] focus:border-transparent transition-all duration-200"
                required={!useCurrentLocation}
              />
            </div>
            
            {/* Start Location Suggestions */}
            {showStartSuggestions && startSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1E1E1E] border border-gray-600 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                {startSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion, true)}
                    className="w-full text-left px-3 py-2 hover:bg-[#1975d8]/20 border-b border-gray-600 last:border-b-0 transition-colors text-sm"
                  >
                    <div className="font-medium text-white">
                      {suggestion.display_name.split(',')[0]}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {suggestion.display_name.split(',').slice(1, 3).join(',').trim()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Destination Input with Suggestions */}
        <div className="min-w-[140px] lg:min-w-[180px] flex-1 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 lg:w-4 lg:h-4" />
            <input
              ref={destinationInputRef}
              type="text"
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              onFocus={() => setShowDestinationSuggestions(true)}
              placeholder="Where to go?"
              className="w-full pl-9 lg:pl-10 pr-3 py-2.5 lg:py-3 text-sm bg-[#2C2C2C] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1975d8] focus:border-transparent transition-all duration-200"
              required
            />
          </div>
          
          {/* Destination Suggestions */}
          {showDestinationSuggestions && destinationSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1E1E1E] border border-gray-600 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
              {destinationSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion, false)}
                  className="w-full text-left px-3 py-2 hover:bg-[#1975d8]/20 border-b border-gray-600 last:border-b-0 transition-colors text-sm"
                >
                  <div className="font-medium text-white">
                    {suggestion.display_name.split(',')[0]}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {suggestion.display_name.split(',').slice(1, 3).join(',').trim()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !destinationLocation.trim()}
          className="flex justify-center items-center gap-2 py-2.5 lg:py-3 px-4 lg:px-6 bg-gradient-to-r from-[#1975d8] to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:transform-none disabled:cursor-not-allowed min-w-[100px] lg:min-w-[120px]"
        >
          {loading ? (
            <>
              <div className="w-3 h-3 lg:w-4 lg:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="hidden lg:inline">Finding...</span>
            </>
          ) : (
            <>
              <RouteIcon className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">Find Route</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Destination Buttons for Desktop */}
      <div className="hidden sm:flex mt-3 justify-center">
        <div className="flex flex-wrap gap-2 justify-center">
          {quickDestinations.map((place) => (
            <button
              key={place.name}
              type="button"
              onClick={() => handleQuickDestination(place.search)}
              className="px-3 py-2 bg-[#2C2C2C] hover:bg-[#1975d8] text-gray-300 hover:text-white rounded text-xs font-medium transition-all duration-200 border border-gray-600 hover:border-[#1975d8] text-center"
            >
              {place.name}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
};