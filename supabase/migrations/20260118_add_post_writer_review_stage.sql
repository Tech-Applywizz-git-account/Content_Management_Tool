-- Add POST_WRITER_REVIEW workflow stage to project current_stage enum
-- This migration adds the new enum value to the existing enum type

-- Add the new value to the enum type (PostgreSQL enum extension)
ALTER TYPE workflow_stage ADD VALUE IF NOT EXISTS 'POST_WRITER_REVIEW';

-- Update the constraint to include the new value
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'projects_current_stage_check'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_current_stage_check;
  END IF;
END $$;

-- Recreate the constraint with the new value included
ALTER TABLE projects 
ADD CONSTRAINT projects_current_stage_check 
CHECK (current_stage = ANY (ARRAY[
  'SCRIPT'::text,
  'SCRIPT_REVIEW_L1'::text,
  'SCRIPT_REVIEW_L2'::text,
  'CINEMATOGRAPHY'::text,
  'VIDEO_EDITING'::text,
  'SUB_EDITOR_ASSIGNMENT'::text,
  'SUB_EDITOR_PROCESSING'::text,
  'THUMBNAIL_DESIGN'::text,
  'CREATIVE_DESIGN'::text,
  'FINAL_REVIEW_CMO'::text,
  'FINAL_REVIEW_CEO'::text,
  'FINAL_REVIEW_CEO_POST_APPROVAL'::text,
  'WRITER_VIDEO_APPROVAL'::text,
  'MULTI_WRITER_APPROVAL'::text,
  'POST_WRITER_REVIEW'::text,
  'OPS_SCHEDULING'::text,
  'POSTED'::text,
  'REWORK'::text
]));