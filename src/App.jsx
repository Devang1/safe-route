import { useState, useEffect } from 'react';
import Map from './components/Map';
import { ReportForm } from './components/ReportForm';
import { RouteForm } from './components/RouteForm';
import { Navigation, FileText, PlusCircle, Share2, AlertTriangle, MapPin, User, LogOut, Menu, X, RouteIcon } from 'lucide-react';
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./components/auth/index";
import { toast, Toaster } from 'react-hot-toast';
import SafeRouteChatbot from './components/chatbot';

function Home() {
  const [reports, setReports] = useState([]);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [routePoints, setRoutePoints] = useState({});
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false); // New state for mobile report form
const base_url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  useEffect(() => {
    fetch(`${base_url}/api/reportsDetails`)
      .then(res => res.json())
      .then(data => setReports(data))
      .catch(err => console.error('Failed to fetch reports:', err));
    console.log("Fetched reports:", reports);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.error(err)
      );
    }

    setUserEmail(localStorage.getItem("email"));
  }, []);
  // Add this useEffect to your Home component
useEffect(() => {
  const handleRouteFromChatbot = (event) => {
    const { start, end, placeName } = event.detail;
    setRoutePoints({ start, end });
    setIsPlanningRoute(false);
    toast.success(`Route set to: ${placeName}`);
  };

  window.addEventListener('setRouteFromChatbot', handleRouteFromChatbot);
  
  return () => {
    window.removeEventListener('setRouteFromChatbot', handleRouteFromChatbot);
  };
}, []);
  // Listen for navigation state changes from the Map component
  useEffect(() => {
    const handleNavigationStateChange = (event) => {
      setIsNavigating(event.detail.isNavigating);
    };

    window.addEventListener('navigationStateChange', handleNavigationStateChange);
    
    return () => {
      window.removeEventListener('navigationStateChange', handleNavigationStateChange);
    };
  }, []);

  const handleReportSubmit = (report) => {
    const newReport = { ...report, id: Date.now().toString() };
    setReports([...reports, newReport]);
    setActiveTab('reports');
    setShowSidebar(false);
    setShowReportForm(false); // Close mobile report form
  };

  const handleRouteSubmit = (start, end) => {
    setRoutePoints({ start, end });
    setIsPlanningRoute(false);
  };

  const clearRoute = () => {
    setRoutePoints({});
    setIsPlanningRoute(false);
  };
  
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    setUserEmail(null);
    navigate("/");
  };

  const handleShareLocation = async () => {
    if (!currentLocation) {
      toast.error("Location not available yet. Please enable GPS.");
      return;
    }

    const shareUrl = `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`;
    const shareText = `📍 My current location:\n${shareUrl}\nShared via SafeRoute 🚗`;

    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile && navigator.share) {
        await navigator.share({
          title: "My Live Location",
          text: "Check out my live location on Google Maps",
          url: shareUrl,
        });
        toast.success("Location shared successfully!");
        return;
      }

      if (isMobile) {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
        toast.success("Opening WhatsApp...");
        return;
      }

      const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      const newTab = window.open(whatsappWebUrl, "_blank");

      if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
        await navigator.clipboard.writeText(shareUrl);
        toast("WhatsApp not available. Link copied to clipboard — share manually!");
      }
    } catch (err) {
      console.error("Share failed:", err);
      toast.error("Failed to share. Please try again.");
    }
  };

  const handleSOS = async () => {
    if (!currentLocation) {
      toast.error("Unable to access location. Please enable GPS.");
      return;
    }

    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email"); 

    if (!token || !email) {
      toast.error("Please log in to use SOS feature.");
      return;
    }

    let sosContacts = JSON.parse(localStorage.getItem("sosContacts")) || [];

    if (sosContacts.length === 0) {
      try {
        const response = await fetch(`${base_url}/api/sos?email=${email}`);
        if (response.ok) {
          const data = await response.json();
          sosContacts = data.contacts || [];
        }
      } catch (err) {
        console.error("Error fetching SOS contacts:", err);
      }
    }

    if (sosContacts.length === 0) {
      toast.error("No SOS contacts found! Please set them in your profile.");
      return;
    }

    const emergencyMsg = `🚨 EMERGENCY ALERT!\nI'm in danger, please help!\nMy location: https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}\nSent via SafeRoute App.`;

    sosContacts.forEach((contact) => {
      const formatted = contact.replace(/[^0-9]/g, "");
      if (formatted.length >= 10) {
        window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(emergencyMsg)}`, "_blank");
      }
    });

    try {
      const alertSound = new Audio("/sos-alert.mp3");
      await alertSound.play();
    } catch {
      console.warn("Alert sound could not be played automatically.");
    }

    try {
      await fetch(`${base_url}/api/sos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          contacts: sosContacts,
          location: currentLocation,
        }),
      });
    } catch (err) {
      console.error("Error sending SOS to backend:", err);
    }

    toast.success("🚨 SOS alerts sent to your emergency contacts!");
  };

  // Open report form in mobile
  const openReportForm = () => {
    setShowReportForm(true);
    setShowSidebar(false);
  };

  // Close mobile report form
  const closeReportForm = () => {
    setShowReportForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-[#1E1E1E] flex flex-col overflow-hidden">
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#1E1E1E',
            color: 'white',
            border: '1px solid #333',
          },
        }}
      />

      {/* Header - Always visible but can be minimal during navigation */}
      <header className={`bg-[#1E1E1E] border-b border-gray-800 shadow-xl sticky top-0 z-40 flex-shrink-0 transition-all duration-300 ${isNavigating ? 'h-16' : ''}`}>
        <div className="w-full px-3 sm:px-4 py-3 flex justify-between items-center">
          {/* Left Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!isNavigating && (
              <button 
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                {showSidebar ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-[#1975d8] rounded-xl shadow-lg">
                <Navigation className="text-white w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white whitespace-nowrap">
                <span className='text-[#1975d8]'>Safe</span>Route
              </h1>
            </div>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
            <button
              onClick={handleShareLocation}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white p-2 sm:px-3 sm:py-2 lg:px-4 lg:py-2.5 rounded-xl flex items-center gap-1 sm:gap-2 hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline font-semibold text-sm lg:text-base">Share</span>
            </button>

            <button
              onClick={handleSOS}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white p-2 sm:px-3 sm:py-2 lg:px-4 lg:py-2.5 rounded-xl flex items-center gap-1 sm:gap-2 hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 animate-pulse"
            >
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline font-semibold text-sm lg:text-base">SOS</span>
            </button>

            {userEmail ? (
              <div className="hidden lg:flex items-center gap-2 bg-[#2C2C2C] rounded-xl px-3 py-2 border border-gray-700">
                <User className="text-[#1975d8] w-4 h-4" />
                <span className="text-sm font-medium text-gray-200 truncate max-w-[100px] xl:max-w-[120px]">
                  {userEmail}
                </span>
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg transition-all duration-200 hover:scale-110"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="bg-gradient-to-r from-[#1975d8] to-blue-600 text-white p-2 sm:px-4 sm:py-2 lg:px-6 lg:py-2.5 rounded-xl flex items-center gap-1 sm:gap-2 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline font-semibold text-sm lg:text-base">Login/Signup</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile User Info */}
        {userEmail && !isNavigating && (
          <div className="lg:hidden px-3 sm:px-4 pb-3">
            <div className="flex items-center justify-between bg-[#2C2C2C] rounded-xl px-3 py-2 border border-gray-700">
              <div className="flex items-center gap-2">
                <User className="text-[#1975d8] w-4 h-4" />
                <span className="text-sm font-medium text-gray-200 truncate flex-1">
                  {userEmail}
                </span>
              </div>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg transition-all duration-200 text-sm ml-2"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full relative overflow-hidden">
        <div className="h-full flex">
          {/* Sidebar - Hidden during navigation */}
          {!isNavigating && (
            <div className={`
              ${showSidebar ? 'translate-x-0 mt-14' : '-translate-x-full lg:translate-x-0'}
              fixed lg:relative inset-y-0 left-0 z-30
              w-full sm:w-96 lg:w-2/3 xl:w-1/3
              bg-[#1E1E1E] border-r border-gray-800
              transition-transform duration-300 ease-in-out
              overflow-hidden flex flex-col
            `}>
              <div className="flex-1 overflow-hidden flex flex-col p-3 sm:p-4">
                {/* Tabs */}
                <div className="bg-[#1E1E1E] rounded-xl sm:rounded-2xl border border-gray-800 overflow-hidden flex-shrink-0">
                  <nav className="flex">
                    {[
                      { id: 'reports', icon: FileText, label: 'Reports' },
                      { id: 'submit', icon: PlusCircle, label: 'Report' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all duration-200 ${
                          activeTab === tab.id
                            ? 'bg-[#1975d8] text-white'
                            : 'text-gray-300 hover:text-white hover:bg-[#2C2C2C]'
                        }`}
                      >
                        <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden xs:inline">{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden bg-[#1E1E1E] rounded-xl sm:rounded-2xl border border-gray-800 mt-3 sm:mt-4 max-h-[80vh] ">
                  <div className="h-full  p-3 sm:p-4 overflow-auto">
                    {activeTab === 'reports' && (
  <div className="space-y-4 ">
    {/* Header with Stats */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-[#1975d8] rounded-xl">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white">Safety Reports</h3>
          <p className="text-xs text-gray-400">
            {reports.length} {reports.length === 1 ? 'report' : 'reports'} in your area
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      </div>
    </div>

    {/* Quick Stats */}
    {reports.length > 0 && (
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
          <div className="text-red-400 font-bold text-sm">
            {reports.filter(r => r.category.toLowerCase() === 'danger').length}
          </div>
          <div className="text-red-400 text-xs">Danger</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 text-center">
          <div className="text-yellow-400 font-bold text-sm">
            {reports.filter(r => r.category.toLowerCase() === 'caution').length}
          </div>
          <div className="text-yellow-400 text-xs">Caution</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
          <div className="text-green-400 font-bold text-sm">
            {reports.filter(r => r.category.toLowerCase() === 'safe').length}
          </div>
          <div className="text-green-400 text-xs">Safe</div>
        </div>
      </div>
    )}

    {/* Reports List */}
    <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar px-1">
      {reports.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-3 bg-[#2C2C2C] rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-500" />
          </div>
          <h4 className="text-gray-300 font-semibold mb-1">No Reports Yet</h4>
          <p className="text-gray-500 text-sm">Be the first to report safety information in your area</p>
        </div>
      ) : (
        reports.map((report) => {
          const isDanger = report.category.toLowerCase() === 'danger';
          const isCaution = report.category.toLowerCase() === 'caution';
          const isSafe = report.category.toLowerCase() === 'safe';
          
          return (
            <div 
              key={report.id} 
              className={`
                group relative p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[0.9] hover:shadow-2xl cursor-pointer max-w-90 max-h-90
                ${isDanger 
                  ? 'bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/30 hover:border-red-500/50' 
                  : isCaution 
                  ? 'bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50'
                  : 'bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/30 hover:border-green-500/50'
                }
              `}
            >
              {/* Glow effect */}
              <div className={`
                absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm
                ${isDanger ? 'bg-red-500/20' : isCaution ? 'bg-yellow-500/20' : 'bg-green-500/20'}
              `}></div>

              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`
                      w-3 h-3 rounded-full animate-pulse
                      ${isDanger ? 'bg-red-500' : isCaution ? 'bg-yellow-500' : 'bg-green-500'}
                    `}></div>
                    <span className={`
                      text-sm font-bold px-3 py-1 rounded-full border
                      ${isDanger 
                        ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                        : isCaution 
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                        : 'bg-green-500/20 text-green-300 border-green-500/40'
                      }
                    `}>
                      {report.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 bg-[#1E1E1E] px-2 py-1 rounded-lg border border-gray-700">
                      {new Date(report.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-200 text-sm mb-3 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-200">
                  {report.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-mono">
                      {report.location[0].toFixed(4)}, {report.location[1].toFixed(4)}
                    </span>
                  </div>
                  <div className={`
                    px-2 py-1 rounded-lg text-xs font-semibold
                    ${isDanger 
                      ? 'bg-red-500/20 text-red-300' 
                      : isCaution 
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-green-500/20 text-green-300'
                    }
                  `}>
                    {isDanger ? '🚨 High Risk' : isCaution ? '⚠️ Be Cautious' : '✅ Safe Area'}
                  </div>
                </div>

                {/* Hover effect line */}
                <div className={`
                  absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 rounded-full
                  group-hover:w-3/4 transition-all duration-300
                  ${isDanger ? 'bg-red-500' : isCaution ? 'bg-yellow-500' : 'bg-green-500'}
                `}></div>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
)}

                    {activeTab === 'submit' && (
                      <div className="h-full">
                        <ReportForm onSubmit={handleReportSubmit} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map Container - Full screen during navigation */}
          <div className={`
            ${isNavigating ? 'w-full' : showSidebar ? 'hidden lg:flex' : 'flex'}
            flex-1 min-w-0 
            transition-all duration-300
          `}>
            <div className="flex-1 bg-[#1E1E1E] rounded-none lg:rounded-2xl overflow-hidden relative">
              <Map
                reports={reports}
                startPoint={routePoints.start}
                endPoint={routePoints.end}
                showHeatmap={showHeatmap}
              />
              
              {/* RouteForm - Hidden during navigation */}
              {!isNavigating && (
                <div className="absolute top-0.5 left-4 right-4 z-10">
                  <div className="bg-[#1E1E1E]/95 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-2xl p-2 sm:p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <RouteIcon className="w-3 h-3 text-[#1975d8]" />
                      <h2 className="text-md sm:text-md font-bold text-white">Route Planning</h2>
                    </div>
                    <RouteForm
                      onRouteSubmit={handleRouteSubmit}
                      useCurrentLocation={useCurrentLocation}
                      onUseCurrentLocationChange={setUseCurrentLocation}
                      currentLocation={currentLocation}
                      isPlanningRoute={isPlanningRoute}
                      onPlanningRouteChange={setIsPlanningRoute}
                      compact={true}
                    />
                  </div>
                </div>
              )}

              {/* Mobile Floating Action Button for Report */}
              {!isNavigating && !showSidebar && (
                <div className="lg:hidden fixed bottom-6 left-6 z-30">
                  <button
                    onClick={openReportForm}
                    className="bg-gradient-to-r from-[#1975d8] to-blue-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-200 flex items-center justify-center"
                  >
                    <PlusCircle className="w-6 h-6" />
                  </button>
                </div>
              )}

              <SafeRouteChatbot currentLocation={currentLocation} />
            </div>
          </div>
        </div>

        {/* Mobile Report Form Overlay */}
        {showReportForm && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={closeReportForm} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-[#1E1E1E] rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">Report Incident</h2>
                  <button
                    onClick={closeReportForm}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="p-4 max-h-[calc(90vh-80px)] overflow-y-auto">
                  <ReportForm onSubmit={handleReportSubmit} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Overlay */}
        {showSidebar && !isNavigating && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chatbot" element={<SafeRouteChatbot />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;