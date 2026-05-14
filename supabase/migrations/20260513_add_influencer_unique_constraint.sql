-- Migration: Add Unique Constraint to Influencers
-- Path: supabase/migrations/20260513_add_influencer_unique_constraint.sql

-- Add a unique constraint to prevent duplicate influencers for the same brand
-- This enables the use of UPSERT in our import scripts
ALTER TABLE public.influencers 
ADD CONSTRAINT influencers_name_brand_key UNIQUE (influencer_name, brand_name);
