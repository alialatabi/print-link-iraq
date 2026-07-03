-- Launch catalog reset + seed (owner-approved list: docs/catalog/launch-catalog.json).
-- Pre-reset state backed up to docs/backup/services-backup-2026-07-03.json and
-- templates-backup-2026-07-03.json (48 templates — re-added via admin before launch).
--
-- 1) Wipes all TEST data: orders (with items/designs/notifications/vault rows via
--    explicit deletes + cascades), server carts, templates, and the whole services tree.
-- 2) Adds services.meta jsonb for catalog metadata the app doesn't model as columns
--    (pricing_unit, batch_size, shape, copies, print_colors, lamination_note...).
-- 3) Seeds 8 categories + 45 services; every service's ai_directives = the owner's new
--    per-product instructions + the canonical PRINT RULES / OUTPUT FORMAT block
--    (stamps get the single-color stamp variant).
-- 4) Re-inserts the 4 kept AI-only products (menu/flex/doctor_rx/pen) from the backup
--    with their existing AI config, hidden from the print catalog (print_enabled=false).

-- ── Wipe (FK-safe order) ─────────────────────────────────────────────────────────────
DELETE FROM public.notifications WHERE order_id IS NOT NULL;
DELETE FROM public.designs;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.carts;
DELETE FROM public.templates;
DELETE FROM public.services;

-- ── Catalog metadata column ──────────────────────────────────────────────────────────
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS meta jsonb;


-- ── Categories (parent services) ─────────────────────────────────────────────────────
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('cards', 'كروت', '💳', '', 1, NULL, true);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('office', 'مطبوعات إدارية', '📁', '', 2, NULL, true);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('receipt_book', 'وصولات', '🧾', '', 3, NULL, true);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('stamps', 'أختام', '📮', '', 4, NULL, true);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('stickers', 'ملصقات', '🏷️', '', 5, NULL, true);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('packaging', 'تغليف', '🛍️', '', 6, NULL, true);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('advertising', 'مواد إعلانية', '📢', '', 7, NULL, true);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES ('banners', 'لوحات وإعلانات', '🪧', '', 8, NULL, true);

-- ── Leaf services (45) ───────────────────────────────────────────────────────────────
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('card_iq_1', 'كارت عراقي وجه', '📄', '', 1, 'cards', 15000, 0, 1000, 3, 'glossy', true, 1, true, 1000, '1536x1024', '8.5×5 سم', 'اتجاه الكارت', '[{"id":"landscape","label":"بالعرض","sizeLabel":"أفقي (عرضي)","canvas":"1536x1024"},{"id":"portrait","label":"بالطول","sizeLabel":"عمودي (طولي)","canvas":"1024x1536"}]'::jsonb, NULL, 'بطاقة عمل عراقية بوجه واحد، ستايل تجاري محلي: خلفية فاتحة، لون مهيمن حسب قطاع الزبون، اسم/شعار بارز، بيانات التواصل بخط واضح. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"lamination_note":"حراري لماع مقاوم للرطوبة"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('card_iq_2', 'كارت عراقي وجهين', '📄', '', 2, 'cards', 20000, 0, 1000, 3, 'matte', true, 2, true, 1000, '1536x1024', '8.5×5 سم', 'اتجاه الكارت', '[{"id":"landscape","label":"بالعرض","sizeLabel":"أفقي (عرضي)","canvas":"1536x1024"},{"id":"portrait","label":"بالطول","sizeLabel":"عمودي (طولي)","canvas":"1024x1536"}]'::jsonb, NULL, 'بطاقة عمل بوجهين — الوجه الأمامي هوية بصرية والخلفي خدمات/QR أو نمط. خلفية فاتحة، لون مهيمن، تناسق بين الوجهين. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"lamination_note":"مات (طافي) مقاوم للرطوبة"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('card_turkish', 'كارت تركي', '📄', 'فترة التجهيز 15 يوم بعد الموافقة على التصميم', 3, 'cards', 90000, 0, 1000, 15, 'none', true, 2, true, 1000, '1536x1024', 'حسب الطلب', 'اتجاه الكارت', '[{"id":"landscape","label":"بالعرض","sizeLabel":"أفقي (عرضي)","canvas":"1536x1024"},{"id":"portrait","label":"بالطول","sizeLabel":"عمودي (طولي)","canvas":"1024x1536"}]'::jsonb, NULL, 'كارت فخم بارز، تصميم راقٍ يعتمد الفراغ والطباعة البارزة، ألوان محدودة وأنيقة. التصميم يراعي منطقة القصة الخاصة (die-cut). جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"lamination_note":"ورق 800غ، كتابة بارزة + قصة خاصة (die-cut) حسب الطلب"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('card_ivory_1', 'كارت عظم عاج وجه', '📄', 'السعر لكل 100 قطعة — أقل كمية 100 (يختلف عن باقي الكروت)', 4, 'cards', 35000, 0, 100, 7, 'none', true, 1, true, 1000, '1536x1024', '8.5×5 سم', 'اتجاه الكارت', '[{"id":"landscape","label":"بالعرض","sizeLabel":"أفقي (عرضي)","canvas":"1536x1024"},{"id":"portrait","label":"بالطول","sizeLabel":"عمودي (طولي)","canvas":"1024x1536"}]'::jsonb, NULL, 'كارت عظمي راقٍ، تصميم بسيط وفخم يبرز ملمس الورق، ألوان هادئة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":100}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('card_ivory_2', 'كارت عظم عاج وجهين', '📄', 'السعر لكل 100 قطعة — أقل كمية 100', 5, 'cards', 40000, 0, 100, 7, 'none', true, 2, true, 1000, '1536x1024', '8.5×5 سم', 'اتجاه الكارت', '[{"id":"landscape","label":"بالعرض","sizeLabel":"أفقي (عرضي)","canvas":"1536x1024"},{"id":"portrait","label":"بالطول","sizeLabel":"عمودي (طولي)","canvas":"1024x1536"}]'::jsonb, NULL, 'كارت عظمي بوجهين، فخم وبسيط، تناسق بين الوجهين. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":100}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('master_folder', 'حافظة ماستر', '📄', '', 6, 'office', 80000, 0, 1000, 5, 'none', true, 1, true, 1000, '1536x1024', '9×5.5', NULL, '[]'::jsonb, NULL, 'حافظة تقديمية رسمية بهوية الشركة، خلفية فاتحة ولون مهيمن، شعار بارز ومساحة للجيب الداخلي. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('file_folder', 'فايل', '📄', '', 7, 'office', 350000, 0, 1000, 4, 'none', true, 1, true, 1000, '1536x1024', '50×35', NULL, '[]'::jsonb, NULL, 'فايل بهوية الشركة، تصميم نظيف بلون مهيمن وشعار واضح. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('letterhead', 'فورما', '📄', 'أقل كمية 500 (السعر مقابلها)', 8, 'office', 30000, 0, 500, 3, 'none', true, 1, true, 1000, '1024x1536', 'A4', NULL, '[]'::jsonb, NULL, 'ورق رسمي A4: شعار وترويسة أعلى، بيانات تواصل أسفل، مساحة بيضاء واسعة للنص. رسمي ومتزن. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":500}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('receipt_a4', 'وصل A4', '📄', 'الباقة 5 دفاتر بسعر 35000. كل دفتر 100 ورقة، نسختين مكربن، ترقيم + تخريم', 9, 'receipt_book', 35000, 0, 5, 3, 'none', true, 1, true, 1000, '1024x1536', '30×20', NULL, '[]'::jsonb, NULL, 'دفتر وصولات رسمي: ترويسة الشركة، حقول مرقّمة، جدول بنود واضح. تخطيط عملي للطباعة الكاربونية. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_package","batch_size":5,"copies":2}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('receipt_a5', 'وصل A5', '📄', 'الباقة 10 دفاتر بسعر 35000. كل دفتر 100 ورقة، نسختين مكربن، ترقيم + تخريم', 10, 'receipt_book', 35000, 0, 10, 3, 'none', true, 1, true, 1000, '1024x1536', '15×20', NULL, '[]'::jsonb, NULL, 'دفتر وصولات رسمي مقاس A5، ترويسة وحقول مرقّمة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_package","batch_size":10,"copies":2}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('receipt_a6', 'وصل A6', '📄', 'الباقة 20 دفتر بسعر 35000. كل دفتر 100 ورقة، نسختين مكربن، ترقيم + تخريم', 11, 'receipt_book', 35000, 0, 20, 3, 'none', true, 1, true, 1000, '1024x1536', '15×10', NULL, '[]'::jsonb, NULL, 'دفتر وصولات رسمي مقاس A6، تخطيط مضغوط وواضح. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_package","batch_size":20,"copies":2}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('receipt_dl', 'وصل ثلث A4 (DL)', '📄', 'الباقة 15 دفتر بسعر 35000. كل دفتر 100 ورقة، نسختين مكربن، ترقيم + تخريم', 12, 'receipt_book', 35000, 0, 15, 3, 'none', true, 1, true, 1000, '1024x1536', '10×20', NULL, '[]'::jsonb, NULL, 'دفتر وصولات مقاس ثلث A4 (DL)، ترويسة وحقول مرقّمة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_package","batch_size":15,"copies":2}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_rect_6x4', 'ختم مستطيل 6×4', '📄', 'ختم حبر أوتوماتيك', 13, 'stamps', 30000, 0, 1, 2, 'none', false, 1, true, 1000, '1536x1024', '6×4 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم حبر: اسم الجهة + شعار خطي بسيط + بيانات مختصرة، خط أحادي اللون عالي التباين مناسب للمطاط. بدون تدرجات.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"rectangle"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_rect_5x3', 'ختم مستطيل 5×3', '📄', 'ختم حبر أوتوماتيك', 14, 'stamps', 25000, 0, 1, 2, 'none', false, 1, true, 1000, '1536x1024', '5×3 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم حبر بسيط أحادي اللون للمطاط. بدون تدرجات.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"rectangle"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_rect_47x18', 'ختم مستطيل 4.7×1.8', '📄', 'ختم حبر أوتوماتيك', 15, 'stamps', 20000, 0, 1, 2, 'none', false, 1, true, 1000, '1536x1024', '4.7×1.8 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم حبر مستطيل صغير، سطر أو سطرين نص واضح. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"rectangle"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_rect_35x14', 'ختم مستطيل 3.5×1.4', '📄', 'ختم حبر أوتوماتيك', 16, 'stamps', 15000, 0, 1, 2, 'none', false, 1, true, 1000, '1536x1024', '3.5×1.4 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم حبر صغير، نص مضغوط واضح. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"rectangle"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_sq_5x5', 'ختم مربع/دائري 5×5', '📄', 'ختم حبر أوتوماتيك — مربع أو دائري', 17, 'stamps', 30000, 0, 1, 2, 'none', false, 1, true, 1000, '1024x1024', '5×5 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم دائري/مربع: نص محيطي + شعار مركزي، أحادي اللون عالي التباين.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"square_or_round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_sq_4x4', 'ختم مربع/دائري 4×4', '📄', 'ختم حبر أوتوماتيك — مربع أو دائري', 18, 'stamps', 25000, 0, 1, 2, 'none', false, 1, true, 1000, '1024x1024', '4×4 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم دائري/مربع، نص محيطي وشعار مركزي. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"square_or_round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_sq_3x3', 'ختم مربع/دائري 3×3', '📄', 'ختم حبر أوتوماتيك — مربع أو دائري', 19, 'stamps', 20000, 0, 1, 2, 'none', false, 1, true, 1000, '1024x1024', '3×3 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم صغير مربع/دائري، شعار أو أحرف مركزية. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"square_or_round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_sq_2x2', 'ختم مربع/دائري 2×2', '📄', 'ختم حبر أوتوماتيك — مربع أو دائري', 20, 'stamps', 15000, 0, 1, 2, 'none', false, 1, true, 1000, '1024x1024', '2×2 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم صغير جداً، أحرف أو رمز مركزي بسيط. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"square_or_round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_oval_3x45', 'ختم بيضوي 3×4.5', '📄', 'ختم حبر أوتوماتيك — بيضوي', 21, 'stamps', 20000, 0, 1, 2, 'none', false, 1, true, 1000, '1024x1536', '3×4.5 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم بيضوي، نص محيطي وشعار مركزي. أحادي اللون عالي التباين.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"oval"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_oval_35x55', 'ختم بيضوي 3.5×5.5', '📄', 'ختم حبر أوتوماتيك — بيضوي', 22, 'stamps', 25000, 0, 1, 2, 'none', false, 1, true, 1000, '1024x1536', '3.5×5.5 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم بيضوي أكبر، نص محيطي وشعار مركزي. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"oval"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_pocket_35x14', 'ختم جيب 3.5×1.4', '📄', 'ختم جيب', 23, 'stamps', 15000, 0, 1, 2, 'none', false, 1, true, 1000, '1536x1024', '3.5×1.4 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم جيب صغير، نص مضغوط واضح. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"pocket"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_pocket_47x18', 'ختم جيب 4.7×1.8', '📄', 'ختم جيب', 24, 'stamps', 20000, 0, 1, 2, 'none', false, 1, true, 1000, '1536x1024', '4.7×1.8 سم', NULL, '[]'::jsonb, NULL, 'تخطيط ختم جيب، سطر أو سطرين نص. أحادي اللون.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"pocket"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('stamp_color', 'ختم ملوّن', '📄', 'مسعّر أصلاً 50 دولار — حُوّل إلى دينار بسعر صرف 1480', 25, 'stamps', 74000, 0, 1, 3, 'none', false, 1, true, 1000, '1024x1024', 'حسب الطلب', NULL, '[]'::jsonb, NULL, 'تخطيط ختم ملوّن متعدد الألوان، تصميم يستفيد من الحبر الملوّن مع الحفاظ على وضوح الطباعة.

PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1,"shape":"custom","price_usd_original":50}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('sticker_round_3', 'ستيكر دائري 3سم', '📄', 'السعر مقابل 1200 قطعة', 26, 'stickers', 25000, 0, 1200, 3, 'none', true, 1, true, 1000, '1024x1024', '⌀3 سم', NULL, '[]'::jsonb, NULL, 'ستيكر دائري: تصميم دائري متمركز، شعار/رمز واضح، هوامش آمنة للقص. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1200","batch_size":1200,"shape":"round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('sticker_round_4', 'ستيكر دائري 4سم', '📄', 'السعر مقابل 1200 قطعة', 27, 'stickers', 30000, 0, 1200, 3, 'none', true, 1, true, 1000, '1024x1024', '⌀4 سم', NULL, '[]'::jsonb, NULL, 'ستيكر دائري متمركز، شعار واضح وهوامش قص آمنة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1200","batch_size":1200,"shape":"round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('sticker_round_5', 'ستيكر دائري 5سم', '📄', 'السعر مقابل 1200 قطعة', 28, 'stickers', 45000, 0, 1200, 3, 'none', true, 1, true, 1000, '1024x1024', '⌀5 سم', NULL, '[]'::jsonb, NULL, 'ستيكر دائري متمركز، شعار واضح وهوامش قص آمنة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1200","batch_size":1200,"shape":"round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('sticker_round_6', 'ستيكر دائري 6سم', '📄', 'السعر مقابل 1200 قطعة', 29, 'stickers', 55000, 0, 1200, 3, 'none', true, 1, true, 1000, '1024x1024', '⌀6 سم', NULL, '[]'::jsonb, NULL, 'ستيكر دائري متمركز، شعار واضح وهوامش قص آمنة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1200","batch_size":1200,"shape":"round"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('sticker_rect_card', 'ستيكر مستطيل حجم كارت', '📄', 'السعر مقابل 1000 قطعة', 30, 'stickers', 25000, 0, 1000, 3, 'glossy', true, 1, true, 1000, '1536x1024', '5×8.5 سم', NULL, '[]'::jsonb, NULL, 'ستيكر مستطيل بمقاس كارت، تصميم أفقي بشعار وبيانات مختصرة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"shape":"rectangle","lamination_note":"مسلفن"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_16x25_500', 'علاكة 16×25 (500)', '📄', 'السعر مقابل 500 قطعة — شامل التوصيل والتصميم', 31, 'packaging', 60000, 0, 500, 7, 'none', true, 1, true, 1000, '1024x1536', '16×25 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة طباعة لون واحد: شعار كبير + بيانات تواصل، تصميم أحادي اللون متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_500","batch_size":500,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_20x30_500', 'علاكة 20×30 (500)', '📄', 'السعر مقابل 500 قطعة — شامل التوصيل والتصميم', 32, 'packaging', 90000, 0, 500, 7, 'none', true, 1, true, 1000, '1024x1536', '20×30 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_500","batch_size":500,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_25x35_500', 'علاكة 25×35 (500)', '📄', 'السعر مقابل 500 قطعة — شامل التوصيل والتصميم', 33, 'packaging', 100000, 0, 500, 7, 'none', true, 1, true, 1000, '1024x1536', '25×35 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_500","batch_size":500,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_30x40_500', 'علاكة 30×40 (500)', '📄', 'السعر مقابل 500 قطعة — شامل التوصيل والتصميم', 34, 'packaging', 120000, 0, 500, 7, 'none', true, 1, true, 1000, '1024x1536', '30×40 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_500","batch_size":500,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_37x50_500', 'علاكة 37×50 (500)', '📄', 'السعر مقابل 500 قطعة — شامل التوصيل والتصميم', 35, 'packaging', 140000, 0, 500, 7, 'none', true, 1, true, 1000, '1024x1536', '37×50 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_500","batch_size":500,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_16x25_1000', 'علاكة 16×25 (1000)', '📄', 'السعر مقابل 1000 قطعة — شامل التوصيل والتصميم', 36, 'packaging', 75000, 0, 1000, 7, 'none', true, 1, true, 1000, '1024x1536', '16×25 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_20x30_1000', 'علاكة 20×30 (1000)', '📄', 'السعر مقابل 1000 قطعة — شامل التوصيل والتصميم', 37, 'packaging', 110000, 0, 1000, 7, 'none', true, 1, true, 1000, '1024x1536', '20×30 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_25x35_1000', 'علاكة 25×35 (1000)', '📄', 'السعر مقابل 1000 قطعة — شامل التوصيل والتصميم', 38, 'packaging', 125000, 0, 1000, 7, 'none', true, 1, true, 1000, '1024x1536', '25×35 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_30x40_1000', 'علاكة 30×40 (1000)', '📄', 'السعر مقابل 1000 قطعة — شامل التوصيل والتصميم', 39, 'packaging', 145000, 0, 1000, 7, 'none', true, 1, true, 1000, '1024x1536', '30×40 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('bag_37x50_1000', 'علاكة 37×50 (1000)', '📄', 'السعر مقابل 1000 قطعة — شامل التوصيل والتصميم', 40, 'packaging', 180000, 0, 1000, 7, 'none', true, 1, true, 1000, '1024x1536', '37×50 سم', NULL, '[]'::jsonb, NULL, 'علاكة قبضة لون واحد، شعار كبير متباين. جاهز CMYK لون واحد.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"print_colors":1}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('brochure_a4', 'بروشور A4', '📄', 'السعر مقابل 1000 نسخة', 41, 'advertising', 225000, 0, 1000, 4, 'glossy', true, 1, true, 1000, '1024x1536', 'A4', NULL, '[]'::jsonb, NULL, 'بروشور A4 تجاري: خلفية فاتحة، لون مهيمن حسب القطاع، عناوين عربية كبيرة، أقسام منظمة بحاويات مدوّرة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"lamination_note":"حراري"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('brochure_a5', 'بروشور A5', '📄', 'السعر مقابل 1000 نسخة', 42, 'advertising', 160000, 0, 1000, 4, 'glossy', true, 1, true, 1000, '1024x1536', 'A5', NULL, '[]'::jsonb, NULL, 'بروشور A5 تجاري، خلفية فاتحة ولون مهيمن وعناوين عربية كبيرة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"lamination_note":"حراري"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('brochure_4c_1', 'بروشور 4 كارتات وجه', '📄', 'السعر مقابل 1000 نسخة', 43, 'advertising', 60000, 0, 1000, 4, 'glossy', true, 1, true, 1000, '1024x1536', '4 كارتات', NULL, '[]'::jsonb, NULL, 'بروشور بمقاس 4 كارتات وجه واحد، تصميم مضغوط بعناوين واضحة. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"lamination_note":"حراري"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('brochure_4c_2', 'بروشور 4 كارتات وجهين', '📄', 'السعر مقابل 1000 نسخة', 44, 'advertising', 80000, 0, 1000, 4, 'glossy', true, 2, true, 1000, '1024x1536', '4 كارتات', NULL, '[]'::jsonb, NULL, 'بروشور بمقاس 4 كارتات وجهين، تناسق بين الوجهين. جاهز CMYK.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_1000","batch_size":1000,"lamination_note":"حراري"}'::jsonb);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('rollup', 'رول اب', '📄', 'أقل كمية 1', 45, 'banners', 55000, 0, 1, 5, 'none', true, 1, true, 1000, '1024x1536', '80×200 سم', NULL, '[]'::jsonb, NULL, 'رول اب عمودي 80×200: عنوان كبير أعلى، رسالة أساسية وسط، بيانات تواصل أسفل، شعار بارز. تصميم عمودي متدرج القراءة. جاهز CMYK بدقة عالية.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', '{"pricing_unit":"per_unit","batch_size":1}'::jsonb);

-- ── Kept AI-only products (from the pre-reset backup, print-hidden) ──────────────────
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('menu', 'منيو', '🍽️', 'قوائم طعام بتصاميم عصرية', 91, 'advertising', 30000, 15000, 50, 3, 'matte', false, 1, true, 1000, '1024x1536', 'A4 (21×29.7 سم)', NULL, '[]'::jsonb, NULL, 'قائمة طعام (منيو) منظمة بأقسام وأصناف وأسعار، تخطيط أنيق وسهل القراءة مع أيقونات بسيطة عند الحاجة.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no paper floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', NULL);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('flex', 'فلكس إعلاني', '🪧', 'قطع فلكس ولوحات إعلانية بأي قياس', 92, 'banners', 0, 0, 1, 0, 'none', false, 1, true, 1000, '1536x1024', 'حسب الطلب', NULL, '[]'::jsonb, '{"label":"القياس المطلوب (بالسنتيمتر أو بالمتر)","placeholder":"مثال: 3 × 2 متر"}'::jsonb, 'لوحة فلكس إعلانية كبيرة: نص ضخم جداً وواضح يُقرأ من مسافة بعيدة ورسالة أساسية واحدة، تصميم بسيط مع تباين عالٍ.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', NULL);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('doctor_rx', 'راجيتة طبيب', '🩺', 'وصفات طبية (راجيتة) بقياس A5 قياسي', 93, 'office', 0, 0, 1, 0, 'none', false, 1, true, 1000, '1024x1536', 'A5 (14.8×21 سم)', NULL, '[]'::jsonb, NULL, 'وصفة طبية (راجيتة) بقياس A5: ترويسة باسم الطبيب والاختصاص والعيادة، رمز Rx وأسطر للوصفة، تذييل بالعنوان والهاتف، تصميم طبي نظيف وبسيط.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no paper floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.', NULL);
INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, faces, ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, meta)
VALUES ('pen', 'قلم', '🖊️', 'أقلام مطبوعة بشعارك', 94, 'advertising', 1500, 700, 100, 5, 'none', false, 1, true, 1000, '1536x1024', 'شريط ضيق', NULL, '[]'::jsonb, NULL, 'تصميم بسيط جداً للطباعة على قلم: اسم النشاط والشعار فقط ضمن شريط أفقي ضيق، نص قصير وواضح بدون تفاصيل كثيرة.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines; the single line of text must be large and bold.
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no pen object, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.', NULL);
