import React, { useState, useEffect } from "react";

export default function Header({
  activeTab,
  onSelectTab,
  user,
  shopSettings,
  onLogout,
}) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: "new-bill", label: "New Bill", icon: "🧾", highlight: true },
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "products", label: "Products", icon: "📦" },
    { id: "categories", label: "Categories", icon: "🏷️" },
    { id: "sales", label: "Sales History", icon: "📜" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <header className="app-header">
      <div className="header-top-row">
        {/* Brand */}
        <div className="header-brand" onClick={() => onSelectTab("new-bill")}>
          <div className="brand-logo-pill">MS</div>
          <div>
            <h1 className="brand-title">{shopSettings?.shop_name || "MS PAN SHOP"}</h1>
            <p className="brand-subtitle">{shopSettings?.tagline || "Billing Application"}</p>
          </div>
        </div>

        {/* Center Live Time */}
        <div className="header-clock-pill">
          <span className="clock-pulse" />
          <span className="clock-time font-mono">{currentTime} (IST)</span>
        </div>

        {/* User / Logout */}
        <div className="header-user-actions">
          <div className="user-info-text">
            <span className="text-xs font-semibold text-gray-800">
              {user?.email?.split("@")[0] || "Owner"}
            </span>
            <span className="text-2xs text-green font-medium">Active</span>
          </div>
          <button className="btn-logout-icon" onClick={onLogout} title="Logout">
            🚪
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="header-nav-bar">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-tab-btn ${activeTab === item.id ? "active" : ""} ${
              item.highlight ? "tab-highlight" : ""
            }`}
            onClick={() => onSelectTab(item.id)}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
