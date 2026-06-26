-- H3 (Security Audit): Any authenticated user could delete ANY file in the public
-- 'order-attachments' bucket — the DELETE policy only checked bucket_id, with no
-- ownership predicate.
--
-- Path convention in this bucket:
--   <orderId>/...                 (customer/reseller/designer order attachments + revisions)
--   ai-drafts/<userId>/<uuid>.png (accepted AI drafts)
--   ai-generations/<userId>/...   (every AI generation; pruned by the admin panel)
--
-- The audit's suggested `(storage.foldername(name))[2] = auth.uid()` does NOT match this
-- layout (the first segment is the order id, not a user id). Correct ownership = whoever
-- owns the order the file belongs to, plus admins (who manage the AI-generations gallery).

DROP POLICY IF EXISTS "Delete order attachments" ON storage.objects;

CREATE POLICY "Delete order attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-attachments'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND (o.customer_id = auth.uid() OR o.designer_id = auth.uid())
    )
  )
);
