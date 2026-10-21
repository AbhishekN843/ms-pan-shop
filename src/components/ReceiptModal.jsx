import React, { useState } from "react";
import { formatINR, formatDateTime } from "../lib/utils";
import { downloadReceiptPdf, shareReceipt } from "../lib/receiptPdf";

export default function ReceiptModal({ sale, shopSettings = {}, onClose, onNewBill }) {
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  if (!sale) return null;

  const handlePrint = () => {
    // Open dedicated print preview or standard print
    const printWindow = window.open("", "_blank", "width=420,height=650");
    if (!printWindow) {
      window.print();
      return;
    }

    const itemsHtml = (sale.items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding:4px 0; border-bottom:1px dashed #eee;">
            <strong>${item.product_name}</strong><br/>
            <small style="color:#666;">${item.quantity} × ${formatINR(item.unit_price)}</small>
          </td>
          <td style="text-align:right; padding:4px 0; border-bottom:1px dashed #eee; vertical-align:top;">
            ${formatINR(item.line_total)}
          </td>
        </tr>`
      )
      .join("");

    const discountHtml =
      Number(sale.discount_amount) > 0
        ? `<tr>
            <td style="padding:4px 0; color:#d9381e;">Discount</td>
            <td style="text-align:right; padding:4px 0; color:#d9381e;">-${formatINR(sale.discount_amount)}</td>
          </tr>`
        : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${sale.bill_number}</title>
        <style>
          @page { margin: 5mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            max-width: 320px;
            margin: 0 auto;
            padding: 10px;
            color: #111;
            font-size: 13px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          h2 { margin: 4px 0 2px; font-size: 18px; text-transform: uppercase; }
          .tagline { font-size: 11px; color: #555; margin: 0 0 6px; }
          .meta { font-size: 11px; color: #444; margin: 3px 0; }
          .divider { border-top: 1px dashed #888; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .total-box {
            background: #f4f7fa;
            border-radius: 4px;
            padding: 8px;
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            font-weight: bold;
          }
          .footer { font-size: 11px; color: #666; font-style: italic; margin-top: 10px; text-align: center; }
          @media print {
            body { max-width: 100%; margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>${shopSettings.shop_name || "MS PAN SHOP"}</h2>
          <div class="tagline">${shopSettings.tagline || "Pan, Cigarette, Confectionery & Drinks"}</div>
          ${shopSettings.address ? `<div class="meta">${shopSettings.address}</div>` : ""}
          ${shopSettings.phone ? `<div class="meta">Phone: ${shopSettings.phone}</div>` : ""}
        </div>
        <div class="divider"></div>
        <div class="meta"><strong>Bill No:</strong> ${sale.bill_number}</div>
        <div class="meta"><strong>Date:</strong> ${formatDateTime(sale.created_at)}</div>
        ${sale.customer_name ? `<div class="meta"><strong>Customer:</strong> ${sale.customer_name}</div>` : ""}
        ${sale.customer_phone ? `<div class="meta"><strong>Phone:</strong> ${sale.customer_phone}</div>` : ""}
        <div class="divider"></div>
        <table>
          <thead>
            <tr style="border-bottom:1px solid #ccc; font-size:11px;">
              <th style="text-align:left; padding-bottom:4px;">ITEM</th>
              <th style="text-align:right; padding-bottom:4px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr>
            <td style="padding:3px 0;">Subtotal</td>
            <td style="text-align:right; padding:3px 0;">${formatINR(sale.subtotal || sale.total_amount)}</td>
          </tr>
          ${discountHtml}
        </table>
        <div class="total-box">
          <span>NET PAYABLE:</span>
          <span>${formatINR(sale.total_amount)}</span>
        </div>
        <div class="meta"><strong>Payment Mode:</strong> ${sale.payment_method || "Cash"}</div>
        <div class="divider"></div>
        <div class="footer">${shopSettings.footer_message || "Thank you! Visit again."}</div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShare = async () => {
    setSharing(true);
    setShareStatus("");
    try {
      const res = await shareReceipt(sale, shopSettings);
      if (res.method === "web-share") {
        setShareStatus("Receipt shared successfully!");
      } else if (res.method === "whatsapp") {
        setShareStatus("PDF downloaded & opened in WhatsApp.");
      } else if (res.downloaded) {
        setShareStatus("PDF downloaded to your device.");
      }
    } catch (err) {
      console.error("Share failed:", err);
      setShareStatus("Sharing failed. Please use Download PDF.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card receipt-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <span className="badge-success">✓ Sale Completed</span>
            <span className="font-mono text-sm text-gray-500">{sale.bill_number}</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Paper Receipt Preview */}
        <div className="paper-receipt-container">
          <div className="paper-receipt" id="printable-receipt">
            <div className="receipt-brand">
              <div className="receipt-logo-pill">MS</div>
              <h3>{shopSettings.shop_name || "MS PAN SHOP"}</h3>
              <p className="receipt-tagline">{shopSettings.tagline || "Pan, Cigarette, Confectionery & Drinks"}</p>
              {shopSettings.address && <p className="receipt-sub">{shopSettings.address}</p>}
              {shopSettings.phone && <p className="receipt-sub">Ph: {shopSettings.phone}</p>}
            </div>

            <div className="receipt-dashed-line" />

            <div className="receipt-meta-grid">
              <div>
                <span className="meta-label">Bill Number:</span>
                <span className="meta-val font-mono">{sale.bill_number}</span>
              </div>
              <div>
                <span className="meta-label">Date:</span>
                <span className="meta-val">{formatDateTime(sale.created_at)}</span>
              </div>
              {sale.customer_name && (
                <div>
                  <span className="meta-label">Customer:</span>
                  <span className="meta-val">{sale.customer_name}</span>
                </div>
              )}
              {sale.customer_phone && (
                <div>
                  <span className="meta-label">Phone:</span>
                  <span className="meta-val">{sale.customer_phone}</span>
                </div>
              )}
            </div>

            <div className="receipt-dashed-line" />

            {/* Line Items */}
            <div className="receipt-items-table">
              <div className="receipt-table-header">
                <span>ITEM</span>
                <span className="text-right">AMOUNT</span>
              </div>
              {(sale.items || []).map((item, idx) => (
                <div key={idx} className="receipt-item-row">
                  <div className="item-details">
                    <span className="item-name">{item.product_name}</span>
                    <span className="item-calc">
                      {item.quantity} × {formatINR(item.unit_price)}
                    </span>
                  </div>
                  <div className="item-total">{formatINR(item.line_total)}</div>
                </div>
              ))}
            </div>

            <div className="receipt-dashed-line" />

            {/* Summary Totals */}
            <div className="receipt-summary">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatINR(sale.subtotal || sale.total_amount)}</span>
              </div>
              {Number(sale.discount_amount) > 0 && (
                <div className="summary-row text-red">
                  <span>Discount</span>
                  <span>- {formatINR(sale.discount_amount)}</span>
                </div>
              )}
              <div className="summary-row total-highlight">
                <span>NET TOTAL</span>
                <span>{formatINR(sale.total_amount)}</span>
              </div>
              <div className="summary-row payment-mode">
                <span>Paid via:</span>
                <span className="badge-payment">{sale.payment_method || "Cash"}</span>
              </div>
            </div>

            <div className="receipt-dashed-line" />

            <div className="receipt-footer">
              <p>{shopSettings.footer_message || "Thank you! Visit again."}</p>
            </div>
          </div>
        </div>

        {shareStatus && (
          <div className="alert-info text-center py-2 px-3 text-sm my-2">
            {shareStatus}
          </div>
        )}

        {/* Modal Actions */}
        <div className="receipt-modal-actions">
          <button className="btn btn-secondary flex-1" onClick={handlePrint}>
            🖨️ Print Bill
          </button>
          <button
            className="btn btn-secondary flex-1"
            onClick={() => downloadReceiptPdf(sale, shopSettings)}
          >
            📥 PDF
          </button>
          <button
            className="btn btn-secondary flex-1"
            onClick={handleShare}
            disabled={sharing}
          >
            {sharing ? "..." : "📲 Share"}
          </button>
          {onNewBill && (
            <button className="btn btn-primary flex-1" onClick={onNewBill}>
              + New Bill
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
