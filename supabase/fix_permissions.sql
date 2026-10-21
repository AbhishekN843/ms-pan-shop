-- =====================================================================
-- MS PAN SHOP — FIX PERMISSIONS SCRIPT
-- Paste and Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wlavkmkycgasnrzvvukr/sql/new
-- =====================================================================

-- 1. Grant USAGE on public schema to standard Supabase roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Grant table permissions to anon and authenticated (RLS policies govern row access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. Grant sequence permissions for bill numbers
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Grant execute permissions on functions and stored procedures
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 5. Ensure future tables also inherit these permissions automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- 6. Ensure RLS policies are permissive for authenticated shop users
DROP POLICY IF EXISTS "Allow anon and authenticated to read categories" ON public.categories;
CREATE POLICY "Allow anon and authenticated to read categories"
  ON public.categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon and authenticated to read products" ON public.products;
CREATE POLICY "Allow anon and authenticated to read products"
  ON public.products FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon and authenticated to read shop_settings" ON public.shop_settings;
CREATE POLICY "Allow anon and authenticated to read shop_settings"
  ON public.shop_settings FOR SELECT
  USING (true);

-- 7. Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
