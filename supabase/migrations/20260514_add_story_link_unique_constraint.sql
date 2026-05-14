-- Ensure story sync can safely retry without duplicating story URLs.
ALTER TABLE public.influencer_stories
ADD CONSTRAINT influencer_stories_influencer_link_key UNIQUE (influencer_id, story_link);

CREATE INDEX IF NOT EXISTS idx_influencer_stories_story_link
ON public.influencer_stories(story_link);
