import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Categories({
  categories = [],
  products = [],
  user = null,
  onRefresh,
}) {
  const [modalMode, setModalMode] = useState(null); // 'add' or 'edit'
  const [currentCategory, setCurrentCategory] = useState(null);
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const handleOpenAdd = () => {
    setCurrentCategory(null);
    setName("");
    setDisplayOrder(String(categories.length + 1));
    setIsActive(true);
    setFormError("");
    setModalMode("add");
  };

  const handleOpenEdit = (cat) => {
    setCurrentCategory(cat);
    setName(cat.name || "");
    setDisplayOrder(String(cat.display_order ?? 0));
    setIsActive(cat.is_active ?? true);
    setFormError("");
    setModalMode("edit");
  };

  const handleClose = () => {
    setModalMode(null);
    setCurrentCategory(null);
    setFormError("");
  };

  const generateSlug = (str) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    const order = parseInt(displayOrder, 10) || 0;
    const slug = generateSlug(name);

    setSaving(true);
    try {
      if (modalMode === "add") {
        const catPayload = {
          name: name.trim(),
          slug: slug,
          display_order: order,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        };
        if (user?.id) {
          catPayload.user_id = user.id;
        }

        const { error } = await supabase.from("categories").insert([catPayload]);
        if (error) throw error;
        setNotice(`Category "${name}" created successfully.`);
      } else if (modalMode === "edit" && currentCategory) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: name.trim(),
            display_order: order,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentCategory.id);
        if (error) throw error;
        setNotice(`Category "${name}" updated successfully.`);
      }

      handleClose();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Save category failed:", err);
      setFormError(err.message || "Failed to save category in database.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat) => {
    const actionWord = cat.is_active ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionWord} the category "${cat.name}"?`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("categories")
        .update({
          is_active: !cat.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cat.id);

      if (error) throw error;

      setNotice(`Category "${cat.name}" has been ${actionWord}d.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Category status toggle failed:", err);
      alert(err.message || "Could not change category status.");
    }
  };

  return (
    <div className="management-container">
      <div className="management-header">
        <div>
          <h2 className="section-title">Product Categories</h2>
          <p className="section-subtitle">
            Organize products into categories for fast billing and filtering.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          + Add New Category
        </button>
      </div>

      {notice && (
        <div className="alert-success mb-4 flex justify-between items-center">
          <span>{notice}</span>
          <button className="text-sm font-bold" onClick={() => setNotice("")}>
            ✕
          </button>
        </div>
      )}

      <div className="table-card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Category Name</th>
                <th>Slug Code</th>
                <th>Total Products</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    <p className="font-semibold text-gray-800 text-base mb-1">No custom categories yet</p>
                    <p className="text-xs text-gray-500 mb-3">
                      Categories help you organize wholesale items like Cigarettes, Pan Masala, and Paper Cups.
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
                      + Add First Category
                    </button>
                  </td>
                </tr>
              ) : (
                categories.map((cat, idx) => {
                  const productCount = products.filter(
                    (p) => p.category_id === cat.id || p.category === cat.name
                  ).length;

                  return (
                    <tr key={cat.id || idx} className={!cat.is_active ? "row-inactive" : ""}>
                      <td className="font-mono text-gray-500">{cat.display_order ?? idx + 1}</td>
                      <td>
                        <strong className="text-gray-900">{cat.name}</strong>
                      </td>
                      <td className="text-xs font-mono text-gray-500">{cat.slug}</td>
                      <td>
                        <span className="badge-tag">{productCount} items</span>
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge-status ${
                            cat.is_active ? "badge-active" : "badge-inactive"
                          }`}
                        >
                          {cat.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="table-actions-row">
                          <button
                            className="btn-action-icon"
                            title="Edit Category"
                            onClick={() => handleOpenEdit(cat)}
                          >
                            ✏️
                          </button>
                          <button
                            className={`btn-action-icon ${cat.is_active ? "text-red" : "text-green"}`}
                            title={cat.is_active ? "Deactivate" : "Reactivate"}
                            onClick={() => handleToggleActive(cat)}
                          >
                            {cat.is_active ? "🚫" : "🔄"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD / EDIT CATEGORY */}
      {(modalMode === "add" || modalMode === "edit") && (
        <div className="modal-backdrop" onClick={handleClose}>
          <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === "add" ? "Add Category" : "Edit Category"}</h3>
              <button className="btn-icon" onClick={handleClose}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="modal-form">
              {formError && <div className="alert-danger text-sm mb-3">⚠️ {formError}</div>}

              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Pan, Cigarette, Cold Drinks"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Display Order (Sorting)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                />
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>Active Category (Shown on billing screen)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : modalMode === "add" ? "Create Category" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
