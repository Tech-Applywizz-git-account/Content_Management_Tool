-- Add SUB_EDITOR role to project assigned_to_role constraint
-- This migration updates the existing CHECK constraint to include SUB_EDITOR role

-- First, check if the constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_assigned_to_role_check' 
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_assigned_to_role_check;
  END IF;
END $$;

-- Recreate the constraint with the SUB_EDITOR role included
ALTER TABLE projects 
ADD CONSTRAINT projects_assigned_to_role_check 
CHECK (assigned_to_role IN (
  'ADMIN', 'WRITER', 'CINE', 'EDITOR', 'SUB_EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'
));

-- Verification: This should now allow SUB_EDITOR role assignments
-- Test query: INSERT INTO projects (title, channel, content_type, current_stage, assigned_to_role, due_date) 
-- VALUES ('Test', 'YOUTUBE', 'VIDEO', 'SCRIPT', 'SUB_EDITOR', CURRENT_DATE);