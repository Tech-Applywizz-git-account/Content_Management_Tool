-- Migration to add leads tracking capabilities to brands
ALTER TABLE brands
ADD COLUMN has_leads BOOLEAN DEFAULT false,
ADD COLUMN lead_sources TEXT[] DEFAULT '{}';
