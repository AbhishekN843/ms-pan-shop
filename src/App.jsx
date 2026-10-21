import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import AuthGate from "./components/AuthGate";
import Header from "./components/Header";
import NewBill from "./components/NewBill";
import Dashboard from "./components/Dashboard";
import Products from "./components/Products";
import Categories from "./components/Categories";
import SalesHistory from "./components/SalesHistory";
import Settings from "./components/Settings";
import ReceiptModal from "./components/ReceiptModal";
import "./App.css";

export default function App() {
  return (
    <AuthGate>
      {({ session, user }) => <ShopAppContent user={user} session={session} />}
    </AuthGate>
  );
}

function ShopAppContent({ user }) {
  const [activeTab, setActiveTab] = useState("new-bill");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sales, setSales] = useState([]);
  const [shopSettings, setShopSettings] = useState({
    shop_name: "MS PAN SHOP",
    tagline: "Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups",
    phone: "",
    address: "",
    footer_message: "Thank you for your business! Visit again for wholesale rates.",
  });

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [dbError, setDbError] = useState("");
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Fetch shop settings
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        // Table might not exist yet if migrations haven't run
        console.warn("Could not load shop_settings:", error.message);
        return;
      }
      if (data) {
        setShopSettings(data);
      }
    } catch (err) {
      console.warn("Settings fetch failed:", err);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Categories fetch failed:", err);
      setDbError((prev) => prev || `Categories table error: ${err.message}`);
    }
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error("Products fetch failed:", err);
      setDbError((prev) => prev || `Products table error: ${err.message}`);
    }
  }, []);

  // Fetch sales history with items
  const fetchSales = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          bill_number,
          customer_name,
          customer_phone,
          subtotal,
          discount_amount,
          total_amount,
          payment_method,
          status,
          created_at,
          sale_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total
          )
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const normalizedSales = (data || []).map((sale) => ({
        ...sale,
        items: (sale.sale_items || []).map((item) => ({
          ...item,
          unit_price: Number(item.unit_price),
          line_total: Number(item.line_total),
        })),
      }));

      setSales(normalizedSales);
    } catch (err) {
      console.error("Sales fetch failed:", err);
      setDbError((prev) => prev || `Sales table error: ${err.message}`);
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    let active = true;

    async function loadAll() {
      setLoadingInitial(true);
      setDbError("");

      await Promise.allSettled([
        fetchSettings(),
        fetchCategories(),
        fetchProducts(),
        fetchSales(),
      ]);

      if (active) {
        setLoadingInitial(false);
      }
    }

    loadAll();

    return () => {
      active = false;
    };
  }, [fetchSettings, fetchCategories, fetchProducts, fetchSales]);

  // Handle logout
  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out of MS PAN SHOP?")) {
      await supabase.auth.signOut();
    }
  };

  // Callback when a sale is successfully generated
  const handleSaleCompleted = (saleData) => {
    // Normalise sale items
    const normalized = {
      ...saleData,
      created_at: saleData.created_at || new Date().toISOString(),
    };
    setActiveReceipt(normalized);
    // Refresh sales list and product stock
    fetchSales();
    fetchProducts();
  };

  return (
    <div className="app-shell">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        shopSettings={shopSettings}
        onLogout={handleLogout}
      />

      {/* Database Setup Notice if tables not found */}
      {dbError && (
        <div className="db-migration-warning-banner">
          <div className="warning-content">
            <strong>⚠️ Database Tables Not Found in Supabase MS-PAN</strong>
            <p className="text-xs mt-1">
              {dbError}. Please run the complete database migration script (
              <code>supabase/setup_complete.sql</code>) in your Supabase SQL Editor.
            </p>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              setDbError("");
              fetchCategories();
              fetchProducts();
              fetchSales();
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        {loadingInitial ? (
          <div className="loading-state-container">
            <div className="spinner-lg" />
            <p className="mt-3 text-sm font-semibold text-gray-700">
              Loading MS PAN SHOP Inventory & Sales...
            </p>
          </div>
        ) : (
          <>
            {activeTab === "new-bill" && (
              <NewBill
                products={products.filter((p) => p.is_active)}
                categories={categories.filter((c) => c.is_active)}
                shopSettings={shopSettings}
                onSaleCompleted={handleSaleCompleted}
                onRefreshProducts={fetchProducts}
              />
            )}

            {activeTab === "dashboard" && (
              <Dashboard
                sales={sales}
                products={products}
                onSelectSale={(s) => setActiveReceipt(s)}
                onNavigateToBilling={() => setActiveTab("new-bill")}
              />
            )}

            {activeTab === "products" && (
              <Products
                products={products}
                categories={categories}
                onRefresh={fetchProducts}
              />
            )}

            {activeTab === "categories" && (
              <Categories
                categories={categories}
                products={products}
                onRefresh={fetchCategories}
              />
            )}

            {activeTab === "sales" && (
              <SalesHistory
                sales={sales}
                shopSettings={shopSettings}
                onSelectSale={(s) => setActiveReceipt(s)}
                onRefresh={fetchSales}
              />
            )}

            {activeTab === "settings" && (
              <Settings
                key={shopSettings.updated_at || "settings"}
                shopSettings={shopSettings}
                user={user}
                onSaveSettings={(updated) => setShopSettings(updated)}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* RECEIPT MODAL */}
      {activeReceipt && (
        <ReceiptModal
          sale={activeReceipt}
          shopSettings={shopSettings}
          onClose={() => setActiveReceipt(null)}
          onNewBill={() => {
            setActiveReceipt(null);
            setActiveTab("new-bill");
          }}
        />
      )}
    </div>
  );
}
