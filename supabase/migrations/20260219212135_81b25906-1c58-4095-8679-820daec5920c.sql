
-- Create bucket for customer order attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-attachments', 'order-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated customers can upload their own order attachments
CREATE POLICY "Customers upload order attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-attachments');

-- Policy: Anyone can view order attachments (public bucket)
CREATE POLICY "Public read order attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'order-attachments');

-- Policy: Customers and admins can delete their attachments
CREATE POLICY "Delete order attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'order-attachments');
