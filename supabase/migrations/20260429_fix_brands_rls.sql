-- Migration: Fix Brands RLS Policies to allow Delete and Update
-- Path: supabase/migrations/20260429_fix_brands_rls.sql

-- Allow authenticated users to delete brands
-- Note: We can refine this to allow only creators or admins later if needed,
-- but for now, we follow the pattern of existing brand policies.
CREATE POLICY "Enable delete for authenticated users on brands" 
ON public.brands FOR DELETE 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to update brands
CREATE POLICY "Enable update for authenticated users on brands" 
ON public.brands FOR UPDATE 
USING (auth.role() = 'authenticated');
