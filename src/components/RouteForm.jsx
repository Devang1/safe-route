
import { useState } from 'react';
import { Navigation } from 'lucide-react';

export const RouteForm = ({
  onRouteSubmit,
  useCurrentLocation,
  onUseCurrentLocationChange,
}) => {
  const [startLocation, setStartLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let startPoint;

      if (useCurrentLocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            startPoint = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            const endPoint = await geocodeLocation(destinationLocation);
            onRouteSubmit(startPoint, endPoint);
            setLoading(false);
          },
          (error) => {
            console.error('Error getting location:', error);
            alert('Could not get your current location.');
            setLoading(false);
          }
        );
      } else {
        const [startPoint, endPoint] = await Promise.all([
          geocodeLocation(startLocation),
          geocodeLocation(destinationLocation),
        ]);
        onRouteSubmit(startPoint, endPoint);
      }
    } catch (error) {
      console.error('Error planning route:', error);
      alert('Could not find one or both of the locations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-[#1E1E1E] text-[#E0E0E0] rounded-lg shadow">
      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={useCurrentLocation}
            onChange={(e) => onUseCurrentLocationChange(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Use my current location as starting point</span>
        </label>
      </div>

      {!useCurrentLocation && (
        <div>
          <label className="block text-sm font-medium text-gray-300">Start Location</label>
          <input
            type="text"
            value={startLocation}
            onChange={(e) => setStartLocation(e.target.value)}
            placeholder="e.g., Connaught Place, Delhi"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-300 px-2 py-1 bg-[#444444a4]"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300">Destination</label>
        <input
          type="text"
          value={destinationLocation}
          onChange={(e) => setDestinationLocation(e.target.value)}
          placeholder="e.g., India Gate, Delhi"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-300 px-2 py-1 bg-[#444444a4]"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Navigation size={20} />
        {loading ? 'Planning Route...' : 'Plan Safe Route'}
      </button>
    </form>
  );
};

