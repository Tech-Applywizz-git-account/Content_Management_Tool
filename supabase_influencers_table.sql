-- SQL Script to create the 'influencers' table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS influencers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_project_id UUID REFERENCES projects(id),
  instance_project_id UUID REFERENCES projects(id),
  influencer_name TEXT NOT NULL,
  influencer_email TEXT NOT NULL,
  script_content TEXT,
  content_description TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_by TEXT,
  status TEXT DEFAULT 'SENT_TO_INFLUENCER',
  video_link TEXT,
  edited_video_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimization: Add indexes for faster lookups by project
CREATE INDEX IF NOT EXISTS influencers_parent_project_idx ON influencers(parent_project_id);
CREATE INDEX IF NOT EXISTS influencers_instance_project_idx ON influencers(instance_project_id);
CREATE INDEX IF NOT EXISTS influencers_email_idx ON influencers(influencer_email);

-- Enable Realtime if needed
ALTER PUBLICATION supabase_realtime ADD TABLE influencers;
