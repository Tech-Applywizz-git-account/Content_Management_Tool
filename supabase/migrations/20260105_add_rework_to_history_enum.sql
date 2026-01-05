-- ============================================================================
-- ADD REWORK ACTION TO WORKFLOW HISTORY ENUM
-- ============================================================================
-- This migration adds the REWORK action to the workflow_history action enum

-- Update the check constraint to include REWORK action
ALTER TABLE public.workflow_history 
DROP CONSTRAINT IF EXISTS workflow_history_action_check;

ALTER TABLE public.workflow_history 
ADD CONSTRAINT workflow_history_action_check 
CHECK (action IN ('approve', 'reject', 'submit', 'REJECTED', 'APPROVED', 'REWORK', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED'));