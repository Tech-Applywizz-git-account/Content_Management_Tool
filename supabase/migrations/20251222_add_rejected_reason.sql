-- ============================================================================
-- ADD REJECTED_REASON FIELD TO PROJECTS TABLE
-- ============================================================================
-- This migration adds a rejected_reason field to store rejection reasons separately

-- Add rejected_reason column to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Add index for performance on rejected_reason column
CREATE INDEX IF NOT EXISTS idx_projects_rejected_reason ON public.projects(rejected_reason);

COMMENT ON COLUMN public.projects.rejected_reason IS 'Stores the reason why a project was rejected - used for displaying rejection information across dashboards';