-- Migration: Create or Update Influencers Table (Refined)
-- Path: supabase/migrations/20260429_create_influencers_table.sql

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.influencers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- 2. Add columns one by one if they don't exist
DO $$ 
BEGIN 
    -- Management Fields (Using existing naming convention)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'influencer_name') THEN
        ALTER TABLE public.influencers ADD COLUMN influencer_name TEXT NOT NULL DEFAULT 'Unknown';
        ALTER TABLE public.influencers ALTER COLUMN influencer_name DROP DEFAULT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'influencer_email') THEN
        ALTER TABLE public.influencers ADD COLUMN influencer_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'instagram_profile') THEN
        ALTER TABLE public.influencers ADD COLUMN instagram_profile TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'contact_details') THEN
        ALTER TABLE public.influencers ADD COLUMN contact_details TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'campaign_type') THEN
        ALTER TABLE public.influencers ADD COLUMN campaign_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'niche') THEN
        ALTER TABLE public.influencers ADD COLUMN niche TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'commercials') THEN
        ALTER TABLE public.influencers ADD COLUMN commercials TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'location') THEN
        ALTER TABLE public.influencers ADD COLUMN location TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'budget') THEN
        ALTER TABLE public.influencers ADD COLUMN budget TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'brand_name') THEN
        ALTER TABLE public.influencers ADD COLUMN brand_name TEXT;
    END IF;

    -- Logging & Project Linking Fields
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'parent_project_id') THEN
        ALTER TABLE public.influencers ADD COLUMN parent_project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'instance_project_id') THEN
        ALTER TABLE public.influencers ADD COLUMN instance_project_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'script_content') THEN
        ALTER TABLE public.influencers ADD COLUMN script_content TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'content_description') THEN
        ALTER TABLE public.influencers ADD COLUMN content_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'sent_by') THEN
        ALTER TABLE public.influencers ADD COLUMN sent_by TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'sent_by_id') THEN
        ALTER TABLE public.influencers ADD COLUMN sent_by_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'status') THEN
        ALTER TABLE public.influencers ADD COLUMN status TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'sent_at') THEN
        ALTER TABLE public.influencers ADD COLUMN sent_at TIMESTAMPTZ;
    END IF;

    -- Metadata
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'created_at') THEN
        ALTER TABLE public.influencers ADD COLUMN created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'created_by_user_id') THEN
        ALTER TABLE public.influencers ADD COLUMN created_by_user_id UUID REFERENCES public.users(id);
    END IF;
    
    -- Cleanup: Remove the generic 'name' and 'email' columns if they were created by mistake
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'name') THEN
        ALTER TABLE public.influencers DROP COLUMN name;
    END IF;
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'email') THEN
        ALTER TABLE public.influencers DROP COLUMN email;
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

-- 4. Re-create Policies
DROP POLICY IF EXISTS "Enable read for authenticated users on influencers" ON public.influencers;
CREATE POLICY "Enable read for authenticated users on influencers" ON public.influencers FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated users on influencers" ON public.influencers;
CREATE POLICY "Enable insert for authenticated users on influencers" ON public.influencers FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated users on influencers" ON public.influencers;
CREATE POLICY "Enable delete for authenticated users on influencers" ON public.influencers FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users on influencers" ON public.influencers;
CREATE POLICY "Enable update for authenticated users on influencers" ON public.influencers FOR UPDATE USING (auth.role() = 'authenticated');

-- 5. Add Indexes
CREATE INDEX IF NOT EXISTS idx_influencers_created_by ON public.influencers(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_influencers_parent_project ON public.influencers(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_influencers_name ON public.influencers(influencer_name);
