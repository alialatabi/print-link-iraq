
-- 1. Create services table
CREATE TABLE public.services (
  id text PRIMARY KEY,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '📄',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins manage services" ON public.services FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update services" ON public.services FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete services" ON public.services FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- 2. Create specializations table
CREATE TABLE public.specializations (
  id text PRIMARY KEY,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '📋',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.specializations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read specializations" ON public.specializations FOR SELECT USING (true);
CREATE POLICY "Admins manage specializations" ON public.specializations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update specializations" ON public.specializations FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete specializations" ON public.specializations FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- 3. Seed services data
INSERT INTO public.services (id, label, icon, description, sort_order) VALUES
  ('business_card', 'كروت شخصية', '💳', 'تصميم كروت شخصية احترافية بأشكال متعددة', 1),
  ('flyer', 'فلايرات', '📄', 'فلايرات إعلانية جذابة لعملك', 2),
  ('receipt', 'وصولات', '🧾', 'وصولات رسمية لمعاملاتك التجارية', 3),
  ('letterhead', 'ترويسة', '📋', 'ترويسة رسمية لمؤسستك', 4),
  ('menu', 'قوائم طعام', '🍽️', 'قوائم طعام أنيقة لمطعمك', 5),
  ('invitation', 'دعوات', '💌', 'بطاقات دعوة مميزة لمناسباتك', 6);

-- 4. Seed specializations data
INSERT INTO public.specializations (id, label, icon, sort_order) VALUES
  ('lawyer', 'محامين', '⚖️', 1),
  ('doctor', 'أطباء', '🩺', 2),
  ('fashion', 'أزياء وموضة', '👗', 3),
  ('handmade', 'أعمال يدوية', '🧶', 4),
  ('pajama', 'بيجامات', '👕', 5),
  ('retail', 'محلات تجارية', '🏪', 6),
  ('restaurant', 'مطاعم ومقاهي', '☕', 7),
  ('real_estate', 'عقارات', '🏠', 8),
  ('education', 'تعليم وتدريب', '📚', 9),
  ('tech', 'تكنولوجيا', '💻', 10),
  ('beauty', 'تجميل وعناية', '💄', 11),
  ('fitness', 'رياضة ولياقة', '🏋️', 12),
  ('photography', 'تصوير', '📷', 13),
  ('construction', 'مقاولات وبناء', '🏗️', 14),
  ('automotive', 'سيارات', '🚗', 15),
  ('other', 'أخرى', '📋', 16);

-- 5. Change templates.service_type from enum to text
ALTER TABLE public.templates ALTER COLUMN service_type TYPE text USING service_type::text;

-- Drop the enum type (no longer needed for service_type on templates)
-- Note: we keep it if other tables use it, but only templates uses service_type enum
-- Actually orders doesn't use service_type, so we can drop it
DROP TYPE IF EXISTS public.service_type;
