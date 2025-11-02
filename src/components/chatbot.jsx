import { useState, useCallback, useRef, useEffect } from 'react';
import { FaRobot, FaUser, FaPaperPlane, FaMapMarkerAlt, FaTimes, FaRoute } from 'react-icons/fa';

// Intent patterns for better maintainability
const INTENT_PATTERNS = {
  hospital: /hospital|medical|doctor|clinic|healthcare/i,
  police: /police|cop|station|law enforcement/i,
  restroom: /restroom|toilet|bathroom|washroom|lavatory/i,
  sos: /sos|emergency|danger|help|urgent|distress/i,
  emergencyNumbers: /emergency numbers|helpline|contact numbers/i
};
const base_url = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Predefined responses
const RESPONSES = {
  greeting: "👋 Hi! I'm your SafeRoute Assistant. How can I help you today?",
  default: "I'm here to help with safety and navigation. You can ask about hospitals, police stations, restrooms, or emergency help.",
  emergencyNumbers: `
📞 Emergency Helplines (India)

🚓 Police: 100  
🚑 Ambulance: 108  
🚒 Fire: 101  
👩‍🦰 Women Helpline: 1091  
👶 Child Helpline: 1098  
🚗 Road Accident / Highway Helpline (NHAI): 1033  
🩺 Medical Helpline (Centralized): 102  
🚨 National Emergency Number: 112  
🌊 Disaster Management / Relief: 1078  
🧠 Mental Health Helpline (Tele MANAS): 14416  
📱 Cyber Crime Helpline: 1930  
👨‍⚖️ Senior Citizen Helpline: 14567  
🐾 Animal Rescue / Wildlife Helpline: 1962  
💊 Poison Information Centre: 1066  
🚴 Traffic Help (Local): 103  
✈️ Railway Helpline: 139  
🧍 Tourist Helpline: 1363
`,
  locationRequired: "📍 Please enable location services to find nearby places.",
  fetching: (type) => `Searching for nearby ${type}s...`,
  error: "Sorry, I'm unable to fetch that information right now. Please try again."
};

export default function SafeRouteChatbot({ currentLocation }) {
  const [messages, setMessages] = useState([
    { 
      id: Date.now(), 
      sender: "bot", 
      text: RESPONSES.greeting,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Memoized message sender
  const addMessage = useCallback((sender, text, data = null) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      sender,
      text,
      data,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // Optimized intent detection
  const detectIntent = useCallback((message) => {
    const lowerMsg = message.toLowerCase().trim();

    // Quick checks for common intents
    if (INTENT_PATTERNS.sos.test(lowerMsg)) return 'sos';
    if (INTENT_PATTERNS.emergencyNumbers.test(lowerMsg)) return 'emergencyNumbers';
    if (INTENT_PATTERNS.hospital.test(lowerMsg)) return 'hospital';
    if (INTENT_PATTERNS.police.test(lowerMsg)) return 'police';
    if (INTENT_PATTERNS.restroom.test(lowerMsg)) return 'restroom';
    
    return 'default';
  }, []);

  // Function to show route on map
  const showRouteToPlace = useCallback((place) => {
    if (!currentLocation) {
      addMessage("bot", "📍 Please enable location to show routes.");
      return;
    }

    // Create a custom event to communicate with the parent component
    const routeEvent = new CustomEvent('setRouteFromChatbot', {
      detail: {
        start: currentLocation,
        end: { lat: place.lat, lng: place.lon },
        placeName: place.name
      }
    });
    window.dispatchEvent(routeEvent);

    addMessage("bot", `🗺️ Showing route to: ${place.name}\n📍 ${place.type || 'Location'}`);
  }, [currentLocation, addMessage]);

  // Optimized API call with error handling
  const fetchNearby = useCallback(async (type) => {
    if (!currentLocation) {
      addMessage("bot", RESPONSES.locationRequired);
      return;
    }

    setIsLoading(true);
    addMessage("bot", RESPONSES.fetching(type));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `${base_url}/nearby?lat=${currentLocation.lat}&lon=${currentLocation.lng}&types=${type}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        addMessage("bot", `No ${type}s found nearby. Try expanding your search area.`);
        return;
      }

      const places = data.results.slice(0, 5);
      
      // Create interactive message with clickable places
      const placesText = places.map((p, i) =>
        `${i + 1}. 📍 ${p.name} (${p.type})`
      ).join("\n");

      addMessage("bot", 
        `Here are the nearest ${type}s:\n${placesText}\n\nClick any location to show route on map.`, 
        {
          type: 'places',
          places: places,
          searchType: type
        }
      );

    } catch (error) {
      console.error("Fetch error:", error);
      addMessage("bot",
        error.name === 'AbortError'
          ? "Request timed out. Please check your connection."
          : RESPONSES.error
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentLocation, addMessage]);

  // Memoized SOS handler
  const handleSOS = useCallback(() => {
    addMessage("bot", RESPONSES.emergencyNumbers);
  }, [addMessage]);

  // Optimized message sender with debouncing
  const sendMessage = useCallback(async (userInput) => {
    if (!userInput.trim() || isLoading) return;

    const trimmedInput = userInput.trim();
    addMessage("user", trimmedInput);
    setInput("");

    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const intent = detectIntent(trimmedInput);

    switch (intent) {
      case 'sos':
        handleSOS();
        break;
      case 'emergencyNumbers':
        addMessage("bot", RESPONSES.emergencyNumbers);
        break;
      case 'hospital':
      case 'police':
      case 'restroom':
        await fetchNearby(intent);
        break;
      default:
        addMessage("bot", RESPONSES.default);
    }
  }, [isLoading, addMessage, detectIntent, handleSOS, fetchNearby]);

  // Quick actions for common requests
  const quickActions = [
    { label: "🏥 Hospitals", intent: "hospital" },
    { label: "🚓 Police", intent: "police" },
    { label: "🚻 Restrooms", intent: "restroom" },
    { label: "🆘 Emergency", intent: "sos" }
  ];

  const handleQuickAction = (intent) => {
    const messages = {
      hospital: "Find nearby hospitals",
      police: "Find police stations",
      restroom: "Find public restrooms",
      sos: "SOS Emergency help"
    };
    sendMessage(messages[intent]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([
      { 
        id: Date.now(), 
        sender: "bot", 
        text: RESPONSES.greeting,
        timestamp: new Date()
      }
    ]);
  };

  // Render places with clickable buttons
  const renderPlaces = (places, searchType) => {
    return (
      <div className="mt-2 space-y-2">
        <div className="text-xs text-gray-600 mb-1">
          Click any location to show route:
        </div>
        {places.map((place, index) => (
          <button
            key={index}
            onClick={() => showRouteToPlace(place)}
            className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-800">
                  {index + 1}. {place.name}
                </div>
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <FaMapMarkerAlt className="text-blue-500" />
                  {place.type || searchType}
                  {place.lat && place.lon && (
                    <span className="text-gray-400 ml-2">
                      ({place.lat.toFixed(4)}, {place.lon.toFixed(4)})
                    </span>
                  )}
                </div>
              </div>
              <FaRoute className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </div>
    );
  };

  if (isMinimized) {
    return (
      <>
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg transition-colors sm:block hidden"
        >
          <div className="fixed bottom-6 right-6 bg-gradient-to-r from-gray-800 to-blue-900 text-white w-80 rounded-2xl shadow-2xl border border-gray-600">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaRobot className="text-xl" />
                <div>
                  <div className="font-semibold">SafeRoute Assistant</div>
                  <div className="text-xs opacity-80 flex items-center gap-1">
                    <FaMapMarkerAlt />
                    {currentLocation ? "Location enabled" : "Location needed"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </button>
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg transition-colors sm:hidden block"
        >
          <div className="fixed bottom-6 right-6 bg-gradient-to-r from-gray-800 to-blue-900 text-white w-12 h-12 rounded-full shadow-2xl border border-gray-600 flex items-center justify-center">
            <FaRobot className="text-xl" />
          </div>
        </button>
      </>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 bg-white shadow-2xl w-80 rounded-2xl overflow-hidden flex flex-col border border-gray-300 max-h-[500px] min-h-[500px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-blue-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaRobot className="text-xl" />
          <div>
            <div className="font-semibold">SafeRoute Assistant</div>
            <div className="text-xs opacity-90 flex items-center gap-1">
              <FaMapMarkerAlt />
              {currentLocation ? "Location enabled" : "Location needed"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearChat}
            className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-gray-50 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line ${
              msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none shadow-md' 
                : 'bg-gray-200 text-gray-800 border border-gray-300 rounded-bl-none shadow-sm'
            }`}>
              <div>{msg.text}</div>
              
              {/* Render interactive places if available */}
              {msg.data?.type === 'places' && renderPlaces(msg.data.places, msg.data.searchType)}
              
              <div className={`text-xs mt-1 ${
                msg.sender === 'user' ? 'text-blue-100' : 'text-gray-600'
              }`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 border border-gray-300 px-3 py-2 rounded-2xl rounded-bl-none">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="border-t border-gray-300 p-3 bg-gray-100">
        <div className="flex flex-wrap gap-1 mb-2">
          {quickActions.map((action) => (
            <button
              key={action.intent}
              onClick={() => handleQuickAction(action.intent)}
              disabled={isLoading}
              className="text-xs bg-gray-300 hover:bg-gray-400 text-gray-800 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-lg transition-colors flex items-center justify-center disabled:cursor-not-allowed"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <FaPaperPlane className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}