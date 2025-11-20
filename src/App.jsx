import { useState, useEffect } from "react";
import Map from "./components/Map";
import { ReportForm } from "./components/ReportForm";
import { RouteForm } from "./components/RouteForm";
import {
  Navigation,
  FileText,
  PlusCircle,
  Share2,
  AlertTriangle,
  MapPin,
  User,
  LogOut,
  Menu,
  X,
  RouteIcon,
} from "lucide-react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./components/auth/index";
import { toast, Toaster } from "react-hot-toast";
import SafeRouteChatbot from "./components/chatbot";
import { jwtDecode } from "jwt-decode";

function Home() {
  const [reports, setReports] = useState([]);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("reports");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [routePoints, setRoutePoints] = useState({});
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false); // New state for mobile report form
  const [userVotes, setUserVotes] = useState({});
  const [editReport, setEditReport] = useState(null); // opens edit form
  const [editDraft, setEditDraft] = useState({
    title: "",
    description: "",
    category: "danger",
    image_url: "",
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [user, setUser] = useState({ sosNumbers: [""] });
  const [profileTab, setProfileTab] = useState("profile");
  const [myPosts, setMyPosts] = useState([]);
  // const token = localStorage.getItem("token");
  // const userId = jwtDecode(token).id;
  const token = localStorage.getItem("token");

  let decodedUser = null;
  let userId = null;

  if (token) {
    try {
      decodedUser = jwtDecode(token);
      userId = decodedUser.id;
    } catch (err) {
      console.error("JWT error, clearing token:", err);
      localStorage.removeItem("token");
    }
  }

  console.log("Decoded user ID:", userId);
  const base_url = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // Function to fetch reports
  const getReports = async () => {
    try {
      const res = await fetch(`${base_url}/api/reportsDetails`);
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  };

  const fetchMyPosts = async () => {
    try {
      const res = await fetch(`${base_url}/api/my-reports`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();
      setMyPosts(
        (data.reports || []).map((p) => ({
          ...p,
          location: [Number(p.latitude), Number(p.longitude)],
        }))
      );
    } catch (err) {
      console.error("Failed to load posts:", err);
    }
  };

  const deletePost = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this post?");
    if (!ok) return;

    try {
      await fetch(`${base_url}/api/report/delete/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      fetchMyPosts();
      getReports();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  useEffect(() => {
    // fetch(`${base_url}/api/reportsDetails`)
    //   .then(res => res.json())
    //   .then(data => setReports(data))
    //   .catch(err => console.error('Failed to fetch reports:', err));
    getReports();
    console.log("Fetched reports:", reports);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        (err) => console.error(err)
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

    window.addEventListener("setRouteFromChatbot", handleRouteFromChatbot);

    return () => {
      window.removeEventListener("setRouteFromChatbot", handleRouteFromChatbot);
    };
  }, []);
  // Listen for navigation state changes from the Map component
  useEffect(() => {
    const handleNavigationStateChange = (event) => {
      setIsNavigating(event.detail.isNavigating);
    };

    window.addEventListener(
      "navigationStateChange",
      handleNavigationStateChange
    );

    return () => {
      window.removeEventListener(
        "navigationStateChange",
        handleNavigationStateChange
      );
    };
  }, []);
  useEffect(() => {
    if (editReport) {
      setEditDraft({
        description: editReport.description || "",
        category: editReport.category || "danger",
        // convert array location to "lat, lng" string for input
        location: Array.isArray(editReport.location)
          ? `${editReport.location[0]}, ${editReport.location[1]}`
          : editReport.location || "",
        image_url: editReport.image_url || "",
      });

      // lock scroll while modal open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [editReport]);

  const handleReportSubmit = (report) => {
    const newReport = { ...report, id: Date.now().toString() };
    setReports([...reports, newReport]);
    setActiveTab("reports");
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
        window.open(
          `https://wa.me/?text=${encodeURIComponent(shareText)}`,
          "_blank"
        );
        toast.success("Opening WhatsApp...");
        return;
      }

      const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(
        shareText
      )}`;
      const newTab = window.open(whatsappWebUrl, "_blank");

      if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
        await navigator.clipboard.writeText(shareUrl);
        toast(
          "WhatsApp not available. Link copied to clipboard — share manually!"
        );
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
        window.open(
          `https://wa.me/${formatted}?text=${encodeURIComponent(emergencyMsg)}`,
          "_blank"
        );
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

  // Called after user clicks upvote/downvote
  // const handleVote = async (reportId, type) => {
  //   try {
  //     console.log("handleVote called with:", { reportId, type });
  //     const res = await fetch(`${base_url}/api/vote`, {
  //       method: "PUT",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ type, reportId }),
  //     });

  //     const data = await res.json();

  //     if (res.ok) {
  //       // ✅ Update UI instantly
  //       setReports(prevReports =>
  //         prevReports.map(report =>
  //           report.id === reportId
  //             ? {
  //               ...report,
  //               upvotes:
  //                 type === "upvote"
  //                   ? report.upvotes + 1
  //                   : report.upvotes,
  //               downvotes:
  //                 type === "downvote"
  //                   ? report.downvotes + 1
  //                   : report.downvotes,
  //             }
  //             : report
  //         )
  //       );
  //     } else {
  //       console.error(data.error);
  //     }
  //   } catch (err) {
  //     console.error("Vote error:", err);
  //   }
  // };
  const handleVote = async (reportId, type) => {
    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("Please log in to vote.");
      return;
    }

    // Prevent spam
    setUserVotes((prev) => ({ ...prev, loading: reportId }));

    // Optimistic update
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              upvotes:
                type === "upvote"
                  ? r.upvotes + (userVotes[reportId] === "upvote" ? -1 : 1)
                  : r.upvotes + (userVotes[reportId] === "upvote" ? -1 : 0),

              downvotes:
                type === "downvote"
                  ? r.downvotes + (userVotes[reportId] === "downvote" ? -1 : 1)
                  : r.downvotes + (userVotes[reportId] === "downvote" ? -1 : 0),
            }
          : r
      )
    );

    // Save user’s new vote
    setUserVotes((prev) => ({
      ...prev,
      [reportId]: userVotes[reportId] === type ? null : type, // toggle off if clicked again
    }));

    try {
      const res = await fetch(`${base_url}/api/vote`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, reportId }),
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        toast.error("Session expired. Please log in again.");
        return;
      }

      // Refresh from server
      getReports();
    } catch (err) {
      toast.error("Vote failed — try again.");
      console.error(err);
    } finally {
      setUserVotes((prev) => ({ ...prev, loading: null }));
    }
  };

  // handle report update submission
  const handleUpdateReport = async (e) => {
    e.preventDefault();

    if (!editReport) return;

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login to update report.");
      return;
    }

    // parse location: if user left "lat, lng", convert to array of numbers
    let parsedLocation = editDraft.location;
    if (typeof parsedLocation === "string" && parsedLocation.includes(",")) {
      const parts = parsedLocation
        .split(",")
        .map((p) => parseFloat(p.trim()))
        .filter((n) => !isNaN(n));
      if (parts.length === 2) parsedLocation = parts;
    }

    const body = {
      title: editDraft.title,
      description: editDraft.description,
      category: editDraft.category,
      location: parsedLocation,
      image_url: editDraft.image_url,
    };

    try {
      const res = await fetch(`${base_url}/api/reports/${editReport.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Update failed");
        return;
      }

      toast.success("Report updated");
      setEditReport(null);
      getReports();
      fetchMyPosts();
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Update failed — check console");
    }
  };

  // handle resolve report
  const handleResolve = async (id) => {
    const token = localStorage.getItem("token");

    const res = await fetch(`${base_url}/api/reports/resolve/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`, // 🔥 FIXED
      },
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.message || "Failed to resolve");
      return;
    }

    toast.success("Report marked resolved!");
    getReports(); // 🔥 FIXED
  };

  const openEditForm = (report) => {
    setEditReport(report); // Opens your old submitForm-style UI
  };

  const handleProfileSave = async (updatedUser) => {
  try {
    // 1️⃣ Clean the contacts properly
    const cleanedContacts = Array.isArray(updatedUser.sosNumbers)
      ? updatedUser.sosNumbers
          .map((n) => (typeof n === "string" ? n.trim() : n))
          .filter((n) => n && n !== "" && n !== "{}")
      : [];

    // 2️⃣ Now send this clean array to backend
    const res = await fetch(`${base_url}/api/sos/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ contacts: cleanedContacts }),
    });

    const data = await res.json();

    // 3️⃣ Update frontend
    if (res.ok) {
      setUser({
        ...user,
        sosNumbers: Array.isArray(data.data.contacts)
          ? data.data.contacts
          : [""],
      });

      setShowProfileModal(false);
    } else {
      console.error(data.error);
      toast.error("Failed to save SOS contacts");
    }
  } catch (err) {
    console.error("Failed to update SOS contacts:", err);
    toast.error("Error updating SOS contacts");
  }
};

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await fetch(`${base_url}/api/sos/get`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const data = await res.json();

        if (res.ok) {
          setUser((prev) => ({
            ...prev,
            sosNumbers: Array.isArray(data.contacts) ? data.contacts : [""],
          }));
        }
      } catch (err) {
        console.log("Error fetching contacts:", err);
      }
    };

    fetchContacts();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-[#1E1E1E] flex flex-col overflow-hidden">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1E1E1E",
            color: "white",
            border: "1px solid #333",
          },
        }}
      />

      {/* Header - Always visible but can be minimal during navigation */}
      <header
        className={`bg-[#1E1E1E] border-b border-gray-800 shadow-xl sticky top-0 z-40 flex-shrink-0 transition-all duration-300 ${
          isNavigating ? "h-16" : ""
        }`}
      >
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
                <span className="text-[#1975d8]">Safe</span>Route
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
              <span className="hidden sm:inline font-semibold text-sm lg:text-base">
                Share
              </span>
            </button>

            <button
              onClick={handleSOS}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white p-2 sm:px-3 sm:py-2 lg:px-4 lg:py-2.5 rounded-xl flex items-center gap-1 sm:gap-2 hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 animate-pulse"
            >
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline font-semibold text-sm lg:text-base">
                SOS
              </span>
            </button>

            {/* {userEmail ? (
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
            )} */}
            {userEmail ? (
              <div className="hidden lg:flex items-center gap-2 bg-[#2C2C2C] rounded-xl px-3 py-2 border border-gray-700">
                <User className="text-[#1975d8] w-4 h-4" />

                {/* CLICKABLE EMAIL / NAME → OPEN PROFILE MODAL */}
                <span
                  onClick={() => setShowProfileModal(true)}
                  className="text-sm font-medium text-gray-200 truncate max-w-[100px] xl:max-w-[120px] cursor-pointer hover:text-white transition"
                  title="Edit Profile"
                >
                  {userEmail}
                </span>

                {/* LOGOUT BUTTON */}
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
                <span className="hidden sm:inline font-semibold text-sm lg:text-base">
                  Login/Signup
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile User Info */}
        {userEmail && !isNavigating && (
          <div className="lg:hidden px-3 sm:px-4 pb-3">
            <div className="flex items-center justify-between bg-[#2C2C2C] rounded-xl px-3 py-2 border border-gray-700">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setShowProfileModal(true)} // 🔥 FIX: open modal
              >
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
            <div
              className={`
              ${
                showSidebar
                  ? "translate-x-0 mt-14"
                  : "-translate-x-full lg:translate-x-0"
              }
              fixed lg:relative inset-y-0 left-0 z-30
              w-full sm:w-96 lg:w-2/3 xl:w-1/3
              bg-[#1E1E1E] border-r border-gray-800
              transition-transform duration-300 ease-in-out
              overflow-hidden flex flex-col
            `}
            >
              <div className="flex-1 overflow-hidden flex flex-col p-3 sm:p-4">
                {/* Tabs */}
                <div className="bg-[#1E1E1E] rounded-xl sm:rounded-2xl border border-gray-800 overflow-hidden flex-shrink-0">
                  <nav className="flex">
                    {[
                      { id: "reports", icon: FileText, label: "Reports" },
                      { id: "submit", icon: PlusCircle, label: "Report" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all duration-200 ${
                          activeTab === tab.id
                            ? "bg-[#1975d8] text-white"
                            : "text-gray-300 hover:text-white hover:bg-[#2C2C2C]"
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
                    {activeTab === "reports" && (
                      <div className="space-y-4">
                        {/* Header with Stats */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-[#1975d8] rounded-xl">
                              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg sm:text-xl font-bold text-white">
                                Safety Reports
                              </h3>
                              <p className="text-xs text-gray-400">
                                Recent {reports.length}{" "}
                                {reports.length === 1 ? "report" : "reports"}
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
                                {
                                  reports.filter(
                                    (r) => r.category.toLowerCase() === "danger"
                                  ).length
                                }
                              </div>
                              <div className="text-red-400 text-xs">Danger</div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 text-center">
                              <div className="text-yellow-400 font-bold text-sm">
                                {
                                  reports.filter(
                                    (r) =>
                                      r.category.toLowerCase() === "caution"
                                  ).length
                                }
                              </div>
                              <div className="text-yellow-400 text-xs">
                                Caution
                              </div>
                            </div>

                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
                              <div className="text-green-400 font-bold text-sm">
                                {
                                  reports.filter(
                                    (r) => r.category.toLowerCase() === "safe"
                                  ).length
                                }
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
                              <h4 className="text-gray-300 font-semibold mb-1">
                                No Reports Yet
                              </h4>
                              <p className="text-gray-500 text-sm">
                                Be the first to report safety information in
                                your area
                              </p>
                            </div>
                          ) : (
                            reports.map((report) => {
                              const isDanger =
                                report.category.toLowerCase() === "danger";
                              const isCaution =
                                report.category.toLowerCase() === "caution";
                              const isSafe =
                                report.category.toLowerCase() === "safe";
                              const isOwner =
                                userId && report.created_by == userId;

                              return (
                                <div
                                  key={report.id}
                                  className={`
                group relative p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[0.99] hover:shadow-2xl cursor-pointer
                ${
                  isDanger
                    ? "bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/30"
                    : isCaution
                    ? "bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border-yellow-500/30"
                    : "bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/30"
                }
              `}
                                >
                                  {/* Glow effect */}
                                  <div
                                    className={`
                absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 blur-sm
                ${
                  isDanger
                    ? "bg-red-500/20"
                    : isCaution
                    ? "bg-yellow-500/20"
                    : "bg-green-500/20"
                }
              `}
                                  ></div>

                                  <div className="relative z-10">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`
                      w-3 h-3 rounded-full animate-pulse
                      ${
                        isDanger
                          ? "bg-red-500"
                          : isCaution
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }
                    `}
                                        ></div>

                                        <span
                                          className={`
                      text-sm font-bold px-3 py-1 rounded-full border
                      ${
                        isDanger
                          ? "bg-red-500/20 text-red-300 border-red-500/40"
                          : isCaution
                          ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                          : "bg-green-500/20 text-green-300 border-green-500/40"
                      }
                    `}
                                        >
                                          {report.category}
                                        </span>
                                      </div>

                                      <span className="text-xs text-gray-400 bg-[#1E1E1E] px-2 py-1 rounded-lg border border-gray-700">
                                        {new Date(
                                          report.date
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>

                                    {/* Image */}
                                    {report.image_url && (
                                      <div className="mb-3">
                                        <img
                                          src={report.image_url}
                                          alt="Report evidence"
                                          className="w-full h-48 object-cover rounded-xl border-2 border-gray-600"
                                        />
                                      </div>
                                    )}

                                    {/* Description */}
                                    <p className="text-gray-200 text-sm mb-3 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-200">
                                      {report.description}
                                    </p>

                                    {/* LOCATION + VOTES + TAG */}
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                                      <div className="flex items-center gap-2 text-gray-400">
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-xs font-mono">
                                          {Array.isArray(report.location)
                                            ? `${report.location[0].toFixed(
                                                4
                                              )}, ${report.location[1].toFixed(
                                                4
                                              )}`
                                            : "Location not available"}
                                        </span>
                                      </div>

                                      {/* Voting */}
                                      <div className="flex items-center gap-3 mt-2">
                                        <button
                                          disabled={
                                            userVotes.loading === report.id
                                          }
                                          onClick={() =>
                                            handleVote(report.id, "upvote")
                                          }
                                          className={`
                        flex items-center gap-1 text-sm px-2 py-1 rounded-md transition-colors
                        ${
                          userVotes[report.id] === "upvote"
                            ? "text-green-500 bg-green-500/10"
                            : "text-gray-400 hover:text-green-400 hover:bg-green-500/10"
                        }
                        ${
                          userVotes.loading === report.id &&
                          "opacity-50 cursor-not-allowed"
                        }
                      `}
                                        >
                                          {userVotes[report.id] === "upvote"
                                            ? "⬆️"
                                            : "⬆"}{" "}
                                          {report.upvotes}
                                        </button>

                                        <button
                                          disabled={
                                            userVotes.loading === report.id
                                          }
                                          onClick={() =>
                                            handleVote(report.id, "downvote")
                                          }
                                          className={`
                        flex items-center gap-1 text-sm px-2 py-1 rounded-md transition-colors
                        ${
                          userVotes[report.id] === "downvote"
                            ? "text-red-500 bg-red-500/10"
                            : "text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        }
                        ${
                          userVotes.loading === report.id &&
                          "opacity-50 cursor-not-allowed"
                        }
                      `}
                                        >
                                          {userVotes[report.id] === "downvote"
                                            ? "⬇️"
                                            : "⬇"}{" "}
                                          {report.downvotes}
                                        </button>
                                      </div>

                                      <div
                                        className={`
                    px-2 py-1 rounded-lg text-xs font-semibold
                    ${
                      isDanger
                        ? "bg-red-500/20 text-red-300"
                        : isCaution
                        ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-green-500/20 text-green-300"
                    }
                  `}
                                      >
                                        {isDanger
                                          ? "🚨 High Risk"
                                          : isCaution
                                          ? "⚠️ Be Cautious"
                                          : "✅ Safe Area"}
                                      </div>
                                    </div>

                                    {/* OWNER-ONLY ACTIONS */}
                                    {isOwner && (
                                      <div className="flex items-center justify-end gap-3 mt-3">
                                        {/* EDIT BUTTON */}
                                        <button
                                          onClick={() => openEditForm(report)}
                                          className="px-3 py-1 text-xs bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded-lg hover:bg-blue-500/30"
                                        >
                                          ✏️ Edit
                                        </button>

                                        {/* MARK AS RESOLVED → delete from DB */}
                                        <button
                                          onClick={async () => {
                                            const ok = window.confirm(
                                              "Is the problem resolved?\n\nThis will permanently remove your report."
                                            );
                                            if (!ok) return;

                                            try {
                                              await deletePost(report.id); // 🔥 use your existing delete logic
                                              toast.success(
                                                "Report marked as resolved"
                                              );
                                            } catch (err) {
                                              console.error(err);
                                              toast.error(
                                                "Failed to mark resolved"
                                              );
                                            }
                                          }}
                                          className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                          Mark as Resolved
                                        </button>
                                      </div>
                                    )}

                                    {/* Hover underline */}
                                    <div
                                      className={`
                  absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 rounded-full
                  group-hover:w-3/4 transition-all duration-300
                  ${
                    isDanger
                      ? "bg-red-500"
                      : isCaution
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }
                `}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === "submit" && (
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
          <div
            className={`
            ${isNavigating ? "w-full" : showSidebar ? "hidden lg:flex" : "flex"}
            flex-1 min-w-0 
            transition-all duration-300
          `}
          >
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
                      <h2 className="text-md sm:text-md font-bold text-white">
                        Route Planning
                      </h2>
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
            <div
              className="absolute inset-0 bg-black/50"
              onClick={closeReportForm}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-[#1E1E1E] rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">
                    Report Incident
                  </h2>
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
        {/* ===== EDIT REPORT MODAL (GLOBAL, ALWAYS CENTERED) ===== */}
        {editReport && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
              className="relative bg-[#1E1E1E] w-full max-w-xl mx-4 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden animate-fadeInUp"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: "85vh" }}
            >
              {/* Close Button */}
              <button
                onClick={() => setEditReport(null)}
                className="absolute top-3 right-3 text-gray-300 hover:text-white p-1"
              >
                <X size={22} />
              </button>

              <div
                className="p-5 overflow-y-auto custom-scrollbar"
                style={{ maxHeight: "calc(85vh - 40px)" }}
              >
                <form onSubmit={handleUpdateReport} className="space-y-5">
                  {/* IMAGE */}
                  <div className="flex flex-col items-center gap-3">
                    {/* IMAGE / PLACEHOLDER */}
                    <div
                      className="w-full h-64 flex items-center justify-center bg-[#2C2C2C] border border-gray-700 rounded-xl cursor-pointer hover:bg-[#3a3a3a] transition"
                      onClick={() =>
                        document.getElementById("edit-image-input").click()
                      }
                    >
                      {editDraft.image_url ? (
                        <img
                          src={editDraft.image_url}
                          className="w-full h-full object-cover rounded-xl"
                          alt="Report"
                        />
                      ) : (
                        <p className="text-gray-400 text-sm text-center px-4">
                          No Image —{" "}
                          <span className="text-blue-400 underline">
                            Click to add image
                          </span>
                        </p>
                      )}
                    </div>

                    {/* REMOVE IMAGE BUTTON */}
                    {editDraft.image_url && (
                      <button
                        onClick={() =>
                          setEditDraft((prev) => ({ ...prev, image_url: "" }))
                        }
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                      >
                        Remove Image
                      </button>
                    )}

                    {/* HIDDEN FILE INPUT */}
                    <input
                      type="file"
                      id="edit-image-input"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditDraft((prev) => ({
                              ...prev,
                              image_url: reader.result,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>

                  {/* DESCRIPTION */}
                  <div>
                    <label className="text-sm text-gray-300">Description</label>
                    <textarea
                      rows="4"
                      value={editDraft.description}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="w-full p-3 rounded-lg bg-[#2C2C2C] border border-gray-700 text-white"
                    />
                  </div>

                  {/* CATEGORY */}
                  <div>
                    <label className="text-sm text-gray-300">Category</label>
                    <select
                      value={editDraft.category}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      className="w-full p-3 rounded-lg bg-[#2C2C2C] border border-gray-700 text-white"
                    >
                      <option value="danger">Danger 🚨</option>
                      <option value="caution">Caution ⚠️</option>
                      <option value="safe">Safe ✅</option>
                    </select>
                  </div>

                  {/* BUTTONS */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditReport(null)}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="relative bg-[#1f1f1f] text-white rounded-xl w-[420px] p-6 shadow-xl border border-gray-700">
              {/* CLOSE BUTTON (X) */}
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-white transition"
              >
                <X size={22} />
              </button>

              {/* Tabs */}
              <div className="flex border-b border-gray-600 mb-4">
                <button
                  className={`px-3 py-2 ${
                    profileTab === "profile" ? "border-b-2 border-blue-500" : ""
                  }`}
                  onClick={() => setProfileTab("profile")}
                >
                  Profile
                </button>

                <button
                  className={`px-3 py-2 ml-4 ${
                    profileTab === "posts" ? "border-b-2 border-blue-500" : ""
                  }`}
                  onClick={() => {
                    setProfileTab("posts");
                    fetchMyPosts();
                  }}
                >
                  My Posts
                </button>
              </div>

              {/* Profile Tab */}
              {profileTab === "profile" && (
                <>
                  <h2 className="text-xl font-semibold mb-5">Edit Profile</h2>
                  <label className="text-sm font-medium">SOS Numbers</label>
                  {(Array.isArray(user.sosNumbers)
                    ? user.sosNumbers
                    : [""]
                  ).map((num, i) => (
                    <div key={i} className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={num}
                        onChange={(e) => {
                          let arr = [...user.sosNumbers];
                          arr[i] = e.target.value;
                          setUser({ ...user, sosNumbers: arr });
                        }}
                        className="w-full bg-[#2c2c2c] border border-gray-600 rounded-lg p-2"
                      />
                      {user.sosNumbers.length > 1 && (
                        <button
                          onClick={() => {
                            let arr = user.sosNumbers.filter(
                              (_, idx) => idx !== i
                            );
                            setUser({ ...user, sosNumbers: arr });
                          }}
                          className="bg-red-600 px-3 rounded-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      setUser({ ...user, sosNumbers: [...user.sosNumbers, ""] })
                    }
                    className="mt-3 bg-blue-600 px-3 py-1 rounded-lg text-sm ml-0"
                  >
                    + Add SOS Number
                  </button>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowProfileModal(false)}
                      className="px-4 py-2 bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleProfileSave(user)}
                      className="px-4 py-2 bg-green-600 rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </>
              )}

              {/* My Posts Tab */}
              {profileTab === "posts" && (
                <div className="max-h-[400px] overflow-y-auto">
                  {myPosts.length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      You haven't created any posts.
                    </p>
                  ) : (
                    myPosts.map((post) => (
                      <div
                        key={post.id}
                        className="bg-[#2b2b2b] p-3 rounded-lg mb-3"
                      >
                        {/* IMAGE */}
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            alt="Post"
                            className="w-full h-40 object-cover rounded-lg mb-3 border border-gray-700"
                          />
                        )}

                        <h3 className="font-semibold">{post.type}</h3>

                        <p className="text-gray-400 text-sm line-clamp-2">
                          {post.description}
                        </p>

                        <div className="flex justify-between mt-2 text-sm">
                          <span>👍 {post.upvotes}</span>
                          <span>👎 {post.downvotes}</span>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() =>
                              setEditReport({
                                ...post,
                                category: post.category || post.type,
                              })
                            } // 🔥 next step fixes this
                            className="bg-blue-600 px-3 py-1 rounded-lg text-sm"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deletePost(post.id)}
                            className="bg-red-600 px-3 py-1 rounded-lg text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
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
