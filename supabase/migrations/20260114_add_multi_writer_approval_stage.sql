-- Add MULTI_WRITER_APPROVAL workflow stage to project current_stage enum
-- This migration adds the new enum value to the existing enum type

-- Add the new value to the enum type (PostgreSQL enum extension)
ALTER TYPE workflow_stage ADD VALUE IF NOT EXISTS 'MULTI_WRITER_APPROVAL';

-- Update the constraint to include the new value
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

-- Recreate the constraint with the MULTI_WRITER_APPROVAL stage included
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

-- Verification: This should now allow MULTI_WRITER_APPROVAL stage assignments
-- Test query: UPDATE projects SET current_stage = 'MULTI_WRITER_APPROVAL' WHERE current_stage = 'WRITER_VIDEO_APPROVAL' LIMIT 1;