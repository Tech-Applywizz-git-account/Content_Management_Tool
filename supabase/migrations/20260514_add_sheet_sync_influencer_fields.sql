-- Columns populated by the Google Sheets row-level sync.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'influencers' AND column_name = 'posting_date') THEN
        ALTER TABLE public.influencers ADD COLUMN posting_date TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'influencers' AND column_name = 'resource') THEN
        ALTER TABLE public.influencers ADD COLUMN resource TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'influencers' AND column_name = 'comments') THEN
        ALTER TABLE public.influencers ADD COLUMN comments TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'influencers' AND column_name = 'leads') THEN
        ALTER TABLE public.influencers ADD COLUMN leads TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'influencers' AND column_name = 'payment_date') THEN
        ALTER TABLE public.influencers ADD COLUMN payment_date TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'influencers' AND column_name = 'updated_at') THEN
        ALTER TABLE public.influencers ADD COLUMN updated_at TIMESTAMPTZ;
    END IF;
END $$;
