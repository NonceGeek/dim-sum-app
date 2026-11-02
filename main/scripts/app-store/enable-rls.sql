-- Run only after the reviewed Prisma db push, before enabling App Store writes.
ALTER TABLE public.app_store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_store_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_store_audit_logs ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: all writes and private reads use authenticated server APIs.
REVOKE ALL ON public.app_store_profiles, public.app_store_favorites, public.app_store_audit_logs FROM anon, authenticated;

-- Deliberate definer view: this projects ONLY previously public legacy columns.
-- It bypasses profile RLS only to suppress drafts/offline entries for old API consumers.
CREATE OR REPLACE VIEW public.app_store_public_legacy WITH (security_barrier = true) AS
SELECT a.id, a.name, a.description, a.authors, a.url, a.homepage_url, a.github_url,
       a.created_at, a.updated_at, a.likes, a.icon_img, a.type, a.wechat_micro_app,
       a.pinned, a.localed, a.example_img, a.sorting, a.version
FROM public.cantonese_corpus_apps a
LEFT JOIN public.app_store_profiles p ON p.app_id = a.id
WHERE p.app_id IS NULL OR p.status = 'published';
REVOKE ALL ON public.app_store_public_legacy FROM PUBLIC;
GRANT SELECT ON public.app_store_public_legacy TO anon, authenticated, service_role;

-- Constrain states independently of application validation.
ALTER TABLE public.app_store_profiles DROP CONSTRAINT IF EXISTS app_store_profiles_status_check;
ALTER TABLE public.app_store_profiles ADD CONSTRAINT app_store_profiles_status_check
  CHECK (status IN ('draft', 'published', 'offline'));
