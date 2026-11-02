ALTER TABLE public.search_daily_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.search_daily_entries FROM anon, authenticated;
