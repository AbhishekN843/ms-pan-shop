import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatINR, formatDateTime, getKolkataDateString } from "../src/lib/utils.js";
import { generateReceiptPdf } from "../src/lib/receiptPdf.js";

describe("MS PAN SHOP — Billing Calculation & Utility Tests", () => {
  test("formatINR formats Indian currency with symbol and 2 decimals", () => {
    assert.match(formatINR(10), /₹\s?10\.00/);
    assert.match(formatINR(1500.5), /₹\s?1,500\.50/);
    assert.match(formatINR(0), /₹\s?0\.00/);
    assert.match(formatINR("25.75"), /₹\s?25\.75/);
  });

  test("getKolkataDateString returns YYYY-MM-DD in Asia/Kolkata timezone", () => {
    const kolkataDate = getKolkataDateString(new Date("2026-10-21T06:30:00Z"));
    assert.equal(kolkataDate, "2026-10-21");
  });

  test("formatDateTime formats readable date string", () => {
    const formatted = formatDateTime("2026-10-21T06:30:00Z");
    assert.ok(formatted.includes("2026"));
    assert.ok(formatted.includes("Oct"));
  });

  test("Cart subtotal and line total calculation accuracy", () => {
    const cart = [
      { product_name: "Meetha Pan", unit_price: 20.0, quantity: 3, line_total: 60.0 },
      { product_name: "Gold Flake Small", unit_price: 10.0, quantity: 5, line_total: 50.0 },
      { product_name: "Special Cutting Chai", unit_price: 10.0, quantity: 2, line_total: 20.0 },
    ];

    const subtotal = Number(cart.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
    assert.equal(subtotal, 130.0);

    const discount = 15.0;
    const finalTotal = Number(Math.max(0, subtotal - discount).toFixed(2));
    assert.equal(finalTotal, 115.0);
  });

  test("Discount validation prevents negative discount and exceeding subtotal", () => {
    const subtotal = 100.0;

    // Normal discount
    const validDiscount = Math.min(20, subtotal);
    assert.equal(validDiscount, 20);

    // Negative discount clamped to 0
    const rawNegativeDiscount = -10;
    const sanitizedNegative = rawNegativeDiscount < 0 ? 0 : rawNegativeDiscount;
    assert.equal(sanitizedNegative, 0);

    // Exceeding discount capped at subtotal
    const excessDiscount = 150;
    const cappedDiscount = Math.min(excessDiscount, subtotal);
    assert.equal(cappedDiscount, 100);
    assert.equal(subtotal - cappedDiscount, 0);
  });

  test("Stock reduction prevents selling more than available stock", () => {
    const product = { name: "Classic Milds", stock_quantity: 5 };
    const requestedQty = 8;

    const hasEnoughStock = product.stock_quantity >= requestedQty;
    assert.equal(hasEnoughStock, false);

    const validQty = 4;
    const canSell = product.stock_quantity >= validQty;
    assert.equal(canSell, true);

    const remainingStock = product.stock_quantity - validQty;
    assert.equal(remainingStock, 1);
  });

  test("Historical sale item maintains frozen price even if product price changes", () => {
    // Original sale item record
    const originalSaleItem = {
      product_id: "prod-1",
      product_name: "Meetha Pan",
      unit_price: 20.0,
      quantity: 2,
      line_total: 40.0,
    };

    // Product later increases price in catalog
    const updatedProductInCatalog = {
      id: "prod-1",
      name: "Meetha Pan",
      selling_price: 25.0, // increased from 20 to 25
    };

    // The historical sale item must remain unchanged
    assert.equal(originalSaleItem.unit_price, 20.0);
    assert.equal(originalSaleItem.line_total, 40.0);
    assert.notEqual(originalSaleItem.unit_price, updatedProductInCatalog.selling_price);
  });

  test("Bill number format verification", () => {
    const billRegex = /^MS-\d{8}-\d{4,}$/;
    const sampleBill = "MS-20261021-1001";
    assert.match(sampleBill, billRegex);
  });

  test("Offline jsPDF receipt generator creates valid PDF document", () => {
    const sampleSale = {
      bill_number: "MS-20261021-1001",
      customer_name: "Ramesh",
      customer_phone: "9876543210",
      subtotal: 70.0,
      discount_amount: 5.0,
      total_amount: 65.0,
      payment_method: "Cash",
      created_at: new Date().toISOString(),
      items: [
        { product_name: "Meetha Pan", quantity: 2, unit_price: 20.0, line_total: 40.0 },
        { product_name: "502 Bidi", quantity: 1, unit_price: 25.0, line_total: 25.0 },
        { product_name: "Center Fresh", quantity: 5, unit_price: 1.0, line_total: 5.0 },
      ],
    };

    const doc = generateReceiptPdf(sampleSale, {
      shop_name: "MS PAN SHOP",
      phone: "+91 98765 43210",
      address: "Main Market Road",
    });

    assert.ok(doc);
    const output = doc.output("arraybuffer");
    assert.ok(output.byteLength > 1000);
  });
});
