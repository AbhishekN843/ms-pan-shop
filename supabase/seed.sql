-- =====================================================================
-- MS PAN SHOP — SEED DATA (Idempotent)
-- File: supabase/seed.sql
-- Description: Seeds the 9 official categories and initial starter products.
-- =====================================================================

-- 1. Insert Categories (Idempotent via slug)
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

-- 2. Insert Starter Products for MS Pan Shop (Idempotent check by name)
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

  -- Pan Items
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

  -- Pan Masala
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

  -- Cigarettes
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

  -- Bidi
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = '502 Pataka Bidi') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('502 Pataka Bidi', v_cat_bidi, 25.00, 18.00, 40, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Sambhaji Bidi') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Sambhaji Bidi', v_cat_bidi, 20.00, 15.00, 50, 'packet');
  END IF;

  -- Tobacco
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Miraj Tobacco') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Miraj Tobacco', v_cat_tobacco, 15.00, 11.00, 60, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Baba Black') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Baba Black', v_cat_tobacco, 25.00, 19.00, 40, 'packet');
  END IF;

  -- Tea Glasses
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Special Cutting Chai') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Special Cutting Chai', v_cat_tea, 10.00, 5.00, 200, 'glass');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Full Chai') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Full Chai', v_cat_tea, 15.00, 8.00, 100, 'cup');
  END IF;

  -- Mouth Fresheners
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Pass Pass Mint') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Pass Pass Mint', v_cat_mouth, 5.00, 3.50, 150, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Center Fresh Gum') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Center Fresh Gum', v_cat_mouth, 2.00, 1.20, 300, 'piece');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Orbit Spearmint') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Orbit Spearmint', v_cat_mouth, 10.00, 7.00, 80, 'packet');
  END IF;

  -- Biscuits and Snacks
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Parle-G Biscuit') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Parle-G Biscuit', v_cat_snacks, 10.00, 8.00, 60, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Kurkure Masala Munch') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Kurkure Masala Munch', v_cat_snacks, 20.00, 16.00, 40, 'packet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Lays Magic Masala') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Lays Magic Masala', v_cat_snacks, 20.00, 16.00, 40, 'packet');
  END IF;

  -- Other Products
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Mineral Water 500ml') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Mineral Water 500ml', v_cat_other, 10.00, 6.00, 80, 'bottle');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Match Box') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Match Box', v_cat_other, 2.00, 1.00, 200, 'box');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Lighter Disposable') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Lighter Disposable', v_cat_other, 15.00, 9.00, 50, 'piece');
  END IF;

END $$;
