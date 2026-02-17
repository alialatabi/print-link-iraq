
-- Create public storage bucket for template previews
INSERT INTO storage.buckets (id, name, public) VALUES ('template-previews', 'template-previews', true);

-- Anyone can view template previews (public)
CREATE POLICY "Public read template previews"
ON storage.objects FOR SELECT
USING (bucket_id = 'template-previews');

-- Only admins can upload template previews
CREATE POLICY "Admins upload template previews"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'template-previews'
  AND public.has_role(auth.uid(), 'admin')
);

-- Only admins can update template previews
CREATE POLICY "Admins update template previews"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'template-previews'
  AND public.has_role(auth.uid(), 'admin')
);

-- Only admins can delete template previews
CREATE POLICY "Admins delete template previews"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'template-previews'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete templates
CREATE POLICY "Admins delete templates"
ON public.templates FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
