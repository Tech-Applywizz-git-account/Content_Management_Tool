-- Enable Realtime for the brands table so that newly created brands
-- (e.g. added by a PA via the "Add New Brand" form) are broadcast as
-- postgres_changes INSERT events to all subscribed clients.
-- This makes new brands appear immediately in the "Brands" section of
-- the Create Script page without requiring a full page reload.

ALTER PUBLICATION supabase_realtime ADD TABLE public.brands;
