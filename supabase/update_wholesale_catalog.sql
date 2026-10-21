-- =====================================================================
-- MS PAN SHOP — WHOLESALE CATALOG UPDATE
-- Converts catalog to wholesale pack-wise inventory:
-- Cigarettes, Bidi, Pan Masala, Tobacco, Paper Tea Cups & Mouth Fresheners
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wlavkmkycgasnrzvvukr/sql/new
-- =====================================================================

-- 1. Rename "Tea Glasses" to "Paper Tea Cups"
UPDATE public.categories
SET
  name = 'Paper Tea Cups',
  slug = 'paper-cups',
  is_active = true,
  updated_at = now()
WHERE slug IN ('tea-glasses', 'paper-cups') OR name ILIKE '%tea glass%';

-- 2. Deactivate "Biscuits and Snacks" category (not sold in wholesale tobacco shop)
UPDATE public.categories
SET
  is_active = false,
  updated_at = now()
WHERE slug = 'biscuits-snacks' OR name ILIKE '%biscuit%';

-- 3. Deactivate retail Chai & Snack items (preserve old sales history)
UPDATE public.products
SET
  is_active = false,
  updated_at = now()
WHERE name IN (
  'Special Cutting Chai',
  'Full Chai',
  'Parle-G Biscuit',
  'Kurkure Masala Munch',
  'Lays Magic Masala'
);

-- 4. Update Shop Settings Tagline for Wholesale
UPDATE public.shop_settings
SET
  tagline = 'Wholesale Tobacco, Cigarettes, Pan Masala & Paper Cups',
  footer_message = 'Thank you for your business! Visit again for wholesale rates.',
  updated_at = now()
WHERE id = 1;

-- 5. Insert Wholesale Pack-Wise Products
DO $$
DECLARE
  v_cat_cups UUID;
  v_cat_cig UUID;
  v_cat_bidi UUID;
  v_cat_pan_masala UUID;
  v_cat_tobacco UUID;
  v_cat_mouth UUID;
  v_cat_other UUID;
BEGIN
  SELECT id INTO v_cat_cups FROM public.categories WHERE slug = 'paper-cups' OR name ILIKE '%Paper%';
  SELECT id INTO v_cat_cig FROM public.categories WHERE slug = 'cigarette';
  SELECT id INTO v_cat_bidi FROM public.categories WHERE slug = 'bidi';
  SELECT id INTO v_cat_pan_masala FROM public.categories WHERE slug = 'pan-masala';
  SELECT id INTO v_cat_tobacco FROM public.categories WHERE slug = 'tobacco';
  SELECT id INTO v_cat_mouth FROM public.categories WHERE slug = 'mouth-fresheners';
  SELECT id INTO v_cat_other FROM public.categories WHERE slug = 'other-products';

  -- Paper Cups (Wholesale Sleeves & Cartons)
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = '65ml Paper Cups (Sleeve of 100 pcs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('65ml Paper Cups (Sleeve of 100 pcs)', v_cat_cups, 45.00, 35.00, 100, 'sleeve (100 pcs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = '80ml Paper Cups (Sleeve of 100 pcs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('80ml Paper Cups (Sleeve of 100 pcs)', v_cat_cups, 55.00, 42.00, 80, 'sleeve (100 pcs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = '65ml Paper Cups (Carton of 1000 pcs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('65ml Paper Cups (Carton of 1000 pcs)', v_cat_cups, 420.00, 340.00, 25, 'carton (1000 pcs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = '100ml Heavy Paper Cups (Pack of 100 pcs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('100ml Heavy Paper Cups (Pack of 100 pcs)', v_cat_cups, 65.00, 50.00, 60, 'pack');
  END IF;

  -- Cigarettes (Pack & Carton Wholesale)
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Classic Regular (Carton of 10 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Classic Regular (Carton of 10 Packs)', v_cat_cig, 3300.00, 3100.00, 15, 'carton (10 packs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Classic Milds (Pack of 20)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Classic Milds (Pack of 20)', v_cat_cig, 340.00, 320.00, 40, 'pack');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Gold Flake Small (Carton of 10 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Gold Flake Small (Carton of 10 Packs)', v_cat_cig, 950.00, 890.00, 30, 'carton (10 packs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Gold Flake Kings (Carton of 10 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Gold Flake Kings (Carton of 10 Packs)', v_cat_cig, 3200.00, 3000.00, 20, 'carton (10 packs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Wills Navy Cut (Carton of 10 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Wills Navy Cut (Carton of 10 Packs)', v_cat_cig, 1550.00, 1420.00, 25, 'carton (10 packs)');
  END IF;

  -- Bidi (Wholesale Bundles / Katta)
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = '502 Pataka Bidi (Bundle of 25 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('502 Pataka Bidi (Bundle of 25 Packs)', v_cat_bidi, 580.00, 520.00, 30, 'bundle (25 packs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Sambhaji Bidi (Bundle of 20 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Sambhaji Bidi (Bundle of 20 Packs)', v_cat_bidi, 380.00, 340.00, 35, 'bundle (20 packs)');
  END IF;

  -- Pan Masala (Wholesale Boxes & Ladis)
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Vimal Pan Masala (Box of 30 Pouches)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Vimal Pan Masala (Box of 30 Pouches)', v_cat_pan_masala, 270.00, 240.00, 50, 'box (30 pouches)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Kamla Pasand (Box of 30 Pouches)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Kamla Pasand (Box of 30 Pouches)', v_cat_pan_masala, 410.00, 370.00, 45, 'box (30 pouches)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'RMD Pan Masala (Box of 30 Pouches)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('RMD Pan Masala (Box of 30 Pouches)', v_cat_pan_masala, 540.00, 480.00, 40, 'box (30 pouches)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Rajnigandha (Tin Pack / Box)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Rajnigandha (Tin Pack / Box)', v_cat_pan_masala, 950.00, 870.00, 20, 'box');
  END IF;

  -- Tobacco (Wholesale Boxes & Tins)
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Miraj Tobacco (Box of 20 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Miraj Tobacco (Box of 20 Packs)', v_cat_tobacco, 260.00, 220.00, 40, 'box (20 packs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Baba Black Tobacco (Pack of 10 Tins)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Baba Black Tobacco (Pack of 10 Tins)', v_cat_tobacco, 240.00, 200.00, 30, 'pack (10 tins)');
  END IF;

  -- Mouth Fresheners (Display Boxes & Jars)
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Pass Pass Mint (Display Box of 30 Packs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Pass Pass Mint (Display Box of 30 Packs)', v_cat_mouth, 135.00, 110.00, 35, 'box (30 packs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Center Fresh Gum (Jar of 200 pcs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Center Fresh Gum (Jar of 200 pcs)', v_cat_mouth, 175.00, 145.00, 25, 'jar (200 pcs)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Orbit Spearmint (Pack of 15 pcs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Orbit Spearmint (Pack of 15 pcs)', v_cat_mouth, 130.00, 105.00, 30, 'pack');
  END IF;

  -- Accessories (Wholesale Bundles)
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Match Box (Bundle of 10 Packs / 100 Boxes)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Match Box (Bundle of 10 Packs / 100 Boxes)', v_cat_other, 180.00, 140.00, 20, 'bundle');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Disposable Gas Lighter (Card/Box of 50 pcs)') THEN
    INSERT INTO public.products (name, category_id, selling_price, purchase_price, stock_quantity, unit)
    VALUES ('Disposable Gas Lighter (Card/Box of 50 pcs)', v_cat_other, 650.00, 520.00, 15, 'box (50 pcs)');
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';
