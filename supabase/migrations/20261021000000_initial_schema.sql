-- =====================================================================
-- MS PAN SHOP BILLING APPLICATION — DATABASE INITIAL MIGRATION
-- Migration: 20261021000000_initial_schema.sql
-- Description: Creates categories, products, sales, sale_items, profiles,
--              shop_settings, atomic sale procedure, triggers, and RLS policies.
-- =====================================================================

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked to auth.users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Shop Owner',
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);

-- ---------------------------------------------------------------------
-- 3. PRODUCTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  sku TEXT,
  selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
  purchase_price NUMERIC(12, 2) CHECK (purchase_price IS NULL OR purchase_price >= 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'piece',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- ---------------------------------------------------------------------
-- 4. BILL NUMBER SEQUENCE & GENERATOR
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.bill_number_seq START WITH 1001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq BIGINT;
  v_date TEXT;
  v_bill_num TEXT;
BEGIN
  v_seq := nextval('public.bill_number_seq');
  -- Date prefix in Asia/Kolkata timezone: YYYYMMDD
  v_date := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
  v_bill_num := 'MS-' || v_date || '-' || lpad(v_seq::text, 4, '0');
  RETURN v_bill_num;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. SALES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Other')),
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED', 'REFUNDED')),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON public.sales(bill_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON public.sales(payment_method);

-- ---------------------------------------------------------------------
-- 6. SALE_ITEMS TABLE (Historical snapshot preserved)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- ---------------------------------------------------------------------
-- 7. SHOP_SETTINGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name TEXT NOT NULL DEFAULT 'MS PAN SHOP',
  tagline TEXT DEFAULT 'Pan, Cigarette, Confectionery & Drinks',
  phone TEXT DEFAULT '+91 98765 43210',
  address TEXT DEFAULT 'Main Road, Shop No. 1',
  footer_message TEXT DEFAULT 'Thank you for visiting MS PAN SHOP! Visit again.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings if not exists
INSERT INTO public.shop_settings (id, shop_name, tagline, phone, address, footer_message)
VALUES (1, 'MS PAN SHOP', 'Pan, Cigarette, Confectionery & Drinks', '', '', 'Thank you! Visit again.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. ATOMIC SALE CREATION FUNCTION
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sale_atomic(
  p_items JSONB,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_discount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'Cash',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_bill_number TEXT;
  v_subtotal NUMERIC(12, 2) := 0;
  v_discount NUMERIC(12, 2) := COALESCE(p_discount, 0);
  v_total NUMERIC(12, 2);
  v_item RECORD;
  v_prod RECORD;
  v_item_subtotal NUMERIC(12, 2);
  v_created_by UUID;
  v_items_result JSONB := '[]'::JSONB;
  v_sale_record RECORD;
BEGIN
  -- Validate items count
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot complete sale: Cart is empty.';
  END IF;

  -- Validate payment method
  IF p_payment_method NOT IN ('Cash', 'UPI', 'Other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  -- Get current user if authenticated
  v_created_by := auth.uid();

  -- First pass: Validate stock & calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
    product_id UUID,
    quantity INT,
    unit_price NUMERIC,
    product_name TEXT
  )
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity for % must be greater than zero.', v_item.product_name;
    END IF;

    IF v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price for % cannot be negative.', v_item.product_name;
    END IF;

    -- If linked to a product, lock product row and verify stock
    IF v_item.product_id IS NOT NULL THEN
      SELECT id, name, stock_quantity, selling_price INTO v_prod
      FROM public.products
      WHERE id = v_item.product_id
      FOR UPDATE;

      IF FOUND THEN
        IF v_prod.stock_quantity < v_item.quantity THEN
          RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
            v_prod.name, v_prod.stock_quantity, v_item.quantity;
        END IF;
      END IF;
    END IF;

    v_item_subtotal := ROUND((v_item.quantity * v_item.unit_price)::NUMERIC, 2);
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  -- Validate discount
  IF v_discount < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative.';
  END IF;

  IF v_discount > v_subtotal THEN
    RAISE EXCEPTION 'Discount (₹%) cannot exceed subtotal (₹%).', v_discount, v_subtotal;
  END IF;

  v_total := ROUND((v_subtotal - v_discount)::NUMERIC, 2);
  v_bill_number := public.generate_bill_number();

  -- Insert Sale record
  INSERT INTO public.sales (
    bill_number,
    customer_name,
    customer_phone,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    status,
    created_by,
    notes,
    created_at
  ) VALUES (
    v_bill_number,
    NULLIF(TRIM(p_customer_name), ''),
    NULLIF(TRIM(p_customer_phone), ''),
    v_subtotal,
    v_discount,
    v_total,
    p_payment_method,
    'COMPLETED',
    v_created_by,
    p_notes,
    now()
  ) RETURNING * INTO v_sale_record;

  v_sale_id := v_sale_record.id;

  -- Second pass: Insert line items and decrement stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
    product_id UUID,
    quantity INT,
    unit_price NUMERIC,
    product_name TEXT
  )
  LOOP
    v_item_subtotal := ROUND((v_item.quantity * v_item.unit_price)::NUMERIC, 2);

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total
    ) VALUES (
      v_sale_id,
      v_item.product_id,
      v_item.product_name,
      v_item.quantity,
      v_item.unit_price,
      v_item_subtotal
    );

    -- Decrement stock if linked product
    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET
        stock_quantity = stock_quantity - v_item.quantity,
        updated_at = now()
      WHERE id = v_item.product_id;
    END IF;

    -- Collect item for response
    v_items_result := v_items_result || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'line_total', v_item_subtotal
    );
  END LOOP;

  -- Return complete created sale object
  RETURN jsonb_build_object(
    'id', v_sale_record.id,
    'bill_number', v_sale_record.bill_number,
    'customer_name', v_sale_record.customer_name,
    'customer_phone', v_sale_record.customer_phone,
    'subtotal', v_sale_record.subtotal,
    'discount_amount', v_sale_record.discount_amount,
    'total_amount', v_sale_record.total_amount,
    'payment_method', v_sale_record.payment_method,
    'created_at', v_sale_record.created_at,
    'items', v_items_result
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 9. AUTH USER PROFILE SYNC TRIGGER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email, 'Shop Owner'),
    'owner'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-run
DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users full access categories" ON public.categories;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users full access products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can view sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Public can view shop settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Authenticated can update shop settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles editable by owner" ON public.profiles;

-- Categories policies
CREATE POLICY "Public can view active categories"
  ON public.categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users full access categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Products policies
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users full access products"
  ON public.products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Sales policies
CREATE POLICY "Authenticated users can view sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Sale Items policies
CREATE POLICY "Authenticated users can view sale_items"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sale_items"
  ON public.sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Shop Settings policies
CREATE POLICY "Public can view shop settings"
  ON public.shop_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can update shop settings"
  ON public.shop_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Profiles editable by owner"
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant execute permissions on RPC to authenticated and anon
GRANT EXECUTE ON FUNCTION public.create_sale_atomic TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE public.bill_number_seq TO authenticated, anon;
