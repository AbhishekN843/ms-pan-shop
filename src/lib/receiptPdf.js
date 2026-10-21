import { jsPDF } from "jspdf";
import { formatINR, formatDateTime } from "./utils.js";

/**
 * Generates and returns a jsPDF document for a receipt.
 * @param {Object} sale - Complete sale record with items.
 * @param {Object} shopSettings - Shop metadata (name, phone, address, etc.)
 * @returns {jsPDF}
 */
export function generateReceiptPdf(sale, shopSettings = {}) {
  const shopName = shopSettings.shop_name || "MS PAN SHOP";
  const tagline = shopSettings.tagline || "Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups";
  const phone = shopSettings.phone || "";
  const address = shopSettings.address || "";
  const footerMessage = shopSettings.footer_message || "Thank you for your business! Visit again for wholesale rates.";

  // Thermal 80mm width (approx 80mm = 226pt)
  // Auto height based on items
  const itemsCount = (sale.items || []).length;
  const calculatedHeight = Math.max(160, 110 + itemsCount * 8 + 60);

  const doc = new jsPDF({
    unit: "mm",
    format: [80, calculatedHeight],
    orientation: "portrait",
  });

  const pageWidth = 80;
  let y = 10;

  // Header - Shop Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(shopName, pageWidth / 2, y, { align: "center" });

  y += 5;
  if (tagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(tagline, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  if (address) {
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(address, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  if (phone) {
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`Phone: ${phone}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  // Divider line
  y += 1;
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  doc.setLineDashPattern([], 0); // reset
  y += 5;

  // Bill metadata
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text(`Bill No: ${sale.bill_number || "N/A"}`, 5, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Date: ${formatDateTime(sale.created_at || new Date())}`, 5, y);
  y += 4;

  if (sale.customer_name || sale.customer_phone) {
    const cust = [sale.customer_name, sale.customer_phone].filter(Boolean).join(" - ");
    doc.text(`Customer: ${cust}`, 5, y);
    y += 4;
  }

  // Table Header
  y += 2;
  doc.setFillColor(245, 245, 245);
  doc.rect(5, y - 3, pageWidth - 10, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  doc.text("ITEM", 6, y);
  doc.text("QTY x RATE", 46, y);
  doc.text("TOTAL", pageWidth - 6, y, { align: "right" });

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);

  // Line items
  (sale.items || []).forEach((item) => {
    const name = item.product_name || "Item";
    const truncatedName = name.length > 20 ? name.substring(0, 19) + "…" : name;
    const qtyRate = `${item.quantity} x Rs.${Number(item.unit_price).toFixed(2)}`;
    const lineTotal = `Rs.${Number(item.line_total).toFixed(2)}`;

    doc.text(truncatedName, 6, y);
    doc.text(qtyRate, 46, y);
    doc.text(lineTotal, pageWidth - 6, y, { align: "right" });
    y += 5;
  });

  // Totals divider
  y += 1;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text("Subtotal:", 38, y);
  doc.text(`Rs.${Number(sale.subtotal || sale.total_amount).toFixed(2)}`, pageWidth - 6, y, {
    align: "right",
  });
  y += 4;

  // Discount (if any)
  if (Number(sale.discount_amount) > 0) {
    doc.setTextColor(200, 50, 50);
    doc.text("Discount:", 38, y);
    doc.text(`- Rs.${Number(sale.discount_amount).toFixed(2)}`, pageWidth - 6, y, {
      align: "right",
    });
    y += 4;
  }

  // Final Total
  y += 1;
  doc.setFillColor(240, 248, 255);
  doc.rect(5, y - 3, pageWidth - 10, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 60, 130);
  doc.text("TOTAL AMOUNT:", 6, y + 1.5);
  doc.text(`Rs.${Number(sale.total_amount).toFixed(2)}`, pageWidth - 6, y + 1.5, {
    align: "right",
  });
  y += 8;

  // Payment method
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Payment Method: ${sale.payment_method || "Cash"}`, 5, y);
  y += 4;

  // Footer message
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  y += 5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(footerMessage, pageWidth / 2, y, { align: "center" });

  return doc;
}

/**
 * Triggers PDF download on client.
 */
export function downloadReceiptPdf(sale, shopSettings = {}) {
  const doc = generateReceiptPdf(sale, shopSettings);
  const fileName = `Receipt_${sale.bill_number || "MS-Shop"}.pdf`;
  doc.save(fileName);
}

/**
 * Shares receipt using Web Share API if supported, or fallback download + WhatsApp link.
 */
export async function shareReceipt(sale, shopSettings = {}) {
  const doc = generateReceiptPdf(sale, shopSettings);
  const fileName = `Receipt_${sale.bill_number || "MS-Shop"}.pdf`;
  const blob = doc.output("blob");

  // Attempt Web Share API with File
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: "application/pdf" })] })) {
    try {
      const file = new File([blob], fileName, { type: "application/pdf" });
      await navigator.share({
        title: `Bill ${sale.bill_number} - MS PAN SHOP`,
        text: `Receipt for ${sale.bill_number} of amount ${formatINR(sale.total_amount)} from MS PAN SHOP.`,
        files: [file],
      });
      return { success: true, method: "web-share" };
    } catch (err) {
      if (err.name === "AbortError") {
        return { success: false, cancelled: true };
      }
    }
  }

  // Fallback 1: If customer phone provided, open WhatsApp with receipt summary text
  const phone = sale.customer_phone ? sale.customer_phone.replace(/\D/g, "") : "";
  const summaryText = `*MS PAN SHOP - Bill Receipt*%0A` +
    `*Bill No:* ${sale.bill_number}%0A` +
    `*Date:* ${encodeURIComponent(formatDateTime(sale.created_at))}%0A` +
    `*Total:* ${encodeURIComponent(formatINR(sale.total_amount))}%0A` +
    `*Payment:* ${sale.payment_method}%0A%0A` +
    `Thank you for visiting MS PAN SHOP!`;

  downloadReceiptPdf(sale, shopSettings);

  if (phone) {
    const waUrl = `https://wa.me/91${phone.slice(-10)}?text=${summaryText}`;
    window.open(waUrl, "_blank");
    return { success: true, method: "whatsapp", downloaded: true };
  }

  return { success: true, method: "download", downloaded: true };
}
