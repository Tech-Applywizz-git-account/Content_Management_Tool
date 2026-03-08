-- Add JOBBOARD and LEAD_MAGNET to projects content_type constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_content_type_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_content_type_check CHECK (content_type IN (
    'VIDEO', 'CREATIVE_ONLY', 'JOBBOARD', 'LEAD_MAGNET'
));

-- Add necessary stages to projects current_stage constraint
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
    'FINAL_REVIEW_CEO_POST_APPROVAL',
    'WRITER_VIDEO_APPROVAL',
    'MULTI_WRITER_APPROVAL',
    'POST_WRITER_REVIEW',
    'OPS_SCHEDULING',
    'POSTED',
    'REWORK',
    'WRITER_REVISION'
));
