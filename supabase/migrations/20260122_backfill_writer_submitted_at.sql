-- Backfill writer_submitted_at for projects that have writer approval history
-- This ensures that projects with multi-writer approval history have proper timestamp tracking

-- Update projects that have a SCRIPT stage SUBMITTED action but no writer_submitted_at
UPDATE public.projects 
SET writer_submitted_at = (
    SELECT MIN(timestamp) 
    FROM public.workflow_history 
    WHERE workflow_history.project_id = projects.id 
    AND workflow_history.stage = 'SCRIPT'
    AND workflow_history.action = 'SUBMITTED'
)
WHERE writer_submitted_at IS NULL
AND id IN (
    SELECT DISTINCT project_id 
    FROM public.workflow_history 
    WHERE stage = 'SCRIPT' 
    AND action = 'SUBMITTED'
);

-- Also update projects that have MULTI_WRITER_APPROVAL history but no writer_submitted_at
-- Since these projects were submitted by writers originally
UPDATE public.projects 
SET writer_submitted_at = (
    SELECT MIN(timestamp) 
    FROM public.workflow_history 
    WHERE workflow_history.project_id = projects.id 
    AND workflow_history.stage = 'MULTI_WRITER_APPROVAL'
)
WHERE writer_submitted_at IS NULL
AND id IN (
    SELECT DISTINCT project_id 
    FROM public.workflow_history 
    WHERE stage = 'MULTI_WRITER_APPROVAL'
);

-- Verification query
/*
SELECT 
    p.id,
    p.title,
    p.writer_submitted_at,
    (SELECT COUNT(*) FROM workflow_history wh WHERE wh.project_id = p.id AND wh.stage = 'MULTI_WRITER_APPROVAL') as multi_writer_approvals,
    (SELECT COUNT(*) FROM workflow_history wh WHERE wh.project_id = p.id AND wh.stage = 'SCRIPT' AND wh.action = 'SUBMITTED') as script_submissions
FROM projects p
WHERE p.writer_submitted_at IS NOT NULL
ORDER BY p.writer_submitted_at DESC
LIMIT 10;
*/

-- Migration complete