-- ============================================================================
-- ADD VIDEO LINK HISTORY ARRAYS TO STORE PREVIOUS AND CURRENT VIDEO LINKS
-- ============================================================================

-- Add JSONB arrays to store previous video links for each role
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS cine_video_links_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS editor_video_links_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS sub_editor_video_links_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS designer_video_links_history JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.projects.cine_video_links_history IS 'Array of all video links uploaded by cinematographer, including previous versions for rework scenarios';
COMMENT ON COLUMN public.projects.editor_video_links_history IS 'Array of all edited video links uploaded by editor, including previous versions for rework scenarios';
COMMENT ON COLUMN public.projects.sub_editor_video_links_history IS 'Array of all edited video links uploaded by sub-editor, including previous versions for rework scenarios';
COMMENT ON COLUMN public.projects.designer_video_links_history IS 'Array of all creative/thumbnail links uploaded by designer, including previous versions for rework scenarios';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_cine_video_links_history ON public.projects USING gin(cine_video_links_history);
CREATE INDEX IF NOT EXISTS idx_projects_editor_video_links_history ON public.projects USING gin(editor_video_links_history);
CREATE INDEX IF NOT EXISTS idx_projects_sub_editor_video_links_history ON public.projects USING gin(sub_editor_video_links_history);
CREATE INDEX IF NOT EXISTS idx_projects_designer_video_links_history ON public.projects USING gin(designer_video_links_history);

-- Migration complete