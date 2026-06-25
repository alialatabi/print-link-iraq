-- Monthly recurring (fixed) expenses — rent, salaries, internet, subscriptions, etc.
-- Each row is a per-month commitment; the accounting module multiplies the total of
-- the ACTIVE rows by the number of months in the selected period and folds it into
-- the period's expenses + net profit.

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'عام',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Only admins can manage recurring expenses (mirrors public.expenses).
DROP POLICY IF EXISTS "Admins read recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Admins insert recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Admins update recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Admins delete recurring_expenses" ON public.recurring_expenses;

CREATE POLICY "Admins read recurring_expenses" ON public.recurring_expenses FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert recurring_expenses" ON public.recurring_expenses FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update recurring_expenses" ON public.recurring_expenses FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete recurring_expenses" ON public.recurring_expenses FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime (ignore if already part of the publication).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_expenses;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
