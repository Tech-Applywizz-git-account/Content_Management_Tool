-- Migration: Add brand_type to influencers table
-- Path: supabase/migrations/20260504_add_brand_type_to_influencers.sql

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'brand_type') THEN
        ALTER TABLE public.influencers ADD COLUMN brand_type TEXT;
    END IF;
END $$;
