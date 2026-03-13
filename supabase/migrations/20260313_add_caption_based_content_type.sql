-- Migration to add CAPTION_BASED content type
-- This allows projects to be created with the 'CAPTION_BASED' content type

-- Add CAPTION_BASED to the enum type if it exists
-- NOTE: If this fails in a transaction, run the ALTER TYPE command separately first.
ALTER TYPE content_type_enum ADD VALUE IF NOT EXISTS 'CAPTION_BASED';

-- Add CAPTION_BASED to projects content_type constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_content_type_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_content_type_check CHECK (content_type::text IN (
    'VIDEO', 'CREATIVE_ONLY', 'JOBBOARD', 'LEAD_MAGNET', 'CAPTION_BASED'
));

-- Ensure MULTI_WRITER_APPROVAL and POST_WRITER_REVIEW are in the current_stage check
-- (These should already be there from previous migrations, but good to ensure)
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_current_stage_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_current_stage_check CHECK (current_stage IN (
    'SCRIPT',
    'SCRIPT_REVIEW_L1',
    'SCRIPT_REVIEW_L2',
    'CINEMATOGRAPHY',
    'VIDEO_EDITING',
    'SUB_EDITOR_ASSIGNMENT',
    'SUB_EDITOR_PROCESSING',
    'THUMBNAIL_DESIGN',
    'CREATIVE_DESIGN',
    'FINAL_REVIEW_CMO',
    'FINAL_REVIEW_CEO',
    'WRITER_VIDEO_APPROVAL',
    'MULTI_WRITER_APPROVAL',
    'POST_WRITER_REVIEW',
    'OPS_SCHEDULING',
    'POSTED',
    'REWORK',
    'WRITER_REVISION'
));
