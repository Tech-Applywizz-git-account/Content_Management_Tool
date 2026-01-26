-- Add columns for Locking Mechanism
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS first_review_opened_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS first_review_opened_by_role VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS writer_id UUID REFERENCES public.users(id);

-- Backfill created_by_user_id from existing created_by
UPDATE public.projects SET created_by_user_id = created_by WHERE created_by_user_id IS NULL;

-- Enable RLS on projects table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 1. READ Policy: Allow authenticated users to read all projects
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.projects;
CREATE POLICY "Enable read access for authenticated users" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');

-- 2. INSERT Policy: Allow authenticated users to insert projects
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.projects;
CREATE POLICY "Enable insert for authenticated users" ON public.projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. UPDATE Policy for Non-Writers (Admin, CMO, CEO, etc.)
DROP POLICY IF EXISTS "Non-writers can update everything" ON public.projects;
CREATE POLICY "Non-writers can update everything" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'CMO', 'CEO'))
);

-- 4. UPDATE Policy for Writers (Restricted)
-- Writers can only update their own projects IF they haven't been opened for review
DROP POLICY IF EXISTS "Writers can update own unlocked projects" ON public.projects;
CREATE POLICY "Writers can update own unlocked projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'WRITER')
  AND (created_by_user_id = auth.uid() OR assigned_to_role = 'WRITER')
  AND first_review_opened_at IS NULL
);

-- 5. UPDATE Policy for CINE users: can update projects assigned to CINE role
DROP POLICY IF EXISTS "Cine users can update cine-assigned projects" ON public.projects;
CREATE POLICY "Cine users can update cine-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CINE')
  AND (assigned_to_role = 'CINE' OR current_stage = 'CINEMATOGRAPHY')
);

-- 6. UPDATE Policy for EDITOR users: can update projects assigned to EDITOR role
DROP POLICY IF EXISTS "Editor users can update editor-assigned projects" ON public.projects;
CREATE POLICY "Editor users can update editor-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'EDITOR')
  AND (assigned_to_role = 'EDITOR' OR current_stage = 'VIDEO_EDITING')
);

-- 7. UPDATE Policy for SUB_EDITOR users: can update projects assigned to SUB_EDITOR role
DROP POLICY IF EXISTS "Sub-editor users can update sub-editor-assigned projects" ON public.projects;
CREATE POLICY "Sub-editor users can update sub-editor-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'SUB_EDITOR')
  AND (assigned_to_role = 'SUB_EDITOR' OR current_stage IN ('SUB_EDITOR_ASSIGNMENT', 'SUB_EDITOR_PROCESSING'))
);

-- 8. UPDATE Policy for DESIGNER users: can update projects assigned to DESIGNER role
DROP POLICY IF EXISTS "Designer users can update designer-assigned projects" ON public.projects;
CREATE POLICY "Designer users can update designer-assigned projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'DESIGNER')
  AND (assigned_to_role = 'DESIGNER' OR current_stage IN ('THUMBNAIL_DESIGN', 'CREATIVE_DESIGN'))
);

-- 5. DELETE Policy for Non-Writers
DROP POLICY IF EXISTS "Non-writers can delete everything" ON public.projects;
CREATE POLICY "Non-writers can delete everything" ON public.projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role != 'WRITER')
);

-- 6. DELETE Policy for Writers (Restricted)
DROP POLICY IF EXISTS "Writers can delete own unlocked projects" ON public.projects;
CREATE POLICY "Writers can delete own unlocked projects" ON public.projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'WRITER')
  AND created_by_user_id = auth.uid()
  AND first_review_opened_at IS NULL
);
