import React, { useState } from "react";
import { formatINR, formatDateTime } from "../lib/utils";
import { downloadReceiptPdf, downloadA4InvoicePdf, shareReceipt } from "../lib/receiptPdf";

export default function ReceiptModal({ sale, shopSettings = {}, onClose, onNewBill }) {
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  if (!sale) return null;

  const items = sale.items || sale.sale_items || [];

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=480,height=700");
    if (!printWindow) {
      window.print();
      return;
    }

    const itemsHtml = items
      .map(
        (item, index) => `
        <tr>
          <td colspan="2" style="padding: 6px 0 2px 0;">
            <strong style="font-size: 13px; color: #111;">${index + 1}. ${item.product_name}</strong>
          </td>
        </tr>
        <tr style="border-bottom: 1px dashed #e2e8f0;">
          <td style="padding: 0 0 6px 14px; color: #64748b; font-size: 12px;">
            ${item.quantity} ${item.unit || "pack"} &times; ${formatINR(item.unit_price)}
          </td>
          <td style="text-align: right; padding: 0 0 6px 0; font-weight: bold; font-size: 13px; color: #0f172a;">
            ${formatINR(item.line_total)}
          </td>
        </tr>`
      )
      .join("");

    const discountHtml =
      Number(sale.discount_amount) > 0
        ? `<tr>
            <td style="padding: 4px 0; color: #dc2626;">Discount Applied:</td>
            <td style="text-align: right; padding: 4px 0; color: #dc2626; font-weight: bold;">-${formatINR(sale.discount_amount)}</td>
          </tr>`
        : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${sale.bill_number}</title>
        <style>
          @page { margin: 6mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            max-width: 360px;
            margin: 0 auto;
            padding: 12px;
            color: #0f172a;
            font-size: 13px;
          }
          .center { text-align: center; }
          h2 { margin: 2px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          .tagline { font-size: 11px; font-weight: 600; color: #475569; margin: 2px 0 6px; }
          .meta { font-size: 11px; color: #64748b; margin: 2px 0; }
          .divider { border-top: 1px solid #cbd5e1; margin: 8px 0; }
          .meta-grid { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { text-align: left; font-size: 11px; color: #64748b; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; }
          .total-box {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
            padding: 10px 12px;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .total-label { font-size: 13px; font-weight: 800; color: #0284c7; }
          .total-amount { font-size: 18px; font-weight: 900; color: #0f172a; }
          .footer { font-size: 11px; color: #64748b; font-style: italic; margin-top: 12px; text-align: center; }
          @media print {
            body { max-width: 100%; margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>${shopSettings.shop_name || "MS PAN SHOP"}</h2>
          <div class="tagline">${shopSettings.tagline || "Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups"}</div>
          ${shopSettings.address ? `<div class="meta">${shopSettings.address}</div>` : ""}
          ${shopSettings.phone ? `<div class="meta">Phone / WhatsApp: ${shopSettings.phone}</div>` : ""}
        </div>
        <div class="divider"></div>
        <div class="meta-grid">
          <span><strong>Bill No:</strong> ${sale.bill_number}</span>
          <span><strong>Date:</strong> ${formatDateTime(sale.created_at)}</span>
        </div>
        ${
          sale.customer_name || sale.customer_phone
            ? `<div class="meta"><strong>Customer:</strong> ${[sale.customer_name, sale.customer_phone].filter(Boolean).join("  •  ")}</div>`
            : ""
        }
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>#   ITEM DESCRIPTION</th>
              <th style="text-align: right;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr>
            <td style="padding: 3px 0; color: #64748b;">Subtotal:</td>
            <td style="text-align: right; padding: 3px 0; font-weight: 600;">${formatINR(sale.subtotal || sale.total_amount)}</td>
          </tr>
          ${discountHtml}
        </table>
        <div class="total-box">
          <span class="total-label">TOTAL AMOUNT:</span>
          <span class="total-amount">${formatINR(sale.total_amount)}</span>
        </div>
        <div class="meta"><strong>Payment Mode:</strong> ${sale.payment_method || "Cash"}</div>
        <div class="divider" style="border-top: 1px dashed #cbd5e1;"></div>
        <div class="footer">${shopSettings.footer_message || "Thank you for your business! Visit again for wholesale rates."}</div>
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
            <span className="font-mono text-xs text-gray-500 font-bold">{sale.bill_number}</span>
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
              <p className="receipt-tagline">{shopSettings.tagline || "Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups"}</p>
              {shopSettings.address && <p className="receipt-sub">{shopSettings.address}</p>}
              {shopSettings.phone && <p className="receipt-sub">Ph: {shopSettings.phone}</p>}
            </div>

            <div className="receipt-dashed-line" />

            <div className="receipt-meta-grid">
              <div>
                <span className="meta-label">Bill No:</span>
                <span className="meta-val font-mono">{sale.bill_number}</span>
              </div>
              <div className="text-right">
                <span className="meta-val">{formatDateTime(sale.created_at)}</span>
              </div>
              {sale.customer_name && (
                <div>
                  <span className="meta-label">Customer:</span>
                  <span className="meta-val">{sale.customer_name}</span>
                </div>
              )}
              {sale.customer_phone && (
                <div className="text-right">
                  <span className="meta-label">Phone:</span>
                  <span className="meta-val">{sale.customer_phone}</span>
                </div>
              )}
            </div>

            <div className="receipt-dashed-line" />

            {/* Line Items (Indented Two-Row Layout) */}
            <div className="receipt-items-table">
              <div className="receipt-table-header">
                <span>#  ITEM DESCRIPTION</span>
                <span className="text-right">AMOUNT</span>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="receipt-item-block">
                  <div className="receipt-item-title-row">
                    <span className="item-number">{idx + 1}.</span>
                    <span className="item-name">{item.product_name}</span>
                  </div>
                  <div className="receipt-item-calc-row">
                    <span className="item-calc">
                      Qty: {item.quantity} {item.unit || "pack"} × {formatINR(item.unit_price)}
                    </span>
                    <span className="item-total">{formatINR(item.line_total)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="receipt-dashed-line" />

            {/* Summary Totals */}
            <div className="receipt-summary">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>{formatINR(sale.subtotal || sale.total_amount)}</span>
              </div>
              {Number(sale.discount_amount) > 0 && (
                <div className="summary-row text-red">
                  <span>Discount:</span>
                  <span>- {formatINR(sale.discount_amount)}</span>
                </div>
              )}
              <div className="summary-row total-highlight">
                <span>TOTAL AMOUNT:</span>
                <span className="text-lg font-bold">{formatINR(sale.total_amount)}</span>
              </div>
              <div className="summary-row payment-mode">
                <span>Payment Mode:</span>
                <span className="badge-payment">{sale.payment_method || "Cash"}</span>
              </div>
            </div>

            <div className="receipt-dashed-line" />

            <div className="receipt-footer">
              <p>{shopSettings.footer_message || "Thank you for your business! Visit again for wholesale rates."}</p>
            </div>
          </div>
        </div>

        {shareStatus && (
          <div className="alert-info text-center py-2 px-3 text-xs my-1">
            {shareStatus}
          </div>
        )}

        {/* Modal Actions */}
        <div className="receipt-modal-actions-grid">
          <button className="btn btn-secondary flex-1" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button
            className="btn btn-secondary flex-1"
            onClick={() => downloadReceiptPdf(sale, shopSettings)}
            title="Download Compact Receipt PDF"
          >
            📥 Slip (PDF)
          </button>
          <button
            className="btn btn-secondary flex-1"
            onClick={() => downloadA4InvoicePdf(sale, shopSettings)}
            title="Download Full A4 Wholesale Invoice PDF"
          >
            📄 A4 Invoice
          </button>
          <button
            className="btn btn-secondary flex-1"
            onClick={handleShare}
            disabled={sharing}
          >
            {sharing ? "..." : "📲 WhatsApp"}
          </button>
          {onNewBill && (
            <button className="btn btn-primary w-full mt-1" onClick={onNewBill}>
              + Create Next Bill
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
