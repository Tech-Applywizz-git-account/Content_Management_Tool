-- Migration: Create influencer_stories table for detailed story tracking
-- Path: supabase/migrations/20260430_create_influencer_stories_table.sql

CREATE TABLE IF NOT EXISTS public.influencer_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
    story_date DATE DEFAULT CURRENT_DATE,
    story_link TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_by_user_id UUID REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.influencer_stories ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable all access for authenticated users on influencer_stories" ON public.influencer_stories;
CREATE POLICY "Enable all access for authenticated users on influencer_stories" ON public.influencer_stories
    FOR ALL USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_influencer_stories_influencer_id ON public.influencer_stories(influencer_id);
