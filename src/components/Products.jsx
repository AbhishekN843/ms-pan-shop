import React, { useState, useMemo } from "react";
import { formatINR } from "../lib/utils";
import { supabase } from "../lib/supabase";

export default function Products({
  products = [],
  categories = [],
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [filterActive, setFilterActive] = useState("active"); // 'active', 'inactive', 'all'
  const [sortBy, setSortBy] = useState("name-asc");

  // Modal states
  const [modalMode, setModalMode] = useState(null); // 'add', 'edit', 'stock'
  const [currentProduct, setCurrentProduct] = useState(null);

  // Form states
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [unit, setUnit] = useState("piece");
  const [isActive, setIsActive] = useState(true);

  // Stock quick adjustment state
  const [stockAdjustment, setStockAdjustment] = useState("10");
  const [stockAction, setStockAction] = useState("ADD"); // 'ADD', 'SUB'

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const unitsList = ["piece", "packet", "glass", "cup", "box", "bottle", "pouch"];

  // Open Add Modal
  const handleOpenAdd = () => {
    setCurrentProduct(null);
    setName("");
    setCategoryId(categories[0]?.id || "");
    setSku("");
    setSellingPrice("");
    setPurchasePrice("");
    setStockQuantity("0");
    setUnit("piece");
    setIsActive(true);
    setFormError("");
    setModalMode("add");
  };

  // Open Edit Modal
  const handleOpenEdit = (prod) => {
    setCurrentProduct(prod);
    setName(prod.name || "");
    setCategoryId(prod.category_id || categories[0]?.id || "");
    setSku(prod.sku || "");
    setSellingPrice(String(prod.selling_price || ""));
    setPurchasePrice(prod.purchase_price != null ? String(prod.purchase_price) : "");
    setStockQuantity(String(prod.stock_quantity ?? 0));
    setUnit(prod.unit || "piece");
    setIsActive(prod.is_active ?? true);
    setFormError("");
    setModalMode("edit");
  };

  // Open Quick Stock Adjust Modal
  const handleOpenStockAdjust = (prod) => {
    setCurrentProduct(prod);
    setStockAdjustment("10");
    setStockAction("ADD");
    setFormError("");
    setModalMode("stock");
  };

  // Close Modal
  const handleCloseModal = () => {
    setModalMode(null);
    setCurrentProduct(null);
    setFormError("");
  };

  // Handle Save (Add or Edit)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Product name is required.");
      return;
    }

    const price = parseFloat(sellingPrice);
    if (isNaN(price) || price < 0) {
      setFormError("Please enter a valid, non-negative selling price.");
      return;
    }

    const pPrice = purchasePrice.trim() !== "" ? parseFloat(purchasePrice) : null;
    if (pPrice !== null && (isNaN(pPrice) || pPrice < 0)) {
      setFormError("Purchase price must be a valid non-negative number.");
      return;
    }

    const stock = parseInt(stockQuantity, 10);
    if (isNaN(stock) || stock < 0) {
      setFormError("Stock quantity must be zero or a positive whole number.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId || null,
        sku: sku.trim() || null,
        selling_price: price,
        purchase_price: pPrice,
        stock_quantity: stock,
        unit: unit.trim() || "piece",
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (modalMode === "add") {
        const { error } = await supabase.from("products").insert([payload]);
        if (error) throw error;
        setNotice(`Product "${name}" added successfully.`);
      } else if (modalMode === "edit" && currentProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", currentProduct.id);
        if (error) throw error;
        setNotice(`Product "${name}" updated successfully.`);
      }

      handleCloseModal();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Save product failed:", err);
      setFormError(err.message || "Failed to save product in database.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Quick Stock Update
  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (!currentProduct) return;

    const delta = parseInt(stockAdjustment, 10);
    if (isNaN(delta) || delta <= 0) {
      setFormError("Enter a valid positive number for stock adjustment.");
      return;
    }

    const currentStock = currentProduct.stock_quantity ?? 0;
    const newStock = stockAction === "ADD" ? currentStock + delta : currentStock - delta;

    if (newStock < 0) {
      setFormError(`Cannot reduce stock below 0 (Current: ${currentStock}).`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          stock_quantity: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentProduct.id);

      if (error) throw error;

      setNotice(
        `Stock for "${currentProduct.name}" updated to ${newStock} ${currentProduct.unit || "pcs"}.`
      );
      handleCloseModal();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Stock adjust failed:", err);
      setFormError(err.message || "Failed to adjust stock.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active/Inactive (Safe deactivation to preserve historical sales)
  const handleToggleActive = async (prod) => {
    const actionWord = prod.is_active ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionWord} "${prod.name}"? Previous billing records will remain intact.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({
          is_active: !prod.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prod.id);

      if (error) throw error;

      setNotice(`"${prod.name}" has been ${actionWord}d.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Status toggle failed:", err);
      alert(err.message || "Could not change product status.");
    }
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Status filter
        if (filterActive === "active" && !p.is_active) return false;
        if (filterActive === "inactive" && p.is_active) return false;

        // Category filter
        if (selectedCategory !== "ALL") {
          if (p.category_id !== selectedCategory && p.category !== selectedCategory) {
            return false;
          }
        }

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = (p.name || "").toLowerCase().includes(q);
          const matchSku = (p.sku || "").toLowerCase().includes(q);
          return matchName || matchSku;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") return (a.name || "").localeCompare(b.name || "");
        if (sortBy === "name-desc") return (b.name || "").localeCompare(a.name || "");
        if (sortBy === "price-asc") return (a.selling_price || 0) - (b.selling_price || 0);
        if (sortBy === "price-desc") return (b.selling_price || 0) - (a.selling_price || 0);
        if (sortBy === "stock-asc") return (a.stock_quantity || 0) - (b.stock_quantity || 0);
        if (sortBy === "stock-desc") return (b.stock_quantity || 0) - (a.stock_quantity || 0);
        return 0;
      });
  }, [products, filterActive, selectedCategory, search, sortBy]);

  return (
    <div className="management-container">
      {/* Top action bar */}
      <div className="management-header">
        <div>
          <h2 className="section-title">Product Catalog & Inventory</h2>
          <p className="section-subtitle">
            Manage shop items, selling prices, stock quantities, and units.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          + Add New Product
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

      {/* Filter and Search Bar */}
      <div className="filter-controls-card">
        <div className="filter-grid">
          {/* Search */}
          <div className="search-box">
            <input
              type="text"
              className="form-input"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.slug} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive / Deactivated</option>
            <option value="all">All Products</option>
          </select>

          {/* Sort By */}
          <select
            className="form-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name-asc">Sort: Name (A-Z)</option>
            <option value="name-desc">Sort: Name (Z-A)</option>
            <option value="price-asc">Sort: Price (Low to High)</option>
            <option value="price-desc">Sort: Price (High to Low)</option>
            <option value="stock-asc">Sort: Stock (Low to High)</option>
            <option value="stock-desc">Sort: Stock (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="table-card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Selling Price</th>
                <th>Cost (Buy)</th>
                <th className="text-right">Stock</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No products matching your search or filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const cat = categories.find((c) => c.id === prod.category_id);
                  const catName = cat ? cat.name : prod.category || "—";
                  const isLow = prod.stock_quantity <= 10;
                  const isOut = prod.stock_quantity <= 0;

                  return (
                    <tr key={prod.id} className={!prod.is_active ? "row-inactive" : ""}>
                      <td>
                        <div className="font-semibold text-gray-900">{prod.name}</div>
                        {prod.sku && <div className="text-xs text-gray-500 font-mono">SKU: {prod.sku}</div>}
                      </td>
                      <td>
                        <span className="badge-category">{catName}</span>
                      </td>
                      <td className="text-xs text-gray-600">{prod.unit || "piece"}</td>
                      <td className="font-bold text-gray-900">{formatINR(prod.selling_price)}</td>
                      <td className="text-xs text-gray-500">
                        {prod.purchase_price ? formatINR(prod.purchase_price) : "—"}
                      </td>
                      <td className="text-right">
                        <span
                          className={`font-mono font-bold ${
                            isOut ? "text-red" : isLow ? "text-orange" : "text-green"
                          }`}
                        >
                          {prod.stock_quantity}
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge-status ${
                            prod.is_active ? "badge-active" : "badge-inactive"
                          }`}
                        >
                          {prod.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="table-actions-row">
                          <button
                            className="btn-action-icon"
                            title="Quick Stock Adjust"
                            onClick={() => handleOpenStockAdjust(prod)}
                          >
                            📦
                          </button>
                          <button
                            className="btn-action-icon"
                            title="Edit Product"
                            onClick={() => handleOpenEdit(prod)}
                          >
                            ✏️
                          </button>
                          <button
                            className={`btn-action-icon ${prod.is_active ? "text-red" : "text-green"}`}
                            title={prod.is_active ? "Deactivate" : "Reactivate"}
                            onClick={() => handleToggleActive(prod)}
                          >
                            {prod.is_active ? "🚫" : "🔄"}
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

      {/* MODAL: ADD / EDIT PRODUCT */}
      {(modalMode === "add" || modalMode === "edit") && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === "add" ? "Add New Product" : "Edit Product"}</h3>
              <button className="btn-icon" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="modal-form">
              {formError && <div className="alert-danger text-sm mb-3">⚠️ {formError}</div>}

              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Meetha Pan, Classic Milds, Thums Up"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id || c.slug} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit Type</label>
                  <select
                    className="form-select"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {unitsList.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 20"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Purchase / Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="form-input"
                    placeholder="Optional cost price"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Current Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="form-input"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SKU / Barcode (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. PAN-01"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>Active product (Available on billing screen)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : modalMode === "add" ? "Create Product" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK STOCK ADJUST */}
      {modalMode === "stock" && currentProduct && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Adjust Stock</h3>
              <button className="btn-icon" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="modal-form">
              {formError && <div className="alert-danger text-sm mb-3">⚠️ {formError}</div>}

              <div className="stock-info-box">
                <div className="font-semibold text-gray-900">{currentProduct.name}</div>
                <div className="text-xs text-gray-500">
                  Current Stock:{" "}
                  <strong className="text-blue-700">
                    {currentProduct.stock_quantity} {currentProduct.unit || "pcs"}
                  </strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Action</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`btn flex-1 ${stockAction === "ADD" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setStockAction("ADD")}
                  >
                    + Add Inward Stock
                  </button>
                  <button
                    type="button"
                    className={`btn flex-1 ${stockAction === "SUB" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setStockAction("SUB")}
                  >
                    − Reduce Stock
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity ({currentProduct.unit || "units"})</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input text-lg font-bold"
                  value={stockAdjustment}
                  onChange={(e) => setStockAdjustment(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Updating..." : "Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
