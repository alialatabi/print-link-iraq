
-- Add icon_url column to services and specializations
ALTER TABLE public.services ADD COLUMN icon_url text DEFAULT NULL;
ALTER TABLE public.specializations ADD COLUMN icon_url text DEFAULT NULL;

-- Create storage bucket for service/spec icons
INSERT INTO storage.buckets (id, name, public) VALUES ('service-icons', 'service-icons', true);

-- Storage policies
CREATE POLICY "Public read service icons" ON storage.objects FOR SELECT USING (bucket_id = 'service-icons');
CREATE POLICY "Admins upload service icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'service-icons' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update service icons" ON storage.objects FOR UPDATE USING (bucket_id = 'service-icons' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete service icons" ON storage.objects FOR DELETE USING (bucket_id = 'service-icons' AND public.has_role(auth.uid(), 'admin'));
