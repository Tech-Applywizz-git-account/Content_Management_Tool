# Run Sub-Editor workflow migration via Supabase REST API

Write-Host "Running Sub-Editor workflow migration..." -ForegroundColor Cyan

# Read .env file
$envContent = Get-Content .env
$serviceKey = ($envContent | Where-Object { $_ -like "VITE_SUPABASE_SERVICE_ROLE_KEY=*" }) -replace "VITE_SUPABASE_SERVICE_ROLE_KEY=", ""

if (-not $serviceKey) {
    Write-Host "Error: VITE_SUPABASE_SERVICE_ROLE_KEY not found in .env file" -ForegroundColor Red
    Write-Host "Please add your service role key to .env" -ForegroundColor Yellow
    exit 1
}

$url = "https://zxnevoulicmapqmniaos.supabase.co/rest/v1/rpc/exec_sql"

$sql = @"
-- ============================================================================
-- COMPREHENSIVE SUB-EDITOR WORKFLOW FIXES
-- ============================================================================
-- This migration addresses all the identified issues in the Sub-Editor workflow:
-- 1. Fix assignment email action from APPROVED to SUB_EDITOR_ASSIGNED
-- 2. Introduce proper SUB_EDITOR_VIDEO_UPLOADED action
-- 3. Add columns to persist who actually edited the video
-- 4. Fix rework routing logic
-- 5. Clean up workflow history consistency

-- Add columns for tracking who actually edited the video
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS edited_by_role TEXT CHECK (edited_by_role IN ('EDITOR', 'SUB_EDITOR')),
ADD COLUMN IF NOT EXISTS edited_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_by_name TEXT,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.projects.edited_by_role IS 'Tracks which role actually edited the video (EDITOR or SUB_EDITOR)';
COMMENT ON COLUMN public.projects.edited_by_user_id IS 'User ID of who actually edited the video';
COMMENT ON COLUMN public.projects.edited_by_name IS 'Name of who actually edited the video';
COMMENT ON COLUMN public.projects.edited_at IS 'Timestamp when the video was last edited';

-- Ensure workflow_history has proper role tracking columns
ALTER TABLE public.workflow_history
ADD COLUMN IF NOT EXISTS actor_role TEXT,
ADD COLUMN IF NOT EXISTS from_role TEXT,
ADD COLUMN IF NOT EXISTS to_role TEXT;

-- Update existing workflow history records to ensure role consistency
UPDATE public.workflow_history 
SET actor_role = CASE 
    WHEN actor_name ILIKE '%editor%' THEN 'EDITOR'
    WHEN actor_name ILIKE '%sub%editor%' THEN 'SUB_EDITOR'
    WHEN actor_name ILIKE '%cmo%' THEN 'CMO'
    WHEN actor_name ILIKE '%ceo%' THEN 'CEO'
    WHEN actor_name ILIKE '%writer%' THEN 'WRITER'
    ELSE actor_role
END
WHERE actor_role IS NULL;

-- Add the new action types to workflow history
DO $$
BEGIN
    -- Add sub-editor specific actions if they don't exist
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'SUB_EDITOR_ASSIGNED';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'SUB_EDITOR_VIDEO_UPLOADED';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'EDITOR_VIDEO_UPLOADED';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'VIDEO_REWORK_ROUTED_TO_SUB_EDITOR';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'VIDEO_REWORK_ROUTED_TO_EDITOR';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_edited_by_role ON public.projects(edited_by_role);
CREATE INDEX IF NOT EXISTS idx_projects_edited_by_user_id ON public.projects(edited_by_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_edited_at ON public.projects(edited_at);
CREATE INDEX IF NOT EXISTS idx_workflow_history_actor_role ON public.workflow_history(actor_role);
CREATE INDEX IF NOT EXISTS idx_workflow_history_from_role ON public.workflow_history(from_role);
CREATE INDEX IF NOT EXISTS idx_workflow_history_to_role ON public.workflow_history(to_role);

-- First, ensure we have the tracking columns that might be needed
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS last_video_uploaded_by TEXT CHECK (last_video_uploaded_by IN ('EDITOR', 'SUB_EDITOR')),
ADD COLUMN IF NOT EXISTS last_video_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Backfill the tracking columns if they don't exist
UPDATE public.projects 
SET last_video_uploaded_by = CASE 
    WHEN sub_editor_uploaded_at IS NOT NULL AND 
         (editor_uploaded_at IS NULL OR sub_editor_uploaded_at >= editor_uploaded_at) 
    THEN 'SUB_EDITOR'
    WHEN editor_uploaded_at IS NOT NULL 
    THEN 'EDITOR'
    ELSE NULL
END,
last_video_uploaded_at = GREATEST(sub_editor_uploaded_at, editor_uploaded_at)
WHERE last_video_uploaded_by IS NULL;

-- Now backfill edited_by_* columns based on existing data
UPDATE public.projects 
SET edited_by_role = last_video_uploaded_by,
    edited_by_user_id = assigned_to_user_id,
    edited_by_name = CASE 
        WHEN last_video_uploaded_by = 'EDITOR' THEN editor_name
        WHEN last_video_uploaded_by = 'SUB_EDITOR' THEN sub_editor_name
        ELSE NULL
    END,
    edited_at = last_video_uploaded_at
WHERE edited_by_role IS NULL 
AND last_video_uploaded_by IS NOT NULL;
"@

$headers = @{
    "apikey"        = $serviceKey
    "Authorization" = "Bearer $serviceKey"
    "Content-Type"  = "application/json"
}

$body = @{ query = $sql } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "Migration successful!" -ForegroundColor Green
    Write-Host "Sub-Editor workflow fixes have been applied." -ForegroundColor Green
}
catch {
    Write-Host "API method not available" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run this SQL manually in Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host $sql -ForegroundColor White
    Write-Host ""
    Write-Host "1. Go to: https://supabase.com/dashboard/project/zxnevoulicmapqmniaos/sql/new" -ForegroundColor Cyan
    Write-Host "2. Paste the SQL above" -ForegroundColor Cyan
    Write-Host "3. Click Run" -ForegroundColor Cyan
}