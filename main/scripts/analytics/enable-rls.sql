-- Run once after `npm run db:push` creates analytics_events (#396).
-- The app role bypasses RLS; no policies keeps the table closed to Supabase anon/authenticated roles.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
