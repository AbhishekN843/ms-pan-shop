import { jsPDF } from "jspdf";
import { formatDateTime } from "./utils.js";

/**
 * Generates a clean, well-spaced, beautifully indented PDF receipt for MS PAN SHOP.
 * Designed with proper margins, no truncated item names, and distinct column spacing.
 * @param {Object} sale - Complete sale record with items.
 * @param {Object} shopSettings - Shop metadata (name, phone, address, etc.)
 * @returns {jsPDF}
 */
export function generateReceiptPdf(sale, shopSettings = {}) {
  const shopName = shopSettings.shop_name || "MS PAN SHOP";
  const tagline =
    shopSettings.tagline || "Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups";
  const phone = shopSettings.phone || "";
  const address = shopSettings.address || "";
  const footerMessage =
    shopSettings.footer_message || "Thank you for your business! Visit again.";

  const pageWidth = 85; // 85mm width for comfortable thermal & mobile viewing
  const leftMargin = 7;
  const rightMargin = 78;
  const contentWidth = rightMargin - leftMargin; // 71mm usable content width

  // Estimate document height dynamically
  const items = sale.items || sale.sale_items || [];
  let estimatedHeight = 110 + items.length * 15;
  if (address) estimatedHeight += 10;
  if (sale.customer_name || sale.customer_phone) estimatedHeight += 10;
  estimatedHeight = Math.max(160, estimatedHeight);

  const doc = new jsPDF({
    unit: "mm",
    format: [pageWidth, estimatedHeight],
    orientation: "portrait",
  });

  let y = 10;

  // 1. BRAND HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 30, 45);
  doc.text(shopName, pageWidth / 2, y, { align: "center" });

  y += 5;
  if (tagline) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 90, 105);
    const taglineLines = doc.splitTextToSize(tagline, contentWidth);
    doc.text(taglineLines, pageWidth / 2, y, { align: "center" });
    y += taglineLines.length * 3.5 + 1;
  }

  if (address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 110);
    const addressLines = doc.splitTextToSize(address, contentWidth);
    doc.text(addressLines, pageWidth / 2, y, { align: "center" });
    y += addressLines.length * 3.5 + 1;
  }

  if (phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 110);
    doc.text(`Phone / WhatsApp: ${phone}`, pageWidth / 2, y, { align: "center" });
    y += 4.5;
  }

  // Divider
  y += 1;
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, y, rightMargin, y);
  y += 5;

  // 2. INVOICE METADATA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 40, 55);
  doc.text("INVOICE / BILL", leftMargin, y);
  doc.text(sale.bill_number || "N/A", rightMargin, y, { align: "right" });
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 95, 105);
  doc.text("Date & Time:", leftMargin, y);
  doc.text(formatDateTime(sale.created_at || new Date()), rightMargin, y, {
    align: "right",
  });
  y += 4;

  if (sale.customer_name || sale.customer_phone) {
    const cust = [sale.customer_name, sale.customer_phone].filter(Boolean).join("  •  ");
    doc.text("Customer:", leftMargin, y);
    doc.text(cust, rightMargin, y, { align: "right" });
    y += 4;
  }

  // 3. TABLE HEADER (Clean Gray Strip)
  y += 2;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(leftMargin, y - 3, contentWidth, 6, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 60, 75);
  doc.text("#   ITEM DESCRIPTION", leftMargin + 2, y + 1);
  doc.text("AMOUNT (Rs.)", rightMargin - 2, y + 1, { align: "right" });
  y += 6.5;

  // 4. ITEMS LIST (Indented Two-Line Professional Format)
  items.forEach((item, index) => {
    const itemName = item.product_name || "Item";
    const qty = item.quantity || 1;
    const unitPrice = Number(item.unit_price || 0).toFixed(2);
    const lineTotal = Number(item.line_total || 0).toFixed(2);
    const unit = item.unit || "pack";

    // Item Name in Bold (Full Width, wraps naturally if long)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(25, 30, 40);

    const namePrefix = `${index + 1}.  `;
    const fullItemTitle = `${namePrefix}${itemName}`;
    const itemLines = doc.splitTextToSize(fullItemTitle, contentWidth);
    doc.text(itemLines, leftMargin + 1, y);
    y += itemLines.length * 3.8;

    // Line 2: Indented Quantity & Rate on Left, Line Total on Right
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 90, 105);

    // Indented by 5mm
    const calcDetail = `Qty: ${qty} ${unit}   ×   Rs. ${unitPrice}`;
    doc.text(calcDetail, leftMargin + 5, y);

    // Amount cleanly right-aligned
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 25, 35);
    doc.text(`Rs. ${lineTotal}`, rightMargin - 1, y, { align: "right" });
    y += 4.5;

    // Subtle dotted separator between items
    doc.setDrawColor(230, 235, 240);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.line(leftMargin + 3, y - 1, rightMargin - 3, y - 1);
    doc.setLineDashPattern([], 0); // reset
    y += 2.5;
  });

  // 5. TOTALS SECTION
  y += 1;
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y, rightMargin, y);
  y += 5;

  const subtotalVal = Number(sale.subtotal || sale.total_amount).toFixed(2);
  const discountVal = Number(sale.discount_amount || 0).toFixed(2);
  const totalVal = Number(sale.total_amount).toFixed(2);

  // Subtotal row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 90, 105);
  doc.text("Subtotal:", leftMargin + 20, y);
  doc.text(`Rs. ${subtotalVal}`, rightMargin - 1, y, { align: "right" });
  y += 4;

  // Discount row (if any)
  if (Number(sale.discount_amount) > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text("Discount Applied:", leftMargin + 20, y);
    doc.text(`- Rs. ${discountVal}`, rightMargin - 1, y, { align: "right" });
    y += 4;
  }

  // 6. TOTAL AMOUNT PAYABLE BOX (Highlighted, padded)
  y += 1.5;
  doc.setFillColor(238, 246, 255);
  doc.setDrawColor(186, 220, 255);
  doc.setLineWidth(0.4);
  doc.roundedRect(leftMargin, y - 3, contentWidth, 8.5, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(2, 100, 180);
  doc.text("TOTAL AMOUNT:", leftMargin + 3, y + 2.5);

  doc.setFontSize(11);
  doc.setTextColor(15, 65, 130);
  doc.text(`Rs. ${totalVal}`, rightMargin - 3, y + 2.5, { align: "right" });
  y += 10.5;

  // Payment Mode
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 95, 105);
  doc.text(`Payment Mode: ${sale.payment_method || "Cash"}`, leftMargin + 1, y);
  y += 5;

  // 7. FOOTER
  doc.setDrawColor(220, 225, 235);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(leftMargin, y, rightMargin, y);
  doc.setLineDashPattern([], 0);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 115, 125);
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

  // Attempt Web Share API
  if (
    navigator.canShare &&
    navigator.canShare({
      files: [new File([blob], fileName, { type: "application/pdf" })],
    })
  ) {
    try {
      const file = new File([blob], fileName, { type: "application/pdf" });
      await navigator.share({
        title: `Bill ${sale.bill_number} - MS PAN SHOP`,
        text: `Receipt for ${sale.bill_number} of amount Rs.${Number(sale.total_amount).toFixed(2)} from MS PAN SHOP.`,
        files: [file],
      });
      return { success: true, method: "web-share" };
    } catch (err) {
      if (err.name === "AbortError") {
        return { success: false, cancelled: true };
      }
    }
  }

  // Fallback: download PDF and prefill WhatsApp message if phone provided
  downloadReceiptPdf(sale, shopSettings);

  const phone = sale.customer_phone ? sale.customer_phone.replace(/\D/g, "") : "";
  const summaryText =
    `*MS PAN SHOP - Bill Receipt*%0A` +
    `*Bill No:* ${sale.bill_number}%0A` +
    `*Date:* ${encodeURIComponent(formatDateTime(sale.created_at))}%0A` +
    `*Total:* Rs. ${Number(sale.total_amount).toFixed(2)}%0A` +
    `*Payment:* ${sale.payment_method}%0A%0A` +
    `Thank you for your business!`;

  if (phone) {
    const waUrl = `https://wa.me/91${phone.slice(-10)}?text=${summaryText}`;
    window.open(waUrl, "_blank");
    return { success: true, method: "whatsapp", downloaded: true };
  }

  return { success: true, method: "download", downloaded: true };
}

/**
 * Generates a full-sized, professional A4 Tax / Wholesale Invoice PDF.
 * Ideal for wholesale buyers, gst/billing records, and accounting.
 * @param {Object} sale
 * @param {Object} shopSettings
 * @returns {jsPDF}
 */
export function generateA4InvoicePdf(sale, shopSettings = {}) {
  const shopName = shopSettings.shop_name || "MS PAN SHOP";
  const tagline =
    shopSettings.tagline || "Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups";
  const phone = shopSettings.phone || "+91 98765 43210";
  const address = shopSettings.address || "Main Market Road";
  const footerMessage =
    shopSettings.footer_message || "Thank you for your business! Visit again for wholesale rates.";

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 16;

  // Header Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, "FD");

  // Left: Shop Name & Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(shopName, margin + 6, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(tagline, margin + 6, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Address: ${address}`, margin + 6, y + 21);
  doc.text(`Phone / WhatsApp: ${phone}`, margin + 6, y + 26);

  // Right: Invoice Title & Meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199);
  doc.text("WHOLESALE BILL / INVOICE", pageWidth - margin - 6, y + 9, {
    align: "right",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Bill No: ${sale.bill_number || "N/A"}`, pageWidth - margin - 6, y + 16, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${formatDateTime(sale.created_at || new Date())}`, pageWidth - margin - 6, y + 21, {
    align: "right",
  });
  doc.text(`Payment: ${sale.payment_method || "Cash"}`, pageWidth - margin - 6, y + 26, {
    align: "right",
  });

  y += 40;

  // Customer Section (if provided)
  if (sale.customer_name || sale.customer_phone) {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Billed To: ${sale.customer_name || "Valued Customer"}`, margin + 4, y + 6.5);
    if (sale.customer_phone) {
      doc.text(`Contact: ${sale.customer_phone}`, pageWidth - margin - 4, y + 6.5, {
        align: "right",
      });
    }
    y += 14;
  }

  // Table Columns
  // Col 1: S.No (12mm)
  // Col 2: Description (80mm)
  // Col 3: Unit (25mm)
  // Col 4: Qty (15mm)
  // Col 5: Unit Price (25mm)
  // Col 6: Total (25mm)
  const colX = {
    sno: margin + 3,
    desc: margin + 14,
    unit: margin + 96,
    qty: margin + 122,
    rate: margin + 148,
    total: pageWidth - margin - 4,
  };

  // Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("S.No", colX.sno, y + 5.5);
  doc.text("ITEM DESCRIPTION", colX.desc, y + 5.5);
  doc.text("PACK / UNIT", colX.unit, y + 5.5);
  doc.text("QTY", colX.qty, y + 5.5);
  doc.text("RATE (Rs.)", colX.rate, y + 5.5, { align: "right" });
  doc.text("TOTAL (Rs.)", colX.total, y + 5.5, { align: "right" });
  y += 8;

  // Table Rows
  const items = sale.items || sale.sale_items || [];
  doc.setFontSize(8.5);

  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    const rowHeight = 7.5;

    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(String(index + 1), colX.sno, y + 5);

    doc.setFont("helvetica", "bold");
    doc.text(item.product_name || "Item", colX.desc, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(item.unit || "pack", colX.unit, y + 5);
    doc.text(String(item.quantity || 1), colX.qty, y + 5);

    doc.text(Number(item.unit_price || 0).toFixed(2), colX.rate, y + 5, {
      align: "right",
    });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(Number(item.line_total || 0).toFixed(2), colX.total, y + 5, {
      align: "right",
    });

    y += rowHeight;
  });

  // Bottom Table Border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Summary Block (Right Aligned)
  const summaryX = pageWidth - margin - 75;
  const summaryValX = pageWidth - margin - 4;

  const subtotalVal = Number(sale.subtotal || sale.total_amount).toFixed(2);
  const discountVal = Number(sale.discount_amount || 0).toFixed(2);
  const totalVal = Number(sale.total_amount).toFixed(2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal:", summaryX, y);
  doc.text(`Rs. ${subtotalVal}`, summaryValX, y, { align: "right" });
  y += 5.5;

  if (Number(sale.discount_amount) > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text("Discount Applied:", summaryX, y);
    doc.text(`- Rs. ${discountVal}`, summaryValX, y, { align: "right" });
    y += 5.5;
  }

  // Net Amount Box
  doc.setFillColor(238, 246, 255);
  doc.setDrawColor(186, 220, 255);
  doc.roundedRect(summaryX - 4, y - 3, 79, 10, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(2, 132, 199);
  doc.text("NET AMOUNT:", summaryX, y + 4);
  doc.text(`Rs. ${totalVal}`, summaryValX, y + 4, { align: "right" });
  y += 18;

  // Footer / Terms
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Terms & Conditions: Goods once sold will not be returned or exchanged.", margin, y);
  doc.text("This is a computer generated invoice.", margin, y + 4);

  // Signatory Box on Right
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("For MS PAN SHOP", pageWidth - margin - 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Authorized Signatory", pageWidth - margin - 40, y + 12);

  y += 18;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(footerMessage, pageWidth / 2, y, { align: "center" });

  return doc;
}

/**
 * Triggers full A4 invoice PDF download.
 */
export function downloadA4InvoicePdf(sale, shopSettings = {}) {
  const doc = generateA4InvoicePdf(sale, shopSettings);
  const fileName = `Invoice_A4_${sale.bill_number || "MS-Shop"}.pdf`;
  doc.save(fileName);
}
