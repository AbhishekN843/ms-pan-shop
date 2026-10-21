-- =====================================================================
-- MS PAN SHOP — COMPLETE DATABASE SETUP (Schema + Seed Data)
-- Run this in your Supabase Project SQL Editor:
-- https://supabase.com/dashboard/project/wlavkmkycgasnrzvvukr/sql/new
-- =====================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Shop Owner',
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Categories Table
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

-- 3. Products Table
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

-- 4. Bill Number Sequence & Generator
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
  v_date := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
  v_bill_num := 'MS-' || v_date || '-' || lpad(v_seq::text, 4, '0');
  RETURN v_bill_num;
END;
$$;

-- 5. Sales Table
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

-- 6. Sale Items Table
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

-- 7. Shop Settings Table
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name TEXT NOT NULL DEFAULT 'MS PAN SHOP',
  tagline TEXT DEFAULT 'Pan, Cigarette, Confectionery & Drinks',
  phone TEXT DEFAULT '+91 98765 43210',
  address TEXT DEFAULT 'Main Road, Shop No. 1',
  footer_message TEXT DEFAULT 'Thank you for visiting MS PAN SHOP! Visit again.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.shop_settings (id, shop_name, tagline, phone, address, footer_message)
VALUES (1, 'MS PAN SHOP', 'Pan, Cigarette, Confectionery & Drinks', '+91 98765 43210', 'Main Road, Shop No. 1', 'Thank you for visiting MS PAN SHOP! Visit again.')
ON CONFLICT (id) DO NOTHING;

-- 8. Atomic Sale Creation Procedure
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
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot complete sale: Cart is empty.';
  END IF;

  IF p_payment_method NOT IN ('Cash', 'UPI', 'Other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  v_created_by := auth.uid();

  -- First pass: Validate stock & compute subtotal
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

    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET
        stock_quantity = stock_quantity - v_item.quantity,
        updated_at = now()
      WHERE id = v_item.product_id;
    END IF;

    v_items_result := v_items_result || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'line_total', v_item_subtotal
    );
  END LOOP;

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

-- 9. Trigger for auth user profile sync
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

-- 10. RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Public can view active categories"
  ON public.categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users full access categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users full access products"
  ON public.products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view sale_items"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sale_items"
  ON public.sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Public can view shop settings"
  ON public.shop_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can update shop settings"
  ON public.shop_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Profiles editable by owner"
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

GRANT EXECUTE ON FUNCTION public.create_sale_atomic TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE public.bill_number_seq TO authenticated, anon;

-- 11. Seed Categories
INSERT INTO public.categories (name, slug, display_order, is_active)
VALUES
  ('Cigarette', 'cigarette', 1, true),
  ('Bidi', 'bidi', 2, true),
  ('Pan', 'pan', 3, true),
  ('Pan Masala', 'pan-masala', 4, true),
  ('Tobacco', 'tobacco', 5, true),
  ('Tea Glasses', 'tea-glasses', 6, true),
  ('Mouth Fresheners', 'mouth-fresheners', 7, true),
  ('Biscuits and Snacks', 'biscuits-snacks', 8, true),
  ('Other Products', 'other-products', 9, true)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = now();

-- 12. Seed Initial Products
DO $$
DECLARE
  v_cat_pan UUID;
  v_cat_pan_masala UUID;
  v_cat_cig UUID;
  v_cat_bidi UUID;
  v_cat_tobacco UUID;
  v_cat_tea UUID;
  v_cat_mouth UUID;
  v_cat_snacks UUID;
  v_cat_other UUID;
BEGIN
  SELECT id INTO v_cat_pan FROM public.categories WHERE slug = 'pan';
  SELECT id INTO v_cat_pan_masala FROM public.categories WHERE slug = 'pan-masala';
  SELECT id INTO v_cat_cig FROM public.categories WHERE slug = 'cigarette';
  SELECT id INTO v_cat_bidi FROM public.categories WHERE slug = 'bidi';
  SELECT id INTO v_cat_tobacco FROM public.categories WHERE slug = 'tobacco';
  SELECT id INTO v_cat_tea FROM public.categories WHERE slug = 'tea-glasses';
  SELECT id INTO v_cat_mouth FROM public.categories WHERE slug = 'mouth-fresheners';
  SELECT id INTO v_cat_snacks FROM public.categories WHERE slug = 'biscuits-snacks';
  SELECT id INTO v_cat_other FROM public.categories WHERE slug = 'other-products';

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Meetha Pan (Sweet Pan)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Meetha Pan (Sweet Pan)', v_cat_pan, 20.00, 12.00, 50, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Sada Pan (Plain Pan)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Sada Pan (Plain Pan)', v_cat_pan, 15.00, 8.00, 50, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Chocolate Pan') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Chocolate Pan', v_cat_pan, 35.00, 20.00, 30, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Vimal Pan Masala') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Vimal Pan Masala', v_cat_pan_masala, 10.00, 7.50, 100, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Kamla Pasand') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Kamla Pasand', v_cat_pan_masala, 15.00, 11.50, 80, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'RMD Pan Masala') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('RMD Pan Masala', v_cat_pan_masala, 20.00, 16.00, 60, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Classic Regular') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Classic Regular', v_cat_cig, 18.00, 15.00, 120, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Gold Flake Small') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Gold Flake Small', v_cat_cig, 10.00, 8.00, 150, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Wills Navy Cut') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Wills Navy Cut', v_cat_cig, 16.00, 13.50, 100, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = '502 Pataka Bidi') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('502 Pataka Bidi', v_cat_bidi, 25.00, 18.00, 40, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Sambhaji Bidi') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Sambhaji Bidi', v_cat_bidi, 20.00, 15.00, 50, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Miraj Tobacco') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Miraj Tobacco', v_cat_tobacco, 15.00, 11.00, 60, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Special Cutting Chai') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Special Cutting Chai', v_cat_tea, 10.00, 5.00, 200, 'glass');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Full Chai') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Full Chai', v_cat_tea, 15.00, 8.00, 100, 'cup');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Pass Pass Mint') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Pass Pass Mint', v_cat_mouth, 5.00, 3.50, 150, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Center Fresh Gum') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Center Fresh Gum', v_cat_mouth, 2.00, 1.20, 300, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Parle-G Biscuit') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Parle-G Biscuit', v_cat_snacks, 10.00, 8.00, 60, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Kurkure Masala Munch') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Kurkure Masala Munch', v_cat_snacks, 20.00, 16.00, 40, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Mineral Water 500ml') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Mineral Water 500ml', v_cat_other, 10.00, 6.00, 80, 'bottle');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Match Box') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Match Box', v_cat_other, 2.00, 1.00, 200, 'box');
  END IF;
END $$;
