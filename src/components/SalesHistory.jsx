import React, { useState, useMemo } from "react";
import { formatINR, formatDateTime, getKolkataDateString } from "../lib/utils";
import { downloadReceiptPdf } from "../lib/receiptPdf";

export default function SalesHistory({
  sales = [],
  shopSettings = {},
  onSelectSale,
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all"); // 'today', 'yesterday', 'week', 'month', 'all'
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  const [referenceTime] = useState(() => Date.now());
  const [kolkataToday] = useState(() => getKolkataDateString());

  // Filtered sales
  const filteredSales = useMemo(() => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterdayDate = new Date(referenceTime - oneDayMs);
    const yesterdayKolkata = getKolkataDateString(yesterdayDate);
    const sevenDaysAgoDate = new Date(referenceTime - 7 * oneDayMs);
    const thirtyDaysAgoDate = new Date(referenceTime - 30 * oneDayMs);

    return sales.filter((sale) => {
      // Payment method filter
      if (paymentFilter !== "ALL" && sale.payment_method !== paymentFilter) {
        return false;
      }

      // Date range filter
      if (dateRange !== "all") {
        const saleDate = new Date(sale.created_at);
        const saleKolkata = getKolkataDateString(saleDate);

        if (dateRange === "today") {
          if (saleKolkata !== kolkataToday) return false;
        } else if (dateRange === "yesterday") {
          if (saleKolkata !== yesterdayKolkata) return false;
        } else if (dateRange === "week") {
          if (saleDate < sevenDaysAgoDate) return false;
        } else if (dateRange === "month") {
          if (saleDate < thirtyDaysAgoDate) return false;
        }
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchBill = (sale.bill_number || "").toLowerCase().includes(q);
        const matchCust = (sale.customer_name || "").toLowerCase().includes(q);
        const matchPhone = (sale.customer_phone || "").toLowerCase().includes(q);
        return matchBill || matchCust || matchPhone;
      }

      return true;
    });
  }, [sales, paymentFilter, dateRange, search, kolkataToday, referenceTime]);

  // Aggregate stats for current filtered selection
  const filteredTotal = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  }, [filteredSales]);

  return (
    <div className="management-container">
      <div className="management-header">
        <div>
          <h2 className="section-title">Sales & Billing History</h2>
          <p className="section-subtitle">
            View, search, reprint, and download PDF receipts for past transactions.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onRefresh} title="Refresh sales list">
          🔄 Refresh
        </button>
      </div>

      {/* Filter and stats banner */}
      <div className="filter-controls-card">
        <div className="filter-grid">
          {/* Search */}
          <div className="search-box">
            <input
              type="text"
              className="form-input"
              placeholder="Search bill number or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Date range filter */}
          <select
            className="form-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="today">Today's Bills</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>

          {/* Payment filter */}
          <select
            className="form-select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="ALL">All Payment Modes</option>
            <option value="Cash">Cash Only</option>
            <option value="UPI">UPI Only</option>
            <option value="Other">Other Only</option>
          </select>
        </div>

        {/* Aggregate summary chips */}
        <div className="history-summary-strip">
          <div className="history-metric">
            <span className="metric-label">Filtered Bills:</span>
            <span className="metric-val">{filteredSales.length}</span>
          </div>
          <div className="history-metric">
            <span className="metric-label">Total Revenue:</span>
            <span className="metric-val text-green">{formatINR(filteredTotal)}</span>
          </div>
        </div>
      </div>

      {/* Sales table */}
      <div className="table-card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill Number</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Items Count</th>
                <th>Mode</th>
                <th className="text-right">Subtotal</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Total Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-500">
                    No bills found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <button
                        className="btn-link font-mono font-bold"
                        onClick={() => onSelectSale(sale)}
                      >
                        {sale.bill_number}
                      </button>
                    </td>
                    <td className="text-xs text-gray-500">{formatDateTime(sale.created_at)}</td>
                    <td>
                      {sale.customer_name || sale.customer_phone ? (
                        <div>
                          <div className="font-medium text-gray-900">{sale.customer_name || "—"}</div>
                          {sale.customer_phone && (
                            <div className="text-xs text-gray-500">{sale.customer_phone}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-600">
                      {(sale.items || sale.sale_items || []).length} items
                    </td>
                    <td>
                      <span
                        className={`badge-payment-sm badge-${(sale.payment_method || "cash").toLowerCase()}`}
                      >
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="text-right text-gray-600">
                      {formatINR(sale.subtotal || sale.total_amount)}
                    </td>
                    <td className="text-right text-xs">
                      {Number(sale.discount_amount) > 0 ? (
                        <span className="text-red">- {formatINR(sale.discount_amount)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right font-bold text-gray-900">
                      {formatINR(sale.total_amount)}
                    </td>
                    <td className="text-right">
                      <div className="table-actions-row">
                        <button
                          className="btn-action-icon"
                          title="View Receipt"
                          onClick={() => onSelectSale(sale)}
                        >
                          👁️
                        </button>
                        <button
                          className="btn-action-icon"
                          title="Download PDF"
                          onClick={() => downloadReceiptPdf(sale, shopSettings)}
                        >
                          📥
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
