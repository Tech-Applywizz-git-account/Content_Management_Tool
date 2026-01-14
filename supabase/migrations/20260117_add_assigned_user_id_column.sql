-- Add assigned_to_user_id column to projects table to allow assigning projects to specific users within a role

-- Add the column to the projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID;

-- Add foreign key constraint to reference users table
DO $$
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_assigned_to_user_id_fkey' 
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
    ADD CONSTRAINT projects_assigned_to_user_id_fkey 
    FOREIGN KEY (assigned_to_user_id) REFERENCES users(id);
  END IF;
END $$;

-- Add comment to document the purpose of the column
COMMENT ON COLUMN projects.assigned_to_user_id IS 'Specific user ID when a project is assigned to a particular user within a role (e.g., specific sub-editor)';