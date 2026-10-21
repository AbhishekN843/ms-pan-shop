import React, { useMemo } from "react";
import { formatINR, formatDateTime, getKolkataDateString } from "../lib/utils";

export default function Dashboard({
  sales = [],
  products = [],
  onSelectSale,
  onNavigateToBilling,
}) {
  const [todayString] = useState(() =>
    new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
  const [kolkataToday] = useState(() => getKolkataDateString());

  // Filter today's sales in Asia/Kolkata timezone
  const todaySales = useMemo(() => {
    return sales.filter((sale) => {
      const saleKolkataDate = getKolkataDateString(new Date(sale.created_at));
      return saleKolkataDate === kolkataToday && sale.status === "COMPLETED";
    });
  }, [sales, kolkataToday]);

  // Aggregate metrics
  const totalSalesRevenue = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  }, [todaySales]);

  const totalBillsCount = todaySales.length;

  const averageBillValue = useMemo(() => {
    if (totalBillsCount === 0) return 0;
    return totalSalesRevenue / totalBillsCount;
  }, [totalSalesRevenue, totalBillsCount]);

  // Breakdown by payment method
  const paymentBreakdown = useMemo(() => {
    const cash = todaySales
      .filter((s) => s.payment_method === "Cash")
      .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const upi = todaySales
      .filter((s) => s.payment_method === "UPI")
      .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const other = todaySales
      .filter((s) => s.payment_method === "Other")
      .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    return { cash, upi, other };
  }, [todaySales]);

  // Low stock products (< 10 items)
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => p.is_active && p.stock_quantity !== undefined && p.stock_quantity <= 10)
      .sort((a, b) => a.stock_quantity - b.stock_quantity);
  }, [products]);

  // Recent 5 sales
  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);
  }, [sales]);

  return (
    <div className="dashboard-container">
      {/* Welcome Banner */}
      <div className="dashboard-hero-banner">
        <div>
          <h2 className="dashboard-title">Shop Overview & Performance</h2>
          <p className="dashboard-subtitle">
            Daily reports and metrics for Asia/Kolkata timezone • {todayString}
          </p>
        </div>
        <button className="btn btn-primary btn-hero-cta" onClick={onNavigateToBilling}>
          + Create New Bill
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="stats-cards-grid">
        <div className="stat-card stat-card-green">
          <div className="stat-card-header">
            <span className="stat-card-label">TODAY'S SALES</span>
            <span className="stat-icon">💰</span>
          </div>
          <div className="stat-card-value">{formatINR(totalSalesRevenue)}</div>
          <div className="stat-card-sub">
            From {totalBillsCount} bill{totalBillsCount === 1 ? "" : "s"} generated today
          </div>
        </div>

        <div className="stat-card stat-card-blue">
          <div className="stat-card-header">
            <span className="stat-card-label">BILLS GENERATED</span>
            <span className="stat-icon">🧾</span>
          </div>
          <div className="stat-card-value">{totalBillsCount}</div>
          <div className="stat-card-sub">Completed customer transactions</div>
        </div>

        <div className="stat-card stat-card-purple">
          <div className="stat-card-header">
            <span className="stat-card-label">AVERAGE BILL VALUE</span>
            <span className="stat-icon">📈</span>
          </div>
          <div className="stat-card-value">{formatINR(averageBillValue)}</div>
          <div className="stat-card-sub">Average spend per customer</div>
        </div>

        <div className="stat-card stat-card-orange">
          <div className="stat-card-header">
            <span className="stat-card-label">LOW STOCK ITEMS</span>
            <span className="stat-icon">⚠️</span>
          </div>
          <div className="stat-card-value">{lowStockProducts.length}</div>
          <div className="stat-card-sub">Products with stock &le; 10 units</div>
        </div>
      </div>

      {/* Payment Modes Split */}
      <div className="payment-split-card">
        <h4 className="card-section-title">Today's Collections by Payment Method</h4>
        <div className="payment-split-grid">
          <div className="split-item">
            <div className="split-label">💵 Cash</div>
            <div className="split-value">{formatINR(paymentBreakdown.cash)}</div>
            <div className="split-pct">
              {totalSalesRevenue > 0
                ? `${Math.round((paymentBreakdown.cash / totalSalesRevenue) * 100)}% of total`
                : "0%"}
            </div>
          </div>
          <div className="split-item">
            <div className="split-label">📱 UPI</div>
            <div className="split-value">{formatINR(paymentBreakdown.upi)}</div>
            <div className="split-pct">
              {totalSalesRevenue > 0
                ? `${Math.round((paymentBreakdown.upi / totalSalesRevenue) * 100)}% of total`
                : "0%"}
            </div>
          </div>
          <div className="split-item">
            <div className="split-label">💳 Other</div>
            <div className="split-value">{formatINR(paymentBreakdown.other)}</div>
            <div className="split-pct">
              {totalSalesRevenue > 0
                ? `${Math.round((paymentBreakdown.other / totalSalesRevenue) * 100)}% of total`
                : "0%"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Recent Bills & Low Stock Alerts */}
      <div className="dashboard-double-grid">
        {/* Recent Transactions */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h4 className="card-section-title">Recent Bills</h4>
            <span className="text-xs text-gray-500">Last 6 sales</span>
          </div>

          {recentSales.length === 0 ? (
            <div className="empty-state-panel">
              <span className="text-3xl mb-1">🧾</span>
              <p className="font-semibold text-gray-700">No sales recorded yet</p>
              <p className="text-xs text-gray-500">
                Completed bills will automatically show up here.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill No</th>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Mode</th>
                    <th className="text-right">Total</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-mono font-bold text-blue-700">{sale.bill_number}</td>
                      <td className="text-xs text-gray-500">{formatDateTime(sale.created_at)}</td>
                      <td>{sale.customer_name || <span className="text-gray-400">—</span>}</td>
                      <td>
                        <span className={`badge-payment-sm badge-${(sale.payment_method || "cash").toLowerCase()}`}>
                          {sale.payment_method}
                        </span>
                      </td>
                      <td className="text-right font-bold">{formatINR(sale.total_amount)}</td>
                      <td className="text-center">
                        <button
                          className="btn-table-action"
                          onClick={() => onSelectSale(sale)}
                          title="View receipt"
                        >
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h4 className="card-section-title">Stock Alert (≤ 10 Units)</h4>
            <span className="badge-warning">{lowStockProducts.length} items</span>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="empty-state-panel">
              <span className="text-3xl mb-1">🎉</span>
              <p className="font-semibold text-gray-700">Stock is healthy!</p>
              <p className="text-xs text-gray-500">
                All active products have more than 10 units in stock.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Price</th>
                    <th className="text-right">Stock</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((prod) => (
                    <tr key={prod.id}>
                      <td className="font-medium">{prod.name}</td>
                      <td>{formatINR(prod.selling_price)}</td>
                      <td className="text-right font-bold">
                        {prod.stock_quantity} {prod.unit || "pcs"}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge-stock ${
                            prod.stock_quantity <= 0 ? "badge-danger" : "badge-warning"
                          }`}
                        >
                          {prod.stock_quantity <= 0 ? "Out of Stock" : "Low Stock"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
