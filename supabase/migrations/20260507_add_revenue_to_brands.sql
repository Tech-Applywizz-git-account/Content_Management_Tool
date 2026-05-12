-- Migration to add revenue column to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0;

-- Comment to describe the column
COMMENT ON COLUMN brands.revenue IS 'Revenue generated/associated with the brand in USD';
