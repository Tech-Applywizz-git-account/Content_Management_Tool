-- Migration to add rework tracking columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS rework_target_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS rework_initiator_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS rework_initiator_stage VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN public.projects.rework_target_role IS 'The role targeted for rework (e.g., WRITER, DESIGNER)';
COMMENT ON COLUMN public.projects.rework_initiator_role IS 'The role that requested the rework';
COMMENT ON COLUMN public.projects.rework_initiator_stage IS 'The stage where the rework was requested';
