-- Migration: Fix PA CMO Review Stage
-- 1. Add PA_VIDEO_CMO_REVIEW to the current_stage CHECK constraint
-- 2. Add RLS UPDATE policy for PARTNER_ASSOCIATE role

-- ============================================================
-- Step 1: Drop existing constraint and recreate with new stage
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'projects_current_stage_check'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_current_stage_check;
  END IF;
END $$;

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
  'PA_FINAL_REVIEW'::text,
  'PA_VIDEO_CMO_REVIEW'::text
]));

-- ============================================================
-- Step 2: Add RLS UPDATE policy for PARTNER_ASSOCIATE role
-- Allows PA to update influencer instance projects they own
-- ============================================================
DROP POLICY IF EXISTS "PA users can update their influencer projects" ON public.projects;
CREATE POLICY "PA users can update their influencer projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PARTNER_ASSOCIATE')
  AND (
    assigned_to_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR assigned_to_role = 'PARTNER_ASSOCIATE'
  )
);

-- Also allow PA to update projects in SENT_TO_INFLUENCER stage (for video submission)
DROP POLICY IF EXISTS "PA users can update sent-to-influencer projects" ON public.projects;
CREATE POLICY "PA users can update sent-to-influencer projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PARTNER_ASSOCIATE')
  AND current_stage IN ('SENT_TO_INFLUENCER', 'PARTNER_REVIEW', 'PA_FINAL_REVIEW', 'PA_VIDEO_CMO_REVIEW')
);
