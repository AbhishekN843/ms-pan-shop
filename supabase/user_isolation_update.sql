-- =====================================================================
-- MS PAN SHOP — USER-WISE MULTI-TENANT ISOLATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wlavkmkycgasnrzvvukr/sql/new
-- =====================================================================

-- 1. Add user_id column to tables if not already present
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Preserve existing shop data by assigning orphaned records to the first registered user
DO $$
DECLARE
  v_first_user UUID;
BEGIN
  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_first_user IS NOT NULL THEN
    UPDATE public.categories SET user_id = v_first_user WHERE user_id IS NULL;
    UPDATE public.products SET user_id = v_first_user WHERE user_id IS NULL;
    UPDATE public.sales SET user_id = v_first_user WHERE user_id IS NULL;
    UPDATE public.shop_settings SET user_id = v_first_user WHERE user_id IS NULL;
  ELSE
    DELETE FROM public.shop_settings WHERE user_id IS NULL;
  END IF;
END $$;

-- 3. Update constraints for user-isolation
-- Categories slug is unique per user (not global)
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS idx_categories_slug;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_slug_unique;
ALTER TABLE public.categories ADD CONSTRAINT categories_user_slug_unique UNIQUE (user_id, slug);

-- Shop settings primary key keyed on user_id
ALTER TABLE public.shop_settings DROP CONSTRAINT IF EXISTS shop_settings_id_check;
ALTER TABLE public.shop_settings DROP CONSTRAINT IF EXISTS shop_settings_pkey CASCADE;
ALTER TABLE public.shop_settings ALTER COLUMN id DROP NOT NULL;
ALTER TABLE public.shop_settings ALTER COLUMN id DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shop_settings_user_id_pkey'
  ) THEN
    ALTER TABLE public.shop_settings ADD CONSTRAINT shop_settings_user_id_pkey PRIMARY KEY (user_id);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);

-- 5. Set default user_id to currently logged-in Supabase Auth user
ALTER TABLE public.categories ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.products ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.sales ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.shop_settings ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 6. Ensure schema permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 7. Update create_sale_atomic to enforce per-user isolation
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
  v_user_id UUID;
  v_items_result JSONB := '[]'::JSONB;
  v_sale_record RECORD;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot complete sale: Cart is empty.';
  END IF;

  IF p_payment_method NOT IN ('Cash', 'UPI', 'Other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User session not found.';
  END IF;

  -- Validate user ownership & stock & compute subtotal
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
      WHERE id = v_item.product_id AND user_id = v_user_id
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
    RAISE EXCEPTION 'Discount (Rs. %) cannot exceed subtotal (Rs. %).', v_discount, v_subtotal;
  END IF;

  v_total := ROUND((v_subtotal - v_discount)::NUMERIC, 2);
  v_bill_number := public.generate_bill_number();

  -- Insert Sale record tied to this user
  INSERT INTO public.sales (
    user_id,
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
    v_user_id,
    v_bill_number,
    NULLIF(TRIM(p_customer_name), ''),
    NULLIF(TRIM(p_customer_phone), ''),
    v_subtotal,
    v_discount,
    v_total,
    p_payment_method,
    'COMPLETED',
    v_user_id,
    p_notes,
    now()
  ) RETURNING * INTO v_sale_record;

  v_sale_id := v_sale_record.id;

  -- Insert line items and decrement stock
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
      WHERE id = v_item.product_id AND user_id = v_user_id;
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

-- 8. ROW LEVEL SECURITY (RLS) POLICIES — STRICT USER ISOLATION
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users full access categories" ON public.categories;
DROP POLICY IF EXISTS "Allow anon and authenticated to read categories" ON public.categories;
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;

CREATE POLICY "Users manage own categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users full access products" ON public.products;
DROP POLICY IF EXISTS "Allow anon and authenticated to read products" ON public.products;
DROP POLICY IF EXISTS "Users manage own products" ON public.products;

CREATE POLICY "Users manage own products"
  ON public.products FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Users manage own sales" ON public.sales;

CREATE POLICY "Users manage own sales"
  ON public.sales FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Users manage own sale_items" ON public.sale_items;

CREATE POLICY "Users manage own sale_items"
  ON public.sale_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE public.sales.id = public.sale_items.sale_id
      AND public.sales.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE public.sales.id = public.sale_items.sale_id
      AND public.sales.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can view shop settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Authenticated can update shop settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Allow anon and authenticated to read shop_settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Users manage own shop settings" ON public.shop_settings;

CREATE POLICY "Users manage own shop settings"
  ON public.shop_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
