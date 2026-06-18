-- AI-designable products catalog ("منتجات الذكاء الاصطناعي") — admin-managed.
-- Replaces the hardcoded AI_PRODUCT_TYPES list. The 5 removed products
-- (business_card, invitation, banner, logo, social) are intentionally NOT seeded.
-- options/custom_size mirror the AiProductType shape ({id,label,sizeLabel,canvas} / {label,placeholder}).

CREATE TABLE IF NOT EXISTS public.ai_products (
  id text PRIMARY KEY,
  label text NOT NULL,
  canvas text NOT NULL DEFAULT '1024x1024',   -- 1024x1024 | 1536x1024 | 1024x1536
  size_label text,
  option_label text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{id,label,sizeLabel,canvas}]
  custom_size jsonb,                           -- {label, placeholder} or null
  directives text,
  price integer NOT NULL DEFAULT 0,            -- IQD, shown in the AI dropdown + charged
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai products" ON public.ai_products FOR SELECT USING (true);
CREATE POLICY "Admins insert ai products" ON public.ai_products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update ai products" ON public.ai_products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete ai products" ON public.ai_products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.ai_products (id, label, canvas, size_label, option_label, options, custom_size, directives, price, sort_order) VALUES
  ('flyer', 'فلاير / منشور', '1024x1536', 'A5 (14.8×21 سم)', null, '[]'::jsonb, null, null, 1000, 1),
  ('poster', 'بوستر', '1024x1536', 'A3 (29.7×42 سم)', null, '[]'::jsonb, null, null, 1000, 2),
  ('menu', 'منيو', '1024x1536', 'A4 (21×29.7 سم)', null, '[]'::jsonb, null, null, 1000, 3),
  ('letterhead', 'ترويسة رسمية', '1536x1024', 'A4 أفقي', null, '[]'::jsonb, null, null, 1000, 4),
  ('roll_up', 'رول أب', '1024x1536', '85×200 سم', null, '[]'::jsonb, null, null, 1000, 5),
  ('card_single', 'كارت وجه واحد', '1536x1024', null, 'اتجاه الكارت', '[{"id":"landscape","label":"بالعرض","sizeLabel":"9×5 سم أفقي","canvas":"1536x1024"},{"id":"portrait","label":"بالطول","sizeLabel":"5×9 سم عمودي","canvas":"1024x1536"}]'::jsonb, null, 'بطاقة عمل (كارت) بوجه واحد، تصميم احترافي بسيط.', 1000, 6),
  ('card_double', 'كارت وجهين', '1536x1024', null, 'اتجاه الكارت', '[{"id":"landscape","label":"بالعرض","sizeLabel":"9×5 سم أفقي","canvas":"1536x1024"},{"id":"portrait","label":"بالطول","sizeLabel":"5×9 سم عمودي","canvas":"1024x1536"}]'::jsonb, null, 'بطاقة عمل (كارت) بوجهين أمامي وخلفي — اعرض الوجهين جنباً إلى جنب في نفس الصورة.', 1000, 7),
  ('receipt_design', 'تصميم وصل', '1024x1536', null, 'قياس الوصل', '[{"id":"a4","label":"A4","sizeLabel":"A4 (21×29.7 سم)","canvas":"1024x1536"},{"id":"a5","label":"A5","sizeLabel":"A5 (14.8×21 سم)","canvas":"1024x1536"},{"id":"a6","label":"A6","sizeLabel":"A6 (10.5×14.8 سم)","canvas":"1024x1536"},{"id":"dl","label":"DL","sizeLabel":"DL (9.9×21 سم)","canvas":"1024x1536"}]'::jsonb, null, 'وصل/فاتورة رسمية بجدول (التفاصيل، العدد، السعر المفرد، المبلغ الكلي) وترويسة باسم النشاط والهاتف والتاريخ، تخطيط نظيف.', 1000, 8),
  ('stamp', 'تصميم ختم', '1024x1024', null, 'قياس الختم', '[{"id":"rect_6x4","label":"مستطيل 6×4 سم","sizeLabel":"6×4 سم","canvas":"1536x1024"},{"id":"rect_5x3","label":"مستطيل 5×3 سم","sizeLabel":"5×3 سم","canvas":"1536x1024"},{"id":"rect_47x18","label":"مستطيل 4.7×1.8 سم","sizeLabel":"4.7×1.8 سم","canvas":"1536x1024"},{"id":"rect_35x14","label":"مستطيل 3.5×1.4 سم","sizeLabel":"3.5×1.4 سم","canvas":"1536x1024"},{"id":"sq_5x5","label":"مربع/دائري 5×5 سم","sizeLabel":"5×5 سم","canvas":"1024x1024"},{"id":"sq_4x4","label":"مربع/دائري 4×4 سم","sizeLabel":"4×4 سم","canvas":"1024x1024"},{"id":"sq_3x3","label":"مربع/دائري 3×3 سم","sizeLabel":"3×3 سم","canvas":"1024x1024"},{"id":"sq_2x2","label":"مربع/دائري 2×2 سم","sizeLabel":"2×2 سم","canvas":"1024x1024"},{"id":"oval_3x45","label":"بيضوي 3×4.5 سم","sizeLabel":"3×4.5 سم","canvas":"1024x1536"},{"id":"oval_35x55","label":"بيضوي 3.5×5.5 سم","sizeLabel":"3.5×5.5 سم","canvas":"1024x1536"},{"id":"pocket_35x14","label":"ختم جيب 3.5×1.4 سم","sizeLabel":"3.5×1.4 سم","canvas":"1536x1024"},{"id":"pocket_47x18","label":"ختم جيب 4.7×1.8 سم","sizeLabel":"4.7×1.8 سم","canvas":"1536x1024"}]'::jsonb, null, 'ختم حبر رسمي باللون الأزرق فقط (single-color blue ink). خطوط واضحة وحدود حسب القياس (مستطيلة/مربعة/دائرية/بيضوية)، نص كبير ومقروء جداً، بدون صور أو تدرجات أو تعبئة، خلفية بيضاء.', 1000, 9),
  ('sticker_circle', 'لاصق دائري', '1024x1024', null, 'قطر اللاصق', '[{"id":"d3","label":"3 سم","sizeLabel":"دائري قطر 3 سم","canvas":"1024x1024"},{"id":"d4","label":"4 سم","sizeLabel":"دائري قطر 4 سم","canvas":"1024x1024"},{"id":"d5","label":"5 سم","sizeLabel":"دائري قطر 5 سم","canvas":"1024x1024"},{"id":"d6","label":"6 سم","sizeLabel":"دائري قطر 6 سم","canvas":"1024x1024"},{"id":"d7","label":"7 سم","sizeLabel":"دائري قطر 7 سم","canvas":"1024x1024"},{"id":"d8","label":"8 سم","sizeLabel":"دائري قطر 8 سم","canvas":"1024x1024"},{"id":"d9","label":"9 سم","sizeLabel":"دائري قطر 9 سم","canvas":"1024x1024"},{"id":"d10","label":"10 سم","sizeLabel":"دائري قطر 10 سم","canvas":"1024x1024"}]'::jsonb, null, 'لاصق دائري (ستيكر) — تصميم بسيط ونص كبير واضح يملأ الدائرة.', 1000, 10),
  ('sticker_rect', 'لاصق مستطيل', '1536x1024', null, null, '[]'::jsonb, '{"label":"القياس المطلوب (الطول × العرض بالسنتيمتر)","placeholder":"مثال: 10 × 5 سم"}'::jsonb, 'لاصق مستطيل (ستيكر) — تصميم بسيط ونص كبير واضح.', 1000, 11),
  ('flex', 'قطعة فلكس إعلانية أو لاصق', '1536x1024', null, null, '[]'::jsonb, '{"label":"القياس المطلوب (بالسنتيمتر أو بالمتر)","placeholder":"مثال: 3 × 2 متر"}'::jsonb, 'لوحة فلكس إعلانية كبيرة الحجم — نص ضخم جداً وواضح يُقرأ من بعيد، تصميم بسيط، تركيز على الرسالة الأساسية.', 1000, 12),
  ('doctor_rx', 'راجيتة طبيب', '1024x1536', 'A5 (14.8×21 سم)', null, '[]'::jsonb, null, 'وصفة طبية (راجيتة) بقياس A5 قياسي — ترويسة باسم الطبيب والاختصاص والعيادة، رمز Rx، أسطر للوصفة، تذييل بالعنوان والهاتف. تصميم نظيف طبي بألوان فاتحة ونص كبير واضح.', 1000, 13)
ON CONFLICT (id) DO NOTHING;
