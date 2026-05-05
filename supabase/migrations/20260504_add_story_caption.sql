-- Migration: Add story_caption to influencer_stories
-- Path: supabase/migrations/20260504_add_story_caption.sql

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencer_stories' AND COLUMN_NAME = 'story_caption') THEN
        ALTER TABLE public.influencer_stories ADD COLUMN story_caption TEXT;
    END IF;
END $$;
