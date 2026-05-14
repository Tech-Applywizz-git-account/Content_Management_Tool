-- Migration: Create Influencer Links Table
-- Path: supabase/migrations/20260513_create_influencer_links_table.sql

CREATE TABLE IF NOT EXISTS public.influencer_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    influencer_id UUID REFERENCES public.influencers(id) ON DELETE CASCADE,
    link TEXT NOT NULL,
    brand_name TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_by_user_id UUID REFERENCES public.users(id),
    UNIQUE(influencer_id, link)
);

-- Enable RLS
ALTER TABLE public.influencer_links ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read for authenticated users on influencer_links" ON public.influencer_links;
CREATE POLICY "Enable read for authenticated users on influencer_links" ON public.influencer_links FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated users on influencer_links" ON public.influencer_links;
CREATE POLICY "Enable insert for authenticated users on influencer_links" ON public.influencer_links FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated users on influencer_links" ON public.influencer_links;
CREATE POLICY "Enable delete for authenticated users on influencer_links" ON public.influencer_links FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users on influencer_links" ON public.influencer_links;
CREATE POLICY "Enable update for authenticated users on influencer_links" ON public.influencer_links FOR UPDATE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_influencer_links_influencer_id ON public.influencer_links(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_links_brand_name ON public.influencer_links(brand_name);
