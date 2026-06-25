-- Admin "AI Designs" gallery: let admins delete generated designs (bulk + single).
--
-- ai_generations had only a SELECT policy (rows are inserted by the edge function via the
-- service-role key, which bypasses RLS). The admin gallery now supports multi-select delete,
-- so admins need an explicit DELETE policy. The image files live in the public
-- `order-attachments` bucket, whose existing "Delete order attachments" policy already lets
-- authenticated users remove them, so no storage policy change is needed.

CREATE POLICY "Admins delete ai generations"
  ON public.ai_generations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
