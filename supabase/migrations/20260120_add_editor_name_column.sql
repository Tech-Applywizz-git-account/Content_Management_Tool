-- Add editor_name column to the projects table

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS editor_name TEXT;

-- Add comment to document the purpose of the column
COMMENT ON COLUMN public.projects.editor_name IS 'Name of the editor who last edited the video content';

-- Similarly, add designer_name and sub_editor_name columns if they don't exist
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS designer_name TEXT;

COMMENT ON COLUMN public.projects.designer_name IS 'Name of the designer who created the thumbnail/creative assets';

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS sub_editor_name TEXT;

COMMENT ON COLUMN public.projects.sub_editor_name IS 'Name of the sub-editor who worked on the video content';