-- Add job_title column to users table for OBSERVER role
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add comment to column
COMMENT ON COLUMN users.job_title IS 'Job title for OBSERVER role users (COO, CRO, CTO, CFO, etc.)';

-- Create index for faster queries on observers
CREATE INDEX IF NOT EXISTS idx_users_role_job_title ON users(role, job_title) WHERE role = 'OBSERVER';
