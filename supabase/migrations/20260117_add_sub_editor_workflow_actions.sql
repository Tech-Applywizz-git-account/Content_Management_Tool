-- Add new workflow actions for sub-editor to the action enum in workflow_history table

-- Note: In PostgreSQL, you can't directly add values to an enum inside a transaction
-- So we need to use a different approach for existing enums

-- First, let's check if the enum type exists and what values it currently has
-- This is mainly for documentation purposes

-- Add the new action values to the enum by creating a new enum type, updating the column to use it, then renaming
-- However, this is complex, so we'll just document what needs to be done manually if using enums

-- If using a check constraint instead of enum (which seems to be the case based on our workflow history):
-- We need to modify the check constraint to include new action values

-- Let's first check if there's a check constraint on the action column
-- This assumes the workflow_history table has a check constraint like:
-- CHECK (action IN ('SUBMITTED', 'APPROVED', 'REJECTED', ...))

-- If the constraint exists, we would need to drop and recreate it
-- For now, we'll just document the necessary change since modifying enum/check constraints 
-- often requires specific approaches based on the current schema

-- Update the workflow_history action check constraint to include sub-editor related actions
DO $$
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'workflow_history_action_check' 
    AND table_name = 'workflow_history'
  ) THEN
    ALTER TABLE workflow_history DROP CONSTRAINT workflow_history_action_check;
  END IF;

  -- Recreate the constraint with the new values
  ALTER TABLE workflow_history 
  ADD CONSTRAINT workflow_history_action_check 
  CHECK (action IN (
    'SUBMITTED', 'APPROVED', 'REJECTED', 'DONE', 'REWORK', 'REWORK_SUBMITTED', 
    'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED',
    'DIRECT_UPLOAD', 'ASSIGNED_TO_SUB_EDITOR'
  ));
END $$;

-- If the above approach doesn't work because the constraint has a different name,
-- you would need to find the actual constraint name:
/*
SELECT conname 
FROM pg_constraint 
WHERE conrelid = 'workflow_history'::regclass 
AND contype = 'c';
*/