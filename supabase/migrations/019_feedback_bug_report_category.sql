-- 019: Add bug_report category to feedback table

ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_category_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_category_check
  CHECK (category IN ('missing_knowledge', 'missing_feature', 'search_quality', 'bug_report', 'other'));
