import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";
import DashboardView from "@/components/DashboardView";
import LiveView from "@/components/LiveView";
import VodGridView from "@/components/VodGridView";
import FavoritesView from "@/components/FavoritesView";
import SettingsView from "@/components/SettingsView";
import { movies, series } from "@/lib/mock-data";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [globalSearch, setGlobalSearch] = useState("");

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardView onNavigate={setActiveSection} />;
      case "live":
        return <LiveView />;
      case "movies":
        return <VodGridView title="Filmes" items={movies} />;
      case "series":
        return <VodGridView title="Séries" items={series} />;
      case "favorites":
        return <FavoritesView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      {/* Main content */}
      <main className="ml-20 lg:ml-64 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-20 flex items-center px-6 lg:px-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="w-full max-w-xl">
            <SearchBar value={globalSearch} onChange={setGlobalSearch} />
          </div>
        </header>

        {/* Page content */}
        <div className="p-6 lg:p-10">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;
