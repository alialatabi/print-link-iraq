
-- Create storage bucket for template previews
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-previews', 'template-previews', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload template previews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'template-previews');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update template previews"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'template-previews');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete template previews"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'template-previews');

-- Allow public read access
CREATE POLICY "Public can view template previews"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'template-previews');
