-- Add OBSERVER role to user role CHECK constraint
-- This migration updates the existing CHECK constraint to include OBSERVER role

-- Step 1: Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add the new constraint with OBSERVER included
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('ADMIN', 'WRITER', 'CINE', 'EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'));

-- Verification: This should now allow OBSERVER role
-- Test query: SELECT constraint_name, check_clause FROM information_schema.check_constraints 
-- WHERE constraint_name = 'users_role_check';
