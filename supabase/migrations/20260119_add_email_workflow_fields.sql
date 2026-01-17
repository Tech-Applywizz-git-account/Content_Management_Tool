-- Add email notification specific columns to workflow_history
-- These columns are required for the Edge Function to determine recipients

ALTER TABLE public.workflow_history 
ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS from_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS to_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the columns
COMMENT ON COLUMN public.workflow_history.actor_role IS 'The role of the user who performed the action';
COMMENT ON COLUMN public.workflow_history.from_role IS 'The role the project was assigned to before the action';
COMMENT ON COLUMN public.workflow_history.to_role IS 'The role the project is assigned to after the action';
COMMENT ON COLUMN public.workflow_history.metadata IS 'Dynamic data for notifications (e.g. assigned_to, rework_reason, project_type)';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_workflow_history_project_id ON public.workflow_history(project_id);
