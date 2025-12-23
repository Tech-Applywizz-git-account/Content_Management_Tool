-- ============================================================================
-- ADD SCRIPT VERSIONING TO WORKFLOW HISTORY
-- ============================================================================
-- This migration adds script content storage to workflow history for rework scenarios

-- Add script_content column to workflow_history table
ALTER TABLE public.workflow_history
ADD COLUMN IF NOT EXISTS script_content TEXT;

-- Add index for performance on script_content column
CREATE INDEX IF NOT EXISTS idx_workflow_history_script_content ON public.workflow_history(script_content);

COMMENT ON COLUMN public.workflow_history.script_content IS 'Script content at time of workflow action - used for rework comparison';