# MS PAN SHOP — Billing & Management Application

A complete, production-quality, mobile-first Point of Sale (POS) and shop billing application tailored for **MS PAN SHOP**.

Designed for speed, simplicity, and ease of use on Android smartphones, tablets, Windows laptops, and desktop browsers.

---

## 🌟 Key Features

### 1. Fast Billing Screen ("New Bill" — Highest Priority)
- **Quick Touch POS**: Category pills and instant search for lightning-fast product lookup.
- **Dynamic Cart**: Tap to add, increase/decrease quantity, manual quantity input, and remove items.
- **Smart Discount Engine**: Percentage/Rupee discount with automated guardrails preventing negative discounts or discounts exceeding the subtotal.
- **Customer Details**: Optional name and mobile number input for instant receipt sharing.
- **Payment Method Recording**: Cash (default), UPI, and Other payment recordings.
- **Atomic Sale Completion**: Uses a PostgreSQL database transaction (`create_sale_atomic`) that atomically:
  - Generates a unique sequential bill number (e.g. `MS-20261021-1001`).
  - Verifies stock and locks rows to prevent overselling.
  - Decrements product stock quantities.
  - Inserts the sale and captures historical snapshot line items (preserving frozen item names and prices).
- **Duplicate Prevention**: Complete Sale button disables immediately upon submission with a spinner, preventing double-clicks or duplicate charges.
- **Safe Cart Clearing**: The cart clears only after successful persistence in Supabase.

### 2. Receipt, Thermal Printing, PDF & WhatsApp Sharing
- **Branded Receipt**: Elegant layout displaying **MS PAN SHOP**, phone number, address, bill number, timestamp (Asia/Kolkata), line items, subtotal, discount, net payable, and thank-you footer.
- **Browser & Thermal Printing**: Built-in `@media print` CSS optimized for 80mm / 58mm thermal receipt printers as well as standard A4 sheets. Hides all app buttons, headers, and UI chrome automatically.
- **Offline Client-Side PDF**: Uses `jsPDF` to generate crisp vector PDF bills offline without any paid external APIs.
- **Instant Sharing**: Utilizes the native Web Share API on mobile devices, with automatic fallback to download the PDF and pre-fill a formatted WhatsApp receipt message.

### 3. Dashboard (Asia/Kolkata Timezone)
- Real-time calculations from database records:
  - **Today's Total Sales** in INR (₹)
  - **Bills Generated Today**
  - **Average Bill Value**
  - **Payment Mode Split** (Cash vs UPI vs Other collections)
  - **Low Stock Alerts** (Products with stock &le; 10 units)
  - **Recent Transactions** table with instant receipt inspection.

### 4. Product Catalog & Inventory Management
- Full CRUD: Add, edit, deactivate, and reactivate products.
- Fields: Name, Category, Unit (piece, packet, glass, cup, box, bottle, pouch), Selling Price (₹), Purchase/Cost Price, Current Stock, optional SKU.
- Input validation: Prevents negative prices and invalid stock quantities.
- Quick Stock Adjustment modal (+ / - inward/outward adjustments).
- Safe deactivation/archival: Deactivated products are hidden from the billing screen while historical sales records remain 100% intact.

### 5. Product Categories
- Default shop categories:
  1. Cigarette
  2. Bidi
  3. Pan
  4. Pan Masala
  5. Tobacco
  6. Tea Glasses
  7. Mouth Fresheners
  8. Biscuits and Snacks
  9. Other Products
- Add, edit, and deactivate categories dynamically without hardcoding IDs in frontend code.

### 6. Sales History & Audit Trail
- Historical transaction ledger with bill number, customer details, date/time, item counts, and totals.
- Filters: Search by bill number or customer name/phone, filter by date ("Today", "Yesterday", "Last 7 Days", "Last 30 Days", "All Time"), and filter by payment mode.
- View complete receipt, re-print, and re-download PDF receipts at any time.

### 7. Shop Settings & Security
- Customizable shop name, phone number, address, tagline, and receipt footer note.
- Secure Supabase Auth owner login gate.
- Row Level Security (RLS) policies on all tables.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite 8, JavaScript / ES Modules
- **Styling**: Mobile-first responsive CSS with print media queries (`@media print`)
- **Database & Auth**: Supabase PostgreSQL 15, Supabase Auth, Row Level Security (RLS)
- **PDF Generation**: Client-side `jspdf` (100% free, offline, zero paid APIs)
- **Quality Assurance**: `oxlint` (zero warnings), native Node test runner (`node:test`)
- **Hosting**: Vercel / GitHub

---

## 🚀 Setup & Database Configuration

### Step 1: Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):

```bash
VITE_SUPABASE_URL=https://wlavkmkycgasnrzvvukr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_IULGWugZNJiOPQEGsCtegw_H7XdB9U_
```

> **Note**: Never commit `.env` to Git. It is automatically ignored by `.gitignore`.

### Step 2: Database Migration in Supabase SQL Editor
1. Open your Supabase Dashboard:
   [https://supabase.com/dashboard/project/wlavkmkycgasnrzvvukr/sql/new](https://supabase.com/dashboard/project/wlavkmkycgasnrzvvukr/sql/new)
2. Open the file `supabase/setup_complete.sql` in this project.
3. Copy the entire contents of `supabase/setup_complete.sql` and paste it into the Supabase SQL Editor.
4. Click **Run** (or press `Ctrl+Enter`).
5. This will create:
   - Tables: `categories`, `products`, `sales`, `sale_items`, `profiles`, `shop_settings`
   - Sequence: `bill_number_seq` and generator function `generate_bill_number()`
   - Stored Procedure: `create_sale_atomic`
   - RLS Policies and authentication triggers
   - Seed data with the 9 default categories and starter products for MS Pan Shop.

### Step 3: Create the Owner Account
1. In your Supabase Dashboard, go to **Authentication** > **Users**.
2. Click **Add user** > **Create user**.
3. Enter your email (e.g., `owner@mspan.com`) and a secure password.
4. Set "Auto Confirm User?" to **Yes**.
5. You can now log into the application using these credentials.

### Step 4: Run Locally
```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Run code linter
npm run lint

# Start local development server
npm run dev
```

### Step 5: Build for Production
```bash
npm run build
```

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```
The test suite validates:
- Indian Rupee currency formatting (`formatINR`)
- Asia/Kolkata date and time formatting
- Billing calculations, line totals, and subtotal arithmetic
- Discount validation guardrails
- Stock constraints and out-of-stock validation
- Historical snapshot integrity (frozen price preservation)
- Bill number sequence format
- Offline PDF receipt generation

---

## 📄 License
Private and proprietary to **MS PAN SHOP**.
