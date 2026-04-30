-- Migration: Add story-specific fields to influencers
-- Path: supabase/migrations/20260430_add_story_fields_to_influencers.sql

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'payment') THEN
        ALTER TABLE public.influencers ADD COLUMN payment TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'platform_type') THEN
        ALTER TABLE public.influencers ADD COLUMN platform_type TEXT;
    END IF;
END $$;
