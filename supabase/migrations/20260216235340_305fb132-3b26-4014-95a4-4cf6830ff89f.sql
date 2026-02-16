
-- Storage policies for designs bucket
-- Allow designers to upload files to their order folders
CREATE POLICY "Designers upload design files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'designs'
  AND (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id::text = (storage.foldername(name))[1]
        AND orders.designer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Allow designers and customers to view design files for their orders
CREATE POLICY "View design files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'designs'
  AND (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id::text = (storage.foldername(name))[1]
        AND (orders.designer_id = auth.uid() OR orders.customer_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Allow designers to update/replace their uploaded files
CREATE POLICY "Designers update design files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'designs'
  AND (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id::text = (storage.foldername(name))[1]
        AND orders.designer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Allow designers to delete their uploaded files
CREATE POLICY "Designers delete design files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'designs'
  AND (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id::text = (storage.foldername(name))[1]
        AND orders.designer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);
