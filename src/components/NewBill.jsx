import React, { useState, useMemo } from "react";
import { formatINR } from "../lib/utils";
import { supabase } from "../lib/supabase";

export default function NewBill({
  products = [],
  categories = [],
  _shopSettings = {},
  onSaleCompleted,
  onRefreshProducts,
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Mobile sub-tab: 'catalog' or 'cart'
  const [mobileTab, setMobileTab] = useState("catalog");

  // Filter products by category & search
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category filter
      if (selectedCategory !== "ALL") {
        if (product.category_id !== selectedCategory && product.category !== selectedCategory) {
          return false;
        }
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = (product.name || "").toLowerCase().includes(query);
        const matchesSku = (product.sku || "").toLowerCase().includes(query);
        return matchesName || matchesSku;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product_id === product.id);
      if (existingIndex > -1) {
        const existingItem = prevCart[existingIndex];
        if (product.stock_quantity !== undefined && existingItem.quantity >= product.stock_quantity) {
          alert(`Cannot add more. Only ${product.stock_quantity} available in stock.`);
          return prevCart;
        }
        const updated = [...prevCart];
        const newQty = existingItem.quantity + 1;
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          line_total: Number((newQty * existingItem.unit_price).toFixed(2)),
        };
        return updated;
      } else {
        if (product.stock_quantity !== undefined && product.stock_quantity < 1) {
          alert("This product is currently out of stock.");
          return prevCart;
        }
        return [
          ...prevCart,
          {
            product_id: product.id,
            product_name: product.name,
            unit_price: Number(product.selling_price) || 0,
            quantity: 1,
            unit: product.unit || "piece",
            stock_quantity: product.stock_quantity,
            line_total: Number(product.selling_price) || 0,
          },
        ];
      }
    });
    setErrorMessage("");
  };

  const updateQuantity = (productId, delta) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (item.stock_quantity !== undefined && newQty > item.stock_quantity) {
              alert(`Cannot exceed available stock of ${item.stock_quantity}.`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              line_total: Number((newQty * item.unit_price).toFixed(2)),
            };
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const setDirectQuantity = (productId, qtyValue) => {
    const qty = parseInt(qtyValue, 10);
    if (isNaN(qty) || qty <= 0) return;
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.product_id === productId) {
          if (item.stock_quantity !== undefined && qty > item.stock_quantity) {
            alert(`Only ${item.stock_quantity} items available in stock.`);
            return item;
          }
          return {
            ...item,
            quantity: qty,
            line_total: Number((qty * item.unit_price).toFixed(2)),
          };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("Clear all items from current bill?")) {
      setCart([]);
      setDiscount("");
      setCustomerName("");
      setCustomerPhone("");
      setErrorMessage("");
      setMobileTab("catalog");
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return Number(cart.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
  }, [cart]);

  const discountAmount = useMemo(() => {
    const d = parseFloat(discount) || 0;
    if (d < 0) return 0;
    return Number(Math.min(d, subtotal).toFixed(2));
  }, [discount, subtotal]);

  const finalTotal = useMemo(() => {
    return Number(Math.max(0, subtotal - discountAmount).toFixed(2));
  }, [subtotal, discountAmount]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Complete sale handler
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setErrorMessage("Please add at least one product to the bill.");
      return;
    }

    if (discountAmount > subtotal) {
      setErrorMessage("Discount cannot exceed subtotal amount.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const salePayload = {
        p_items: cart.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        p_customer_name: customerName.trim() || null,
        p_customer_phone: customerPhone.trim() || null,
        p_discount: discountAmount,
        p_payment_method: paymentMethod,
      };

      const { data, error } = await supabase.rpc("create_sale_atomic", salePayload);

      if (error) {
        throw error;
      }

      if (!data || !data.bill_number) {
        throw new Error("Sale created but response was invalid. Please check Sales History.");
      }

      // Success: clear cart and inform parent
      setCart([]);
      setDiscount("");
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod("Cash");
      setErrorMessage("");
      setMobileTab("catalog");

      if (onRefreshProducts) onRefreshProducts();

      if (onSaleCompleted) {
        onSaleCompleted(data);
      }
    } catch (err) {
      console.error("Sale completion failed:", err);
      setErrorMessage(err.message || "Failed to save sale. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="new-bill-layout">
      {/* MOBILE TOP SEGMENT CONTROL (< 960px) */}
      <div className="mobile-view-toggle-bar">
        <button
          className={`mobile-toggle-btn ${mobileTab === "catalog" ? "active" : ""}`}
          onClick={() => setMobileTab("catalog")}
        >
          🛍️ Add Products
        </button>
        <button
          className={`mobile-toggle-btn ${mobileTab === "cart" ? "active" : ""}`}
          onClick={() => setMobileTab("cart")}
        >
          🛒 Current Bill
          {totalItemsCount > 0 && (
            <span className="mobile-tab-badge">{totalItemsCount}</span>
          )}
          {totalItemsCount > 0 && (
            <span className="mobile-tab-amount">• {formatINR(finalTotal)}</span>
          )}
        </button>
      </div>

      {/* LEFT COLUMN: Product Catalog */}
      <div className={`catalog-section ${mobileTab === "cart" ? "hide-on-mobile" : ""}`}>
        {/* Search bar & Category Pills */}
        <div className="catalog-header-card">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search items by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="category-pills-bar">
            <button
              className={`cat-pill ${selectedCategory === "ALL" ? "active" : ""}`}
              onClick={() => setSelectedCategory("ALL")}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id || cat.slug}
                className={`cat-pill ${selectedCategory === cat.id ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="products-grid-scroll">
          {filteredProducts.length === 0 ? (
            <div className="empty-catalog-state">
              <span className="text-4xl mb-2">📦</span>
              <p className="font-semibold text-gray-700">No products found</p>
              <p className="text-xs text-gray-500">
                {searchQuery
                  ? `No matches for "${searchQuery}"`
                  : "No active products in this category"}
              </p>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.product_id === product.id);
                const isOutOfStock = product.stock_quantity !== undefined && product.stock_quantity <= 0;

                return (
                  <button
                    key={product.id}
                    className={`product-card ${inCart ? "is-in-cart" : ""} ${
                      isOutOfStock ? "out-of-stock" : ""
                    }`}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    disabled={isOutOfStock}
                  >
                    {inCart && <div className="card-cart-qty">{inCart.quantity}</div>}
                    <div className="product-card-top">
                      <span className="product-title">{product.name}</span>
                    </div>

                    <div className="product-card-bottom">
                      <span className="product-price">{formatINR(product.selling_price)}</span>
                      <span
                        className={`stock-indicator ${
                          isOutOfStock
                            ? "stock-empty"
                            : product.stock_quantity < 10
                            ? "stock-low"
                            : ""
                        }`}
                      >
                        {isOutOfStock ? "Out of Stock" : `${product.stock_quantity} left`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Bill / Cart Panel */}
      <div className={`cart-panel-section ${mobileTab === "catalog" ? "hide-on-mobile" : ""}`}>
        <div className="cart-panel-card">
          {/* Cart Header */}
          <div className="cart-header">
            <div className="cart-header-title">
              <h3>Current Bill</h3>
              <span className="cart-badge-count">{totalItemsCount} items</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-sm btn-secondary mobile-only-inline"
                onClick={() => setMobileTab("catalog")}
              >
                + Add Items
              </button>
              {cart.length > 0 && (
                <button className="btn-text-danger" onClick={clearCart}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="cart-items-scroll">
            {cart.length === 0 ? (
              <div className="empty-cart-state">
                <div className="empty-cart-icon">🛒</div>
                <p className="empty-cart-title">Cart is empty</p>
                <p className="empty-cart-sub">Tap any product to add it to the bill</p>
                <button
                  className="btn btn-primary btn-sm mt-3 mobile-only-inline"
                  onClick={() => setMobileTab("catalog")}
                >
                  ← Go to Products
                </button>
              </div>
            ) : (
              <div className="cart-items-list">
                {cart.map((item) => (
                  <div key={item.product_id} className="cart-item-card">
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.product_name}</div>
                      <div className="cart-item-unit-rate">
                        {formatINR(item.unit_price)} / {item.unit}
                      </div>
                    </div>

                    <div className="cart-item-controls">
                      <div className="qty-stepper">
                        <button
                          className="stepper-btn"
                          onClick={() => updateQuantity(item.product_id, -1)}
                          title="Decrease"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className="stepper-input"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setDirectQuantity(item.product_id, e.target.value)}
                        />
                        <button
                          className="stepper-btn"
                          onClick={() => updateQuantity(item.product_id, 1)}
                          title="Increase"
                        >
                          +
                        </button>
                      </div>

                      <div className="cart-item-line-total">
                        {formatINR(item.line_total)}
                      </div>

                      <button
                        className="cart-remove-btn"
                        onClick={() => removeFromCart(item.product_id)}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Customer Details */}
          <div className="cart-customer-section">
            <div className="input-grid-2">
              <input
                type="text"
                className="form-input text-xs"
                placeholder="Customer Name (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                type="tel"
                className="form-input text-xs"
                placeholder="Phone (WhatsApp Receipt)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Cart Pricing & Summary */}
          <div className="cart-pricing-summary">
            <div className="pricing-row">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">{formatINR(subtotal)}</span>
            </div>

            <div className="pricing-row items-center">
              <span className="text-gray-600">Discount (₹):</span>
              <input
                type="number"
                min="0"
                max={subtotal}
                step="1"
                placeholder="0"
                className="discount-input"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            {discountAmount > 0 && (
              <div className="pricing-row text-red">
                <span>Discount Applied:</span>
                <span>- {formatINR(discountAmount)}</span>
              </div>
            )}

            {/* Total Payable Box */}
            <div className="total-payable-card">
              <div>
                <div className="total-payable-label">TOTAL PAYABLE</div>
                <div className="total-payable-sub">Incl. all taxes</div>
              </div>
              <div className="total-payable-amount">{formatINR(finalTotal)}</div>
            </div>

            {/* Payment Method Selector */}
            <div className="payment-method-selector">
              <span className="text-xs font-semibold text-gray-500 uppercase">Payment Mode:</span>
              <div className="payment-options-grid">
                {["Cash", "UPI", "Other"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`pay-mode-btn ${paymentMethod === method ? "selected" : ""}`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    {method === "Cash" ? "💵 Cash" : method === "UPI" ? "📱 UPI" : "💳 Other"}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div className="alert-danger text-xs p-2 mt-2 rounded">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              className="btn btn-primary btn-large btn-complete-sale"
              onClick={handleCompleteSale}
              disabled={isSubmitting || cart.length === 0}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner" /> Saving Sale...
                </span>
              ) : (
                `COMPLETE SALE • ${formatINR(finalTotal)}`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING MOBILE CHECKOUT PILL (visible on mobile in catalog view when cart has items) */}
      {mobileTab === "catalog" && totalItemsCount > 0 && (
        <div className="mobile-floating-checkout-bar" onClick={() => setMobileTab("cart")}>
          <div className="floating-cart-info">
            <span className="floating-cart-badge">{totalItemsCount}</span>
            <span className="floating-cart-total">{formatINR(finalTotal)}</span>
          </div>
          <button className="floating-checkout-btn">
            View Bill & Pay →
          </button>
        </div>
      )}
    </div>
  );
}
