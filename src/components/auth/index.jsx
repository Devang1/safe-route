import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { 
  FaShieldAlt, 
  FaUser, 
  FaLock, 
  FaPhone, 
  FaPlus, 
  FaTimes,
  FaMapMarkerAlt,
  FaBell,
  FaArrowRight
} from "react-icons/fa";

const Auth = () => {
  const [log, setLog] = useState(true);
  const [email, setEmail] = useState("");
  const [logErr, setLogErr] = useState(false);
  const [password, setPassword] = useState("");
  const [cpassword, setCpassword] = useState("");
  const [showSosPopup, setShowSosPopup] = useState(false);
  const [sosContacts, setSosContacts] = useState([""]);

  const navigate = useNavigate();
  const base_url = import.meta.env.REACT_APP_API_URL || "http://localhost:5000";
  // ======= TOAST HELPERS =======
  const passnotmatch = () =>
    toast.error("Both passwords are not same!", {
      duration: 3000,
      position: "top-center",
    });
  const userexists = () =>
    toast.error("This email id is already registered!", {
      duration: 3000,
      position: "top-center",
    });
  const nullerror = () =>
    toast.error("Email and password are required!", {
      duration: 3000,
      position: "top-center",
    });

  // ======= REGISTER =======
  const handleRegistration = async (event) => {
    event.preventDefault();

    if (email === "" || password === "") return nullerror();
    if (password !== cpassword) return passnotmatch();

    try {
      const response = await fetch(`${base_url}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data !== "user already exists") {
        toast.success("Signup successful! Please add your SOS contacts.");
        setShowSosPopup(true);
      } else {
        userexists();
      }
    } catch (err) {
      console.error("Registration error:", err);
      toast.error("Something went wrong. Please try again.");
    }
  };

  // ======= LOGIN =======
  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${base_url}/api/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log("Login response:", data);

      if (response.ok && data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("email", data.email);
        toast.success("Login successful!");
        navigate("/");
      } else {
        setLogErr(true);
        toast.error(data.error || "Invalid email or password");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setLogErr(true);
      toast.error("Server error. Please try again.");
    }
  };

  // ======= SOS CONTACT HANDLERS =======
  const handleSosChange = (index, value) => {
    const updated = [...sosContacts];
    updated[index] = value;
    setSosContacts(updated);
  };

  const addSosField = () => setSosContacts([...sosContacts, ""]);

  const removeSosField = (index) => {
    const updated = sosContacts.filter((_, i) => i !== index);
    setSosContacts(updated);
  };

  const saveSosContacts = async () => {
    try {
      await fetch(`${base_url}/api/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sosContacts }),
      });

      localStorage.setItem("sosContacts", JSON.stringify(sosContacts));
      toast.success("SOS contacts saved successfully!");
      setShowSosPopup(false);
      navigate("/");
    } catch (err) {
      console.error("Error saving SOS:", err);
      toast.error("Failed to save SOS contacts");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-[#1E1E1E] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-8">
        
        {/* Left Side - Branding & Features */}
        <div className="w-full lg:w-1/2 text-center lg:text-left space-y-8">
          <div className="flex items-center justify-center lg:justify-start gap-4">
            <div className="p-3 bg-[#1975d8] rounded-2xl shadow-lg">
              <FaShieldAlt className="text-2xl text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">SafeRoute</h1>
          </div>

          <div className="space-y-6">
            <h2 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
              Your Safety, <br />
              <span className="text-[#1975d8]">Our Priority</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl">
              Real-time safety alerts, emergency contacts, and smart route planning to keep you protected wherever you go.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-[#1975d8]/30 transition-all duration-300">
              <div className="w-12 h-12 bg-[#1975d8] rounded-xl flex items-center justify-center mb-4 mx-auto">
                <FaBell className="text-white text-lg" />
              </div>
              <h3 className="text-white font-semibold mb-2">Smart Alerts</h3>
              <p className="text-gray-400 text-sm">Real-time safety notifications</p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-[#1975d8]/30 transition-all duration-300">
              <div className="w-12 h-12 bg-[#1975d8] rounded-xl flex items-center justify-center mb-4 mx-auto">
                <FaPhone className="text-white text-lg" />
              </div>
              <h3 className="text-white font-semibold mb-2">SOS Emergency</h3>
              <p className="text-gray-400 text-sm">Instant contact with trusted people</p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-[#1975d8]/30 transition-all duration-300">
              <div className="w-12 h-12 bg-[#1975d8] rounded-xl flex items-center justify-center mb-4 mx-auto">
                <FaMapMarkerAlt className="text-white text-lg" />
              </div>
              <h3 className="text-white font-semibold mb-2">Safe Routes</h3>
              <p className="text-gray-400 text-sm">Intelligent path planning</p>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Card */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-[#1E1E1E] rounded-3xl p-8 shadow-2xl border border-gray-800">
            {/* Toggle Buttons */}
            <div className="flex bg-gray-800 rounded-2xl p-1.5 mb-8">
              <button
                className={`flex-1 py-4 px-6 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  log
                    ? "bg-[#1975d8] text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setLog(true)}
              >
                <FaLock className="text-sm" />
                Login
              </button>
              <button
                className={`flex-1 py-4 px-6 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  !log
                    ? "bg-[#1975d8] text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setLog(false)}
              >
                <FaUser className="text-sm" />
                Sign Up
              </button>
            </div>

            {/* Error Message */}
            {logErr && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                <p className="text-red-200 text-sm text-center">
                  Email or Password is not correct
                </p>
              </div>
            )}

            {/* Forms */}
            <div className="space-y-6">
              {log ? (
                // Login Form
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="relative">
                    <FaUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1975d8] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1975d8] focus:border-transparent transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#1975d8] hover:bg-[#1565c0] text-white py-4 rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    Login to Account
                    <FaArrowRight className="text-sm" />
                  </button>
                </form>
              ) : (
                // Signup Form
                <form onSubmit={handleRegistration} className="space-y-6">
                  <div className="relative">
                    <FaUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1975d8] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1975d8] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="password"
                      value={cpassword}
                      onChange={(e) => setCpassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1975d8] focus:border-transparent transition-all"
                    />
                  </div>

                  {cpassword && password !== cpassword && (
                    <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-200 text-xs text-center">
                        Passwords do not match
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[#1975d8] hover:bg-[#1565c0] text-white py-4 rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    Create Account
                    <FaArrowRight className="text-sm" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SOS Popup */}
      {showSosPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1E1E1E] rounded-3xl p-8 w-full max-w-md border border-gray-700 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#1975d8] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FaPhone className="text-white text-2xl" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Emergency Contacts
              </h2>
              <p className="text-gray-400">
                Add trusted contacts for instant SOS alerts
              </p>
            </div>

            <div className="space-y-4 max-h-60 overflow-y-auto mb-6">
              {sosContacts.map((contact, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <FaUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => handleSosChange(index, e.target.value)}
                      placeholder="Contact number or email"
                      className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1975d8] focus:border-transparent text-sm"
                    />
                  </div>
                  {sosContacts.length > 1 && (
                    <button
                      onClick={() => removeSosField(index)}
                      className="p-3 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addSosField}
              className="w-full py-3 border-2 border-dashed border-gray-600 rounded-xl text-gray-400 hover:text-white hover:border-[#1975d8] transition-all duration-300 flex items-center justify-center gap-2 mb-6"
            >
              <FaPlus className="text-sm" />
              Add Another Contact
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSosPopup(false);
                  navigate("/");
                }}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all duration-300"
              >
                Skip
              </button>
              <button
                onClick={saveSosContacts}
                className="flex-1 py-3 bg-[#1975d8] hover:bg-[#1565c0] text-white rounded-xl font-semibold shadow-lg transition-all duration-300"
              >
                Save Contacts
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
};

export default Auth;