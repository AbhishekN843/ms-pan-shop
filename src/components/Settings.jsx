import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Settings({
  shopSettings = {},
  user = null,
  onSaveSettings,
  onLogout,
}) {
  const [shopName, setShopName] = useState(shopSettings.shop_name || "MS PAN SHOP");
  const [tagline, setTagline] = useState(
    shopSettings.tagline || "Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups"
  );
  const [phone, setPhone] = useState(shopSettings.phone || "");
  const [address, setAddress] = useState(shopSettings.address || "");
  const [footerMessage, setFooterMessage] = useState(
    shopSettings.footer_message || "Thank you for your business! Visit again for wholesale rates."
  );

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice("");
    setError("");

    if (!shopName.trim()) {
      setError("Shop name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: 1,
        shop_name: shopName.trim(),
        tagline: tagline.trim(),
        phone: phone.trim(),
        address: address.trim(),
        footer_message: footerMessage.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from("shop_settings")
        .upsert(payload, { onConflict: "id" });

      if (upsertErr) throw upsertErr;

      setNotice("Shop settings updated successfully! Receipts will now reflect these details.");
      if (onSaveSettings) onSaveSettings(payload);
    } catch (err) {
      console.error("Save settings error:", err);
      setError(err.message || "Failed to update shop settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="management-container settings-view">
      <div className="management-header">
        <div>
          <h2 className="section-title">Shop & Receipt Settings</h2>
          <p className="section-subtitle">
            Configure your shop branding, contact information, and printed receipt header/footer.
          </p>
        </div>
      </div>

      {notice && <div className="alert-success mb-4">✓ {notice}</div>}
      {error && <div className="alert-danger mb-4">⚠️ {error}</div>}

      <div className="settings-cards-grid">
        {/* SHOP METADATA FORM */}
        <div className="settings-card">
          <h3 className="card-section-title">Shop Branding & Receipt Info</h3>
          <p className="text-xs text-gray-500 mb-4">
            These details appear at the top and bottom of every printed receipt and PDF.
          </p>

          <form onSubmit={handleSubmit} className="settings-form">
            <div className="form-group">
              <label className="form-label">Shop Name *</label>
              <input
                type="text"
                className="form-input"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="MS PAN SHOP"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tagline / Business Line</label>
              <input
                type="text"
                className="form-input"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Pan, Cigarette, Confectionery & Drinks"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shop Phone / WhatsApp</label>
              <input
                type="text"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shop Address</label>
              <textarea
                rows="2"
                className="form-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Main Market Road, Near Station"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Footer Note</label>
              <input
                type="text"
                className="form-input"
                value={footerMessage}
                onChange={(e) => setFooterMessage(e.target.value)}
                placeholder="Thank you! Visit again."
              />
            </div>

            <div className="pt-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving Changes..." : "Save Shop Settings"}
              </button>
            </div>
          </form>
        </div>

        {/* OWNER ACCOUNT & SYSTEM INFO */}
        <div className="settings-side-column">
          {/* Account Card */}
          <div className="settings-card">
            <h3 className="card-section-title">Owner Account</h3>
            <div className="user-profile-badge mb-4">
              <div className="user-avatar">👤</div>
              <div>
                <div className="font-semibold text-gray-900">
                  {user?.email || "Shop Owner"}
                </div>
                <div className="text-xs text-green font-medium">● Authenticated Owner</div>
              </div>
            </div>

            <button className="btn btn-secondary w-full" onClick={onLogout}>
              🚪 Sign Out of Shop
            </button>
          </div>

          {/* Database & Cloud Connection Card */}
          <div className="settings-card">
            <h3 className="card-section-title">Cloud Infrastructure</h3>
            <div className="text-xs space-y-2 text-gray-600">
              <div className="flex justify-between border-b pb-1">
                <span>Database:</span>
                <span className="font-mono text-gray-800">Supabase PostgreSQL</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>Database Project:</span>
                <span className="font-mono text-blue-700">MS-PAN</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>Timezone:</span>
                <span className="font-medium">Asia/Kolkata (IST)</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>PDF Engine:</span>
                <span className="font-medium text-green">Offline jsPDF (0 paid APIs)</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>Printing:</span>
                <span className="font-medium">Direct Browser & Thermal 80mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
