-- Add notifications table to support asset upload notifications
-- This enables receivers to be notified when assets are uploaded by other users

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'ASSET_UPLOADED',
        'ASSET_UPDATED',
        'PROJECT_ASSIGNED',
        'REVIEW_READY',
        'REWORK_REQUESTED',
        'APPROVAL_GRANTED'
    )),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON public.notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Add comment for documentation
COMMENT ON TABLE public.notifications IS 'User notifications for project updates and asset uploads';
COMMENT ON COLUMN public.notifications.type IS 'Type of notification (ASSET_UPLOADED, PROJECT_ASSIGNED, etc.)';
COMMENT ON COLUMN public.notifications.is_read IS 'Whether the notification has been read by the user';