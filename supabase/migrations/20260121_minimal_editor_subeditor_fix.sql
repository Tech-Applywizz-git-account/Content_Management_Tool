-- ============================================================================
-- MINIMAL DATABASE FIXES FOR EDITOR/SUB-EDITOR WORKFLOW
-- ============================================================================
-- This is a simplified version focusing on the essential database changes
-- Run this if you want just the core fixes without the full notification system

-- Add missing columns for tracking
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS last_video_uploaded_by TEXT CHECK (last_video_uploaded_by IN ('EDITOR', 'SUB_EDITOR')),
ADD COLUMN IF NOT EXISTS last_video_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add comments for clarity
COMMENT ON COLUMN public.projects.last_video_uploaded_by IS 'Tracks who last uploaded the video for intelligent rework routing';
COMMENT ON COLUMN public.projects.last_video_uploaded_at IS 'Timestamp of last video upload';

-- Ensure all timestamp columns exist
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS editor_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sub_editor_assigned_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing data based on current timestamps
UPDATE public.projects 
SET last_video_uploaded_by = CASE 
    WHEN sub_editor_uploaded_at IS NOT NULL AND 
         (editor_uploaded_at IS NULL OR sub_editor_uploaded_at >= editor_uploaded_at) 
    THEN 'SUB_EDITOR'
    WHEN editor_uploaded_at IS NOT NULL 
    THEN 'EDITOR'
    ELSE NULL
END,
last_video_uploaded_at = GREATEST(sub_editor_uploaded_at, editor_uploaded_at)
WHERE last_video_uploaded_by IS NULL;

-- Verify the changes
/*
SELECT 
    id,
    title,
    last_video_uploaded_by,
    last_video_uploaded_at,
    editor_uploaded_at,
    sub_editor_uploaded_at,
    assigned_to_role
FROM projects 
WHERE last_video_uploaded_by IS NOT NULL
ORDER BY last_video_uploaded_at DESC
LIMIT 10;
*/

-- Essential columns added - ready for workflow fixes