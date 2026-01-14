-- ============================================================================
-- COMPREHENSIVE TIMESTAMP MIGRATION FOR ROLE-BASED INTERACTIONS
-- ============================================================================
-- This migration ensures all necessary timestamp columns exist on the projects table

-- Add role-based timestamp columns to the projects table if they don't exist
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

-- Ensure the workflow_history action enum includes all necessary values
-- Note: If the enum type doesn't exist yet, we'll need to create it first
-- First, let's ensure the enum type exists
DO $$
BEGIN
    -- Check if the enum type exists, create it if not
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'history_action') THEN
        CREATE TYPE history_action AS ENUM (
            'approve', 'reject', 'submit', 'REJECTED', 'APPROVED', 'REWORK', 
            'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED', 'CREATED', 'PUBLISHED', 'SUBMITTED'
        );
    ELSE
        -- Add new values to the existing enum if they don't exist
        BEGIN
            ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'CREATED';
            ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'PUBLISHED';
            ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'SUBMITTED';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END$$;

-- Now update the workflow_history table to use the enum type if it doesn't already
-- First drop the old constraint if it exists
ALTER TABLE workflow_history DROP CONSTRAINT IF EXISTS workflow_history_action_check;

-- Add the new constraint using the enum type
ALTER TABLE workflow_history ADD CONSTRAINT workflow_history_action_check 
CHECK (action IN ('approve', 'reject', 'submit', 'REJECTED', 'APPROVED', 'REWORK', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED', 'CREATED', 'PUBLISHED', 'SUBMITTED'));

-- Update the projects table to use proper column names and types if needed
-- Rename old columns if they exist with different names
-- (No renaming needed since we're adding new columns)

-- Add indexes for performance on the new timestamp columns
CREATE INDEX IF NOT EXISTS idx_projects_writer_submitted_at ON projects(writer_submitted_at);
CREATE INDEX IF NOT EXISTS idx_projects_cmo_approved_at ON projects(cmo_approved_at);
CREATE INDEX IF NOT EXISTS idx_projects_cmo_rework_at ON projects(cmo_rework_at);
CREATE INDEX IF NOT EXISTS idx_projects_ceo_approved_at ON projects(ceo_approved_at);
CREATE INDEX IF NOT EXISTS idx_projects_ceo_rework_at ON projects(ceo_rework_at);
CREATE INDEX IF NOT EXISTS idx_projects_cine_uploaded_at ON projects(cine_uploaded_at);
CREATE INDEX IF NOT EXISTS idx_projects_editor_uploaded_at ON projects(editor_uploaded_at);
CREATE INDEX IF NOT EXISTS idx_projects_designer_uploaded_at ON projects(designer_uploaded_at);

-- Verify the migration worked by showing the new columns
-- \d projects; -- Uncomment if running in psql

-- Migration complete