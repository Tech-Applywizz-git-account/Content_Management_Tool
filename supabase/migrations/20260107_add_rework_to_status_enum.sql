-- ============================================================================
-- ADD REWORK STATUS TO PROJECTS ENUM
-- ============================================================================
-- This migration adds the REWORK status to the projects status enum

-- Update the check constraint to include REWORK status
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_task_status_check;

ALTER TABLE public.projects 
ADD CONSTRAINT projects_task_status_check 
CHECK (task_status IN ('TODO', 'IN_PROGRESS', 'WAITING_APPROVAL', 'REJECTED', 'REWORK', 'DONE'));
