-- Migration: Add created_by_user_id to brands table
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_brands_created_by_user_id ON public.brands(created_by_user_id);
