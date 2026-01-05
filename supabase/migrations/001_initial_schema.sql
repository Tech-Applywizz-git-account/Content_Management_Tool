-- ============================================================================
-- SUPABASE SCHEMA MIGRATION - Content Management System
-- ============================================================================
-- This migration creates all tables with correct enums matching types.ts
-- RLS is intentionally DISABLED per user requirement (internal tool)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'ADMIN', 'WRITER', 'CINE', 'EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    phone VARCHAR(50),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('LINKEDIN', 'YOUTUBE', 'INSTAGRAM')),
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('VIDEO', 'CREATIVE_ONLY')),
    current_stage VARCHAR(50) NOT NULL CHECK (current_stage IN (
        'SCRIPT',
        'SCRIPT_REVIEW_L1',
        'SCRIPT_REVIEW_L2',
        'CINEMATOGRAPHY',
        'VIDEO_EDITING',
        'THUMBNAIL_DESIGN',
        'CREATIVE_DESIGN',
        'FINAL_REVIEW_CMO',
        'FINAL_REVIEW_CEO',
        'OPS_SCHEDULING',
        'POSTED'
    )),
    task_status VARCHAR(30) NOT NULL DEFAULT 'TODO' CHECK (task_status IN (
        'TODO',
        'IN_PROGRESS',
        'WAITING_APPROVAL',
        'REJECTED',
        'DONE'
    )),
    priority VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    due_date DATE,
    shoot_date DATE,
    delivery_date DATE,
    post_scheduled_date DATE,
    video_link TEXT,
    edited_video_link TEXT,
    thumbnail_link TEXT,
    creative_link TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKFLOW HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('approve', 'reject', 'submit')),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    comment TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SYSTEM LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON public.projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_current_stage ON public.projects(current_stage);
CREATE INDEX IF NOT EXISTS idx_projects_channel ON public.projects(channel);
CREATE INDEX IF NOT EXISTS idx_projects_task_status ON public.projects(task_status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_shoot_date ON public.projects(shoot_date);
CREATE INDEX IF NOT EXISTS idx_projects_delivery_date ON public.projects(delivery_date);
CREATE INDEX IF NOT EXISTS idx_projects_post_scheduled_date ON public.projects(post_scheduled_date);

-- Workflow history indexes
CREATE INDEX IF NOT EXISTS idx_workflow_history_project_id ON public.workflow_history(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_timestamp ON public.workflow_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_history_actor_id ON public.workflow_history(actor_id);

-- System logs indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(timestamp DESC);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON public.projects
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECURITY CONFIGURATION
-- ============================================================================
-- RLS is intentionally DISABLED for this internal tool
-- All security is handled at the application layer

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.users IS 'User accounts with role-based access';
COMMENT ON TABLE public.projects IS 'Content projects across LinkedIn, YouTube, and Instagram channels';
COMMENT ON TABLE public.workflow_history IS 'Audit trail of all workflow stage transitions';
COMMENT ON TABLE public.system_logs IS 'System-wide activity logs';

COMMENT ON COLUMN public.projects.content_type IS 'VIDEO for full production with cinematography/editing, CREATIVE_ONLY for graphics-only content';
COMMENT ON COLUMN public.projects.current_stage IS 'Current workflow stage - must match WorkflowStage enum in types.ts';
COMMENT ON COLUMN public.projects.metadata IS 'Flexible JSON field for stage-specific data (script content, video URLs, etc.)';