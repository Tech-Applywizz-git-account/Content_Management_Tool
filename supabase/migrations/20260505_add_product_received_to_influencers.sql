-- Migration: Add product_received column to influencers table
-- Path: supabase/migrations/20260505_add_product_received_to_influencers.sql

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'product_received') THEN
        ALTER TABLE public.influencers ADD COLUMN product_received TEXT DEFAULT 'no';
    END IF;
END $$;
