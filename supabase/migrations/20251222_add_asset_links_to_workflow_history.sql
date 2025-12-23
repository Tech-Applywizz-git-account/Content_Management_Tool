-- ============================================================================
-- ADD ASSET LINKS TO WORKFLOW HISTORY
-- ============================================================================
-- This migration adds asset link storage to workflow history for rework scenarios

-- Add asset link columns to workflow_history table
ALTER TABLE public.workflow_history
ADD COLUMN IF NOT EXISTS video_link TEXT,
ADD COLUMN IF NOT EXISTS edited_video_link TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_link TEXT,
ADD COLUMN IF NOT EXISTS creative_link TEXT;

-- Add indexes for performance on asset link columns
CREATE INDEX IF NOT EXISTS idx_workflow_history_video_link ON public.workflow_history(video_link);
CREATE INDEX IF NOT EXISTS idx_workflow_history_edited_video_link ON public.workflow_history(edited_video_link);
CREATE INDEX IF NOT EXISTS idx_workflow_history_thumbnail_link ON public.workflow_history(thumbnail_link);
CREATE INDEX IF NOT EXISTS idx_workflow_history_creative_link ON public.workflow_history(creative_link);

COMMENT ON COLUMN public.workflow_history.video_link IS 'Raw video link at time of workflow action - used for rework comparison';
COMMENT ON COLUMN public.workflow_history.edited_video_link IS 'Edited video link at time of workflow action - used for rework comparison';
COMMENT ON COLUMN public.workflow_history.thumbnail_link IS 'Thumbnail link at time of workflow action - used for rework comparison';
COMMENT ON COLUMN public.workflow_history.creative_link IS 'Creative link at time of workflow action - used for rework comparison';