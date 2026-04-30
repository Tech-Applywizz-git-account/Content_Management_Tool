-- Add brand_type column to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS brand_type TEXT CHECK (brand_type IN ('REEL', 'STORY'));

-- Update existing brands to have a default value if needed
UPDATE public.brands SET brand_type = 'REEL' WHERE brand_type IS NULL;

-- Add all required columns to influencers table
DO $$ 
BEGIN 
    -- 1. Multiple story tracking
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'stories') THEN
        ALTER TABLE public.influencers ADD COLUMN stories JSONB DEFAULT '[]';
    END IF;

    -- 2. Campaign type tracking
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'brand_type') THEN
        ALTER TABLE public.influencers ADD COLUMN brand_type TEXT CHECK (brand_type IN ('REEL', 'STORY'));
    END IF;

    -- 3. Payment tracking
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'payment') THEN
        ALTER TABLE public.influencers ADD COLUMN payment TEXT DEFAULT 'no';
    END IF;

    -- 4. Platform type for payments
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'platform_type') THEN
        ALTER TABLE public.influencers ADD COLUMN platform_type TEXT;
    END IF;

    -- 5. Global posting status
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'is_posted') THEN
        ALTER TABLE public.influencers ADD COLUMN is_posted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
