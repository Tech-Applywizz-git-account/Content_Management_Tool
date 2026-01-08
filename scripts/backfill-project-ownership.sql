-- ============================================================================
-- BACKFILL SCRIPT - Project Ownership Linkage Correction
-- ============================================================================

-- 1️⃣ BACKFILL ownership IDs for existing projects where assigned_to is NULL
-- If assigned_to is NULL and created_by exists, set assigned_to = created_by
UPDATE public.projects 
SET assigned_to = created_by
WHERE assigned_to IS NULL 
  AND created_by IS NOT NULL;

-- 2️⃣ VERIFY workflow → project linkage integrity
-- Check for orphan workflow records (workflow_history records pointing to non-existent projects)
DELETE FROM public.workflow_history 
WHERE project_id NOT IN (SELECT id FROM public.projects);

-- 3️⃣ CLEAN UP orphan notification records
DELETE FROM public.notifications 
WHERE project_id NOT IN (SELECT id FROM public.projects);

-- 4️⃣ REPORT summary of changes
SELECT 
  COUNT(*) as total_projects,
  COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as projects_without_assignment,
  COUNT(CASE WHEN created_by IS NOT NULL AND assigned_to = created_by THEN 1 END) as projects_with_backfilled_assignment
FROM public.projects;

-- 5️⃣ VALIDATE referential integrity
-- Check for any remaining orphan workflow records
SELECT 
  COUNT(*) as orphan_workflow_records
FROM public.workflow_history wh
LEFT JOIN public.projects p ON wh.project_id = p.id
WHERE p.id IS NULL;

-- 6️⃣ VALIDATE referential integrity for notifications
SELECT 
  COUNT(*) as orphan_notification_records
FROM public.notifications n
LEFT JOIN public.projects p ON n.project_id = p.id
WHERE p.id IS NULL;

-- ============================================================================
-- END OF BACKFILL SCRIPT
-- ============================================================================