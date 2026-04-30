-- Migration: Add detailed tracking timestamps for PA workflow
-- Path: supabase/migrations/20260430_add_workflow_timestamps.sql

-- Add detailed tracking timestamps to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS pa_script_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pa_raw_footage_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pa_cmo_video_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pa_editor_video_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pa_final_approval_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pa_rejection_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pa_posting_proof_added_at TIMESTAMPTZ;

-- Add tracking timestamps to influencers table
ALTER TABLE public.influencers
ADD COLUMN IF NOT EXISTS last_story_added_at TIMESTAMPTZ;
