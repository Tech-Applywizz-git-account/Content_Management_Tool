-- Add SUB_EDITOR related workflow stages to project current_stage constraint
-- This migration updates the existing CHECK constraint to include SUB_EDITOR workflow stages

-- First, check if the constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_current_stage_check' 
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_current_stage_check;
  END IF;
END $$;

-- Recreate the constraint with the SUB_EDITOR workflow stages included
ALTER TABLE projects 
ADD CONSTRAINT projects_current_stage_check 
CHECK (current_stage IN (
  'SCRIPT',
  'SCRIPT_REVIEW_L1',
  'SCRIPT_REVIEW_L2',
  'CINEMATOGRAPHY',
  'VIDEO_EDITING',
  'SUB_EDITOR_ASSIGNMENT',
  'SUB_EDITOR_PROCESSING',
  'THUMBNAIL_DESIGN',
  'CREATIVE_DESIGN',
  'FINAL_REVIEW_CMO',
  'FINAL_REVIEW_CEO',
  'WRITER_VIDEO_APPROVAL',
  'MULTI_WRITER_APPROVAL',
  'OPS_SCHEDULING',
  'POSTED'
));

-- Verification: This should now allow SUB_EDITOR workflow stages
-- Test query: INSERT INTO projects (title, channel, content_type, current_stage, assigned_to_role, due_date) 
-- VALUES ('Test', 'YOUTUBE', 'VIDEO', 'SUB_EDITOR_PROCESSING', 'SUB_EDITOR', CURRENT_DATE);