-- Migration: Add PARTNER_ASSOCIATE role to users and projects table constraints
-- This addresses the error: "new row for relation 'users' violates check constraint 'users_role_check'"

-- 1. Update the users table role check constraint
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_role_check' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
    END IF;
END $$;

-- Add the new constraint with PARTNER_ASSOCIATE included
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN (
    'ADMIN', 
    'WRITER', 
    'CINE', 
    'EDITOR', 
    'SUB_EDITOR', 
    'DESIGNER', 
    'CMO', 
    'CEO', 
    'OPS', 
    'OBSERVER', 
    'PARTNER_ASSOCIATE'
));

-- 2. Update the projects table assigned_to_role check constraint
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_assigned_to_role_check' 
        AND table_name = 'projects'
    ) THEN
        ALTER TABLE public.projects DROP CONSTRAINT projects_assigned_to_role_check;
    END IF;
END $$;

-- Recreate the constraint with the PARTNER_ASSOCIATE role included
ALTER TABLE public.projects 
ADD CONSTRAINT projects_assigned_to_role_check 
CHECK (assigned_to_role IN (
    'ADMIN', 
    'WRITER', 
    'CINE', 
    'EDITOR', 
    'SUB_EDITOR', 
    'DESIGNER', 
    'CMO', 
    'CEO', 
    'OPS', 
    'OBSERVER', 
    'PARTNER_ASSOCIATE'
));
