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
    { id: "sales", label: "History", icon: "📜" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <>
      {/* Top Application Header */}
      <header className="app-header">
        <div className="header-top-row">
          {/* Brand */}
          <div className="header-brand" onClick={() => onSelectTab("new-bill")}>
            <div className="brand-logo-pill">MS</div>
            <div className="brand-text-container">
              <h1 className="brand-title">{shopSettings?.shop_name || "MS PAN SHOP"}</h1>
              <p className="brand-subtitle">{shopSettings?.tagline || "Point of Sale"}</p>
            </div>
          </div>

          {/* Center Live Time (Desktop/Tablet) */}
          <div className="header-clock-pill desktop-only">
            <span className="clock-pulse" />
            <span className="clock-time font-mono">{currentTime} (IST)</span>
          </div>

          {/* User / Logout */}
          <div className="header-user-actions">
            <div className="user-info-text">
              <span className="user-email-label">
                {user?.email?.split("@")[0] || "Owner"}
              </span>
              <span className="text-2xs text-green font-medium">● Online</span>
            </div>
            <button className="btn-logout-icon" onClick={onLogout} title="Logout">
              🚪
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs (Desktop only) */}
        <nav className="header-nav-bar desktop-only">
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

      {/* MOBILE BOTTOM NAVIGATION BAR (Android Native App Style) */}
      <nav className="mobile-bottom-nav-bar mobile-only">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`bottom-nav-item ${activeTab === item.id ? "active" : ""}`}
            onClick={() => onSelectTab(item.id)}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
