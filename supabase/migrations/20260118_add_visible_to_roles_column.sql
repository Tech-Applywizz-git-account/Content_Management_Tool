-- Add visible_to_roles column for parallel role visibility
-- This column allows projects to be visible to multiple roles simultaneously

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS visible_to_roles TEXT[];