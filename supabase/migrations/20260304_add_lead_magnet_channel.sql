-- Update the check constraint on the channel column in the projects table to include LEAD_MAGNET
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_channel_check;

ALTER TABLE public.projects 
ADD CONSTRAINT projects_channel_check 
CHECK (channel IN ('LINKEDIN', 'YOUTUBE', 'INSTAGRAM', 'JOBBOARD', 'LEAD_MAGNET'));
