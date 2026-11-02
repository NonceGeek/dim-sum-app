-- Run after the reviewed db pull / schema edit / db push workflow.
-- No public policies: all feedback access is mediated by authenticated server routes.
ALTER TABLE public.search_feedback ENABLE ROW LEVEL SECURITY;
