-- ============================================================================
-- FIX EDITOR/SUB-EDITOR WORKFLOW AND NOTIFICATION SYSTEM
-- ============================================================================
-- This migration addresses critical workflow issues:
-- 1. Missing notification triggers for sub-editor assignments
-- 2. Inconsistent upload metadata tracking
-- 3. Wrong rework routing logic
-- 4. Missing last uploader tracking for intelligent routing

-- Add missing columns for complete workflow tracking
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS last_video_uploaded_by TEXT CHECK (last_video_uploaded_by IN ('EDITOR', 'SUB_EDITOR')),
ADD COLUMN IF NOT EXISTS last_video_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add comprehensive comments
COMMENT ON COLUMN public.projects.last_video_uploaded_by IS 'Tracks who last uploaded the video (EDITOR or SUB_EDITOR) for intelligent rework routing';
COMMENT ON COLUMN public.projects.last_video_uploaded_at IS 'Timestamp of the last video upload for audit trail';

-- Ensure all timestamp columns exist with proper defaults
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS editor_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sub_editor_assigned_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.projects.editor_assigned_at IS 'When the project was assigned to editor';
COMMENT ON COLUMN public.projects.sub_editor_assigned_at IS 'When the project was assigned to sub-editor';

-- Add notification tracking columns
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS editor_assignment_notified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sub_editor_assignment_notified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS video_upload_notified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.projects.editor_assignment_notified IS 'Whether editor assignment notification was sent';
COMMENT ON COLUMN public.projects.sub_editor_assignment_notified IS 'Whether sub-editor assignment notification was sent';
COMMENT ON COLUMN public.projects.video_upload_notified IS 'Whether video upload notification was sent';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_last_video_uploaded_by ON public.projects(last_video_uploaded_by);
CREATE INDEX IF NOT EXISTS idx_projects_last_video_uploaded_at ON public.projects(last_video_uploaded_at);
CREATE INDEX IF NOT EXISTS idx_projects_editor_assigned_at ON public.projects(editor_assigned_at);
CREATE INDEX IF NOT EXISTS idx_projects_sub_editor_assigned_at ON public.projects(sub_editor_assigned_at);

-- ============================================================================
-- UPDATE WORKFLOW_HISTORY ENUM VALUES FOR BETTER TRACKING
-- ============================================================================
-- Add specific action types for sub-editor workflow
DO $$
BEGIN
    -- Add sub-editor specific actions to history_action enum
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'SUB_EDITOR_ASSIGNED';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'SUB_EDITOR_VIDEO_UPLOADED';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'EDITOR_VIDEO_UPLOADED';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'VIDEO_REWORK_ROUTED_TO_SUB_EDITOR';
    ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'VIDEO_REWORK_ROUTED_TO_EDITOR';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END$$;

-- ============================================================================
-- CREATE TRIGGER FUNCTIONS FOR AUTOMATED NOTIFICATIONS
-- ============================================================================

-- Function to handle sub-editor assignment notifications
CREATE OR REPLACE FUNCTION public.fn_notify_sub_editor_assignment()
RETURNS TRIGGER AS $$
DECLARE
    project_data jsonb;
    assigned_sub_editor jsonb;
BEGIN
    -- Only trigger on sub-editor assignments
    IF NEW.assigned_to_role = 'SUB_EDITOR' AND 
       (OLD.assigned_to_role IS DISTINCT FROM NEW.assigned_to_role OR OLD.assigned_to_role IS NULL) THEN
        
        -- Get project details
        SELECT jsonb_build_object(
            'project_id', p.id,
            'project_title', p.title,
            'assigned_to_user_id', NEW.assigned_to_user_id,
            'assigned_at', NOW(),
            'action_type', 'SUB_EDITOR_ASSIGNED'
        )
        INTO project_data
        FROM public.projects p
        WHERE p.id = NEW.id;
        
        -- Mark notification as sent
        UPDATE public.projects 
        SET sub_editor_assignment_notified = TRUE,
            sub_editor_assigned_at = NOW()
        WHERE id = NEW.id;
        
        -- Call notification function (adjust URL as needed)
        PERFORM net.http_post(
            url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-workflow-email',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY')
            ),
            body := jsonb_build_object(
                'event', 'sub_editor_assigned',
                'data', project_data,
                'recipient_role', 'SUB_EDITOR',
                'recipient_user_id', NEW.assigned_to_user_id
            )::text
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Sub-editor assignment notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle video upload notifications
CREATE OR REPLACE FUNCTION public.fn_notify_video_upload()
RETURNS TRIGGER AS $$
DECLARE
    project_data jsonb;
    next_assignees jsonb;
    upload_type TEXT;
BEGIN
    -- Detect video upload (either editor or sub-editor)
    IF (NEW.edited_video_link IS DISTINCT FROM OLD.edited_video_link) AND NEW.edited_video_link IS NOT NULL THEN
        
        -- Determine upload type and update last uploader tracking
        IF NEW.sub_editor_uploaded_at IS NOT NULL AND 
           (OLD.sub_editor_uploaded_at IS NULL OR NEW.sub_editor_uploaded_at > OLD.sub_editor_uploaded_at) THEN
            
            upload_type := 'SUB_EDITOR';
            UPDATE public.projects 
            SET last_video_uploaded_by = 'SUB_EDITOR',
                last_video_uploaded_at = NEW.sub_editor_uploaded_at
            WHERE id = NEW.id;
            
        ELSIF NEW.editor_uploaded_at IS NOT NULL AND 
              (OLD.editor_uploaded_at IS NULL OR NEW.editor_uploaded_at > OLD.editor_uploaded_at) THEN
            
            upload_type := 'EDITOR';
            UPDATE public.projects 
            SET last_video_uploaded_by = 'EDITOR',
                last_video_uploaded_at = NEW.editor_uploaded_at
            WHERE id = NEW.id;
        END IF;
        
        -- Get project details and next assignees
        SELECT jsonb_build_object(
            'project_id', p.id,
            'project_title', p.title,
            'upload_type', upload_type,
            'uploaded_at', CASE 
                WHEN upload_type = 'SUB_EDITOR' THEN NEW.sub_editor_uploaded_at
                ELSE NEW.editor_uploaded_at
            END,
            'current_stage', NEW.current_stage,
            'assigned_to_role', NEW.assigned_to_role
        )
        INTO project_data
        FROM public.projects p
        WHERE p.id = NEW.id;
        
        -- Mark notification as sent
        UPDATE public.projects 
        SET video_upload_notified = TRUE
        WHERE id = NEW.id;
        
        -- Notify next role in workflow
        PERFORM net.http_post(
            url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-workflow-email',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY')
            ),
            body := jsonb_build_object(
                'event', 'video_uploaded',
                'data', project_data,
                'upload_type', upload_type
            )::text
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Video upload notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle intelligent rework routing
CREATE OR REPLACE FUNCTION public.fn_route_rework_intelligently()
RETURNS TRIGGER AS $$
DECLARE
    last_uploader TEXT;
    project_data jsonb;
BEGIN
    -- Only trigger on rework actions
    IF NEW.action IN ('REWORK', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED') THEN
        
        -- Get the last video uploader for this project
        SELECT last_video_uploaded_by 
        INTO last_uploader
        FROM public.projects 
        WHERE id = NEW.project_id;
        
        -- Route rework appropriately
        IF last_uploader = 'SUB_EDITOR' THEN
            -- Route back to sub-editor
            UPDATE public.projects 
            SET assigned_to_role = 'SUB_EDITOR',
                current_stage = 'SUB_EDITOR_PROCESSING'
            WHERE id = NEW.project_id;
            
            -- Log the intelligent routing
            INSERT INTO public.workflow_history (
                project_id, stage, actor_id, actor_name, action, comment, 
                actor_role, from_role, to_role, metadata
            ) VALUES (
                NEW.project_id, 
                'SUB_EDITOR_PROCESSING',
                NEW.actor_id,
                NEW.actor_name,
                'VIDEO_REWORK_ROUTED_TO_SUB_EDITOR',
                'Rework routed to sub-editor based on last upload',
                NEW.actor_role,
                'SUB_EDITOR',
                'SUB_EDITOR',
                jsonb_build_object('routing_reason', 'last_uploader_was_sub_editor')
            );
            
        ELSIF last_uploader = 'EDITOR' OR last_uploader IS NULL THEN
            -- Route back to editor (default behavior)
            UPDATE public.projects 
            SET assigned_to_role = 'EDITOR',
                current_stage = 'VIDEO_EDITING'
            WHERE id = NEW.project_id;
            
            -- Log the routing
            INSERT INTO public.workflow_history (
                project_id, stage, actor_id, actor_name, action, comment,
                actor_role, from_role, to_role, metadata
            ) VALUES (
                NEW.project_id,
                'VIDEO_EDITING',
                NEW.actor_id,
                NEW.actor_name,
                'VIDEO_REWORK_ROUTED_TO_EDITOR',
                'Rework routed to editor based on last upload',
                NEW.actor_role,
                'EDITOR',
                'EDITOR',
                jsonb_build_object('routing_reason', 'last_uploader_was_editor_or_unknown')
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Intelligent rework routing failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ATTACH TRIGGERS TO TABLES
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_notify_sub_editor_assignment ON public.projects;
DROP TRIGGER IF EXISTS trigger_notify_video_upload ON public.projects;
DROP TRIGGER IF EXISTS trigger_route_rework_intelligently ON public.workflow_history;

-- Create triggers
CREATE TRIGGER trigger_notify_sub_editor_assignment
    AFTER UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_sub_editor_assignment();

CREATE TRIGGER trigger_notify_video_upload
    AFTER UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_video_upload();

CREATE TRIGGER trigger_route_rework_intelligently
    AFTER INSERT ON public.workflow_history
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_route_rework_intelligently();

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Backfill last_video_uploaded_by based on existing timestamps
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

-- Backfill assignment timestamps
UPDATE public.projects 
SET editor_assigned_at = created_at
WHERE editor_assigned_at IS NULL 
AND assigned_to_role = 'EDITOR';

UPDATE public.projects 
SET sub_editor_assigned_at = assigned_at
FROM (
    SELECT project_id, MAX(created_at) as assigned_at
    FROM public.workflow_history 
    WHERE action = 'SUB_EDITOR_ASSIGNED'
    GROUP BY project_id
) wh
WHERE projects.id = wh.project_id 
AND projects.sub_editor_assigned_at IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
/*
-- Check that all required columns exist
\d projects

-- Verify triggers exist
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE '%notify%' OR tgname LIKE '%route%';

-- Test the backfilled data
SELECT 
    id,
    title,
    last_video_uploaded_by,
    last_video_uploaded_at,
    editor_uploaded_at,
    sub_editor_uploaded_at
FROM projects 
WHERE last_video_uploaded_by IS NOT NULL
LIMIT 10;
*/

-- Migration complete - all workflow fixes implemented