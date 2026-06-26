-- H10 (Security Audit): Stored XSS via SVG upload to the PUBLIC 'order-attachments' bucket.
-- The INSERT policy only checks bucket_id, so an authenticated user could upload an
-- image/svg+xml (or text/html) file directly via the storage API — served inline from the
-- public URL it executes script in our origin.
--
-- Server-side backstop (cannot be bypassed by the client): constrain the bucket to a
-- raster-image + PDF + PSD allowlist and a size cap. Executable types (svg+xml, html, xml,
-- text/*, js) are NOT in the list and are rejected at upload time. application/octet-stream
-- is kept because browsers send it for .psd: served as octet-stream it downloads (never
-- renders), so it is not an XSS vector. The client-side guard (uploadValidation.ts) is the
-- first line; this is defense in depth.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'image/vnd.adobe.photoshop',
    'application/octet-stream'
  ],
  file_size_limit = 52428800  -- 50 MB
WHERE id = 'order-attachments';
