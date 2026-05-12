-- Migration to add product_name column to influencers table
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Comment to describe the column
COMMENT ON COLUMN influencers.product_name IS 'The name of the product provided for barter collaborations';
