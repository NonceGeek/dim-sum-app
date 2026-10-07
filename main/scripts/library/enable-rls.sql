-- Run once after `npm run db:push` creates the Library tables (#453).
-- The app connects with a role that bypasses RLS; enabling RLS without policies
-- keeps these tables (applicant contact details, review history) closed to the
-- Supabase anon/authenticated API roles.
ALTER TABLE public.library_dataset_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_contact_requests ENABLE ROW LEVEL SECURITY;

-- Verify: every row should report rowsecurity = true and no policies.
SELECT c.relname, c.relrowsecurity AS rowsecurity,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
FROM pg_class c
WHERE c.relname IN ('library_dataset_profiles', 'contribution_applications',
  'contribution_application_events', 'ingestion_leads', 'dataset_contact_requests');
