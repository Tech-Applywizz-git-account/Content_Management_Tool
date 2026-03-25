-- Add brand column to projects table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'brand') THEN
        ALTER TABLE projects ADD COLUMN brand TEXT;
    END IF;
END $$;

-- Update existing projects by extracting brand from JSONB data if it exists
UPDATE projects 
SET brand = data->>'brand'
WHERE brand IS NULL AND data->>'brand' IS NOT NULL;
