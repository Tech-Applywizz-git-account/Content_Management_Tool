-- Create Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name TEXT UNIQUE NOT NULL,
    campaign_objective TEXT,
    target_audience TEXT,
    deliverables TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read brands
CREATE POLICY "Enable read for authenticated users on brands" 
ON public.brands FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert brands
CREATE POLICY "Enable insert for authenticated users on brands" 
ON public.brands FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
