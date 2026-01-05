-- Update priority enum to include MEDIUM and LOW values
-- This migration updates the CHECK constraint on the priority column

-- First, update existing 'NORMAL' values to 'MEDIUM' (as they're functionally equivalent)
UPDATE public.projects 
SET priority = 'MEDIUM' 
WHERE priority = 'NORMAL';

-- Then alter the table to update the CHECK constraint
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_priority_check;

ALTER TABLE public.projects 
ADD CONSTRAINT projects_priority_check 
CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'));