import { useState,useEffect } from 'react';
import  Map from './components/Map';
import { ReportForm } from './components/ReportForm';
import { RouteForm } from './components/RouteForm';
import { mockReports } from './data/mockData';
import { Navigation, FileText, PlusCircle } from 'lucide-react';
import {BrowserRouter, Navigate, Route,Routes,useNavigate } from "react-router-dom";
import Login from "./components/auth/index";
function Home() {
  const [reports, setReports] = useState([]);
  const navigate=useNavigate();
  const [activeTab, setActiveTab] = useState('reports');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [routePoints, setRoutePoints] = useState({});
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  useEffect(() => {
      fetch('/api/reportsDetails')
        .then(res => res.json())
        .then(data => setReports(data))
        .catch(err => console.error('Failed to fetch reports:', err));
    }, []);

  const handleReportSubmit = (report) => {
    const newReport = {
      ...report,
      id: Date.now().toString(),
    };
    setReports([...reports, newReport]);
    setActiveTab('reports');
  };

  const handleRouteSubmit = (start, end) => {
    setRoutePoints({ start, end });
  };

  return (
    <div className="min-h-screen bg-[#1E1E1E] flex flex-col">
      {/* Header */}
      <header className="bg-[#1E1E1E] shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Navigation className="text-blue-600" />
            <div><span className='text-blue-600'>Safe</span>Route</div>
          </h1>
          <button onClick={()=>navigate("/login")} className="text-[1vw] font-medium text-[#F5F5F5] bg-[#1975d8] w-[12vw] ml-17 md:ml-20  py-1.5 px-5 flex items-center justify-center md:text-[1.2vw] md:py-0.5 md:px-5 cursor-pointer rounded-md" >Login / Sign up</button>
        </div>
      </header>

      {/* Main Content */}
      <div className='w-full bg-[#121212]'>

      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-1/3 space-y-4">
          {/* Tabs */}
          <div className="bg-[#1E1E1E] rounded-lg shadow">
            <nav className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-500 bg-[#1E1E1E]">
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex-1 px-4 py-3 text-sm font-medium text-left sm:text-center ${
                  activeTab === 'reports'
                    ? 'text-blue-600 bg-blue-200'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <FileText className="inline-block mr-2" size={20} />
                Reports
              </button>
              <button
                onClick={() => setActiveTab('submit')}
                className={`flex-1 px-4 py-3 text-sm font-medium text-left sm:text-center ${
                  activeTab === 'submit'
                    ? 'text-blue-600 bg-blue-200'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <PlusCircle className="inline-block mr-2" size={20} />
                Submit
              </button>
              <button
                onClick={() => setActiveTab('route')}
                className={`flex-1 px-4 py-3 text-sm font-medium text-left sm:text-center ${
                  activeTab === 'route'
                    ? 'text-blue-600 bg-blue-200'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Navigation className="inline-block mr-2" size={20} />
                Route
              </button>
            </nav>
          </div>

          {/* Tab Panels */}
          {activeTab === 'reports' && (
            <div className="space-y-4 overflow-y-auto max-h-[60vh]">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-[#1E1E1E] p-4 rounded-lg shadow space-y-2"
                >
                  <div className="flex items-center justify-between ">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        report.category.toLowerCase() === 'danger'
                          ? 'bg-red-100 text-red-800'
                          : report.category.toLowerCase() === 'caution'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {report.category}
                    </span>
                    <span className="text-sm text-[#A0A0A0]">
                      {new Date(report.date).toISOString().split("T")[0] } {report.time}   
                    </span>
                  </div>
                  <p className="text-[#E0E0E0]">{report.description}</p>
                  <p className="text-[#A0A0A0]">Lat:{report.location[0].toFixed(4)} Long:{report.location[1].toFixed(4)}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'submit' && <ReportForm onSubmit={handleReportSubmit} />}

          {activeTab === 'route' && (
            <RouteForm
              onRouteSubmit={handleRouteSubmit}
              useCurrentLocation={useCurrentLocation}
              onUseCurrentLocationChange={setUseCurrentLocation}
            />
          )}
        </div>

        {/* Map Area */}
        <div className="w-full lg:w-2/3">
          <div className="bg-white rounded-lg shadow overflow-hidden h-[60vh] lg:h-full">
            <Map
              reports={reports}
              startPoint={routePoints.start}
              endPoint={routePoints.end}
              showHeatmap={showHeatmap}
            />
          </div>
        </div>
      </main>
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
      </Routes>
    </BrowserRouter>
  );
}
export default App;