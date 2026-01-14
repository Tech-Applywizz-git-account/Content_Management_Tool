-- Add role-based timestamp columns to the projects table

ALTER TABLE projects ADD COLUMN IF NOT EXISTS writer_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cmo_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cmo_rework_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ceo_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ceo_rework_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cine_uploaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS editor_uploaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_editor_uploaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS designer_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add comments to document the purpose of each column
COMMENT ON COLUMN projects.writer_submitted_at IS 'Timestamp when writer submits the project';
COMMENT ON COLUMN projects.cmo_approved_at IS 'Timestamp when CMO approves the project';
COMMENT ON COLUMN projects.cmo_rework_at IS 'Timestamp when CMO requests rework';
COMMENT ON COLUMN projects.ceo_approved_at IS 'Timestamp when CEO approves the project';
COMMENT ON COLUMN projects.ceo_rework_at IS 'Timestamp when CEO requests rework';
COMMENT ON COLUMN projects.cine_uploaded_at IS 'Timestamp when Cinematographer uploads video';
COMMENT ON COLUMN projects.editor_uploaded_at IS 'Timestamp when Editor uploads edited video';
COMMENT ON COLUMN projects.sub_editor_uploaded_at IS 'Timestamp when Sub-Editor uploads video';
COMMENT ON COLUMN projects.designer_uploaded_at IS 'Timestamp when Designer uploads assets';

-- Update RLS policies to allow access to these columns
-- We don't need to add specific policies since they're part of the projects table which already has RLS