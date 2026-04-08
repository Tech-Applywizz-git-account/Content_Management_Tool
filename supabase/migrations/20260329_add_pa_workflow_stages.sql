-- Add new PA workflow stages to project current_stage check constraint

-- Update the constraint to include the new values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'projects_current_stage_check'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_current_stage_check;
  END IF;
END $$;

-- Recreate the constraint with all current and new values included
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
  'REWORK'::text,
  'WRITER_REVISION'::text,
  'PARTNER_REVIEW'::text,
  'SENT_TO_INFLUENCER'::text,
  'PA_FINAL_REVIEW'::text
]));
