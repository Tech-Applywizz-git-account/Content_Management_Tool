-- Add RLS policies to allow role-based project updates
-- This allows users to update projects when they are assigned to the project's role or stage

-- Policy for CINE users: can update projects assigned to CINE role
DROP POLICY IF EXISTS "Cine users can update cine-assigned projects" ON public.projects;
CREATE POLICY "Cine users can update cine-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CINE')
  AND assigned_to_role = 'CINE'
);

-- Policy for EDITOR users: can update projects assigned to EDITOR role
DROP POLICY IF EXISTS "Editor users can update editor-assigned projects" ON public.projects;
CREATE POLICY "Editor users can update editor-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'EDITOR')
  AND assigned_to_role = 'EDITOR'
);

-- Policy for SUB_EDITOR users: can update projects assigned to SUB_EDITOR role
DROP POLICY IF EXISTS "Sub-editor users can update sub-editor-assigned projects" ON public.projects;
CREATE POLICY "Sub-editor users can update sub-editor-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'SUB_EDITOR')
  AND (assigned_to_role = 'SUB_EDITOR' OR current_stage IN ('SUB_EDITOR_ASSIGNMENT', 'SUB_EDITOR_PROCESSING'))
);

-- Policy for DESIGNER users: can update projects assigned to DESIGNER role
DROP POLICY IF EXISTS "Designer users can update designer-assigned projects" ON public.projects;
CREATE POLICY "Designer users can update designer-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'DESIGNER')
  AND assigned_to_role = 'DESIGNER'
);

-- Policy for users in visible_to_roles: can update projects they have visibility to
DROP POLICY IF EXISTS "Users in visible_to_roles can update projects" ON public.projects;
CREATE POLICY "Users in visible_to_roles can update projects" ON public.projects FOR UPDATE USING (
  auth.uid() = ANY(
    (SELECT ARRAY_AGG(u.id) 
     FROM public.users u 
     WHERE u.role = ANY(visible_to_roles)
     AND u.status = 'ACTIVE')
  )
);

-- Alternative policy for stage-based access: users can update projects in their stage
-- For CINE in CINEMATOGRAPHY stage
DROP POLICY IF EXISTS "Cine users can update cinematography stage projects" ON public.projects;
CREATE POLICY "Cine users can update cinematography stage projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CINE')
  AND current_stage = 'CINEMATOGRAPHY'
);

-- For EDITOR in VIDEO_EDITING stage
DROP POLICY IF EXISTS "Editor users can update video editing stage projects" ON public.projects;
CREATE POLICY "Editor users can update video editing stage projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'EDITOR')
  AND current_stage = 'VIDEO_EDITING'
);

-- For DESIGNER in THUMBNAIL_DESIGN or CREATIVE_DESIGN stages
DROP POLICY IF EXISTS "Designer users can update design stage projects" ON public.projects;
CREATE POLICY "Designer users can update design stage projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'DESIGNER')
  AND (current_stage = 'THUMBNAIL_DESIGN' OR current_stage = 'CREATIVE_DESIGN')
);

-- For SUB_EDITOR in SUB_EDITOR_ASSIGNMENT or SUB_EDITOR_PROCESSING stages
DROP POLICY IF EXISTS "Sub-editor users can update sub-editor stage projects" ON public.projects;
CREATE POLICY "Sub-editor users can update sub-editor stage projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'SUB_EDITOR')
  AND (current_stage = 'SUB_EDITOR_ASSIGNMENT' OR current_stage = 'SUB_EDITOR_PROCESSING')
);

-- Update the existing writer policy to be more specific
DROP POLICY IF EXISTS "Writers can update own unlocked projects" ON public.projects;
CREATE POLICY "Writers can update own unlocked projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'WRITER')
  AND (created_by_user_id = auth.uid() OR assigned_to_role = 'WRITER')
  AND first_review_opened_at IS NULL
);

-- Update the existing non-writer policy to be more explicit
DROP POLICY IF EXISTS "Non-writers can update everything" ON public.projects;
CREATE POLICY "Non-writers can update everything" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'CMO', 'CEO'))
);