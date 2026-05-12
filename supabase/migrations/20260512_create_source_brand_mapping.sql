-- Create source_brand_mapping table
-- Maps API lead source names → brand records so all users share the same mapping
CREATE TABLE IF NOT EXISTS source_brand_mapping (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_name TEXT NOT NULL UNIQUE,
    brand_id    UUID REFERENCES brands(id) ON DELETE SET NULL,
    brand_name  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE source_brand_mapping ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read mappings
CREATE POLICY "source_brand_mapping_select"
    ON source_brand_mapping FOR SELECT
    TO authenticated USING (true);

-- All authenticated users can insert new mappings
CREATE POLICY "source_brand_mapping_insert"
    ON source_brand_mapping FOR INSERT
    TO authenticated WITH CHECK (true);

-- All authenticated users can update mappings
CREATE POLICY "source_brand_mapping_update"
    ON source_brand_mapping FOR UPDATE
    TO authenticated USING (true) WITH CHECK (true);

-- All authenticated users can delete mappings
CREATE POLICY "source_brand_mapping_delete"
    ON source_brand_mapping FOR DELETE
    TO authenticated USING (true);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_source_brand_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER source_brand_mapping_updated_at
    BEFORE UPDATE ON source_brand_mapping
    FOR EACH ROW EXECUTE FUNCTION update_source_brand_mapping_updated_at();
