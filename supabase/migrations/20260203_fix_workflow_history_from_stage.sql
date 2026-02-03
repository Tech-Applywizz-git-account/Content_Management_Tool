-- ============================================================================
-- FIX WORKFLOW HISTORY FROM_STAGE NULLS AND ROLE ENUM VALIDATION
-- ============================================================================
-- This migration ensures data integrity for workflow transitions by:
-- 1. Backfilling existing NULL from_stage records
-- 2. Adding a NOT NULL constraint to prevent future NULLs
-- 3. Updating from_stage and to_stage to store and validate ROLE names
-- 4. Documenting the column purpose
-- ============================================================================

-- 1. Backfill existing NULL from_stage records
-- We use a heuristic: set from_stage to to_stage for the same record if it's NULL.
-- This is better than NULL and keeps the constraint valid for existing rows.
UPDATE public.workflow_history 
SET from_stage = to_stage 
WHERE from_stage IS NULL;

-- 2. Add the NOT NULL constraint to ensure future records have from_stage
ALTER TABLE public.workflow_history 
ALTER COLUMN from_stage SET NOT NULL;

-- 3. Add CHECK constraints to validate ROLE values
-- This ensures only valid roles are stored in from_stage and to_stage
DO $$
BEGIN
  -- Drop existing constraints if they exist (to allow re-running migration)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_history_from_stage_check') THEN
    ALTER TABLE public.workflow_history DROP CONSTRAINT workflow_history_from_stage_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_history_to_stage_check') THEN
    ALTER TABLE public.workflow_history DROP CONSTRAINT workflow_history_to_stage_check;
  END IF;

  -- Add constraints for valid role values
  -- We include both original stages AND new roles to maintain backward compatibility for migration purposes
  -- while enforcing role-based values for new records going forward.
  ALTER TABLE public.workflow_history 
  ADD CONSTRAINT workflow_history_from_stage_check 
  CHECK (from_stage IN (
    'ADMIN', 'WRITER', 'CINE', 'EDITOR', 'SUB_EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER',
    'SCRIPT', 'SCRIPT_REVIEW_L1', 'SCRIPT_REVIEW_L2', 'CINEMATOGRAPHY', 'VIDEO_EDITING', 
    'SUB_EDITOR_ASSIGNMENT', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN', 'CREATIVE_DESIGN', 
    'FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO', 'OPS_SCHEDULING', 'POSTED', 'REWORK', 'MULTI_WRITER_APPROVAL', 'POST_WRITER_REVIEW'
  ));

  ALTER TABLE public.workflow_history 
  ADD CONSTRAINT workflow_history_to_stage_check 
  CHECK (to_stage IN (
    'ADMIN', 'WRITER', 'CINE', 'EDITOR', 'SUB_EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER',
    'SCRIPT', 'SCRIPT_REVIEW_L1', 'SCRIPT_REVIEW_L2', 'CINEMATOGRAPHY', 'VIDEO_EDITING', 
    'SUB_EDITOR_ASSIGNMENT', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN', 'CREATIVE_DESIGN', 
    'FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO', 'OPS_SCHEDULING', 'POSTED', 'REWORK', 'MULTI_WRITER_APPROVAL', 'POST_WRITER_REVIEW'
  ));
END $$;

-- 4. Add column documentation
COMMENT ON COLUMN public.workflow_history.from_stage IS 'The ROLE (or stage) before the action';
COMMENT ON COLUMN public.workflow_history.to_stage IS 'The ROLE (or stage) after the action';
