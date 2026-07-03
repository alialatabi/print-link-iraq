-- AI Design — Print Rules v2 (spec: docs/superpowers/specs/2026-07-03-ai-print-rules-design.md)
--
-- Owner decision: the universal PRINT RULES + OUTPUT FORMAT live in each service's
-- ai_directives (visible/editable in admin > خدمات > توجيهات التصميم), replacing the old
-- one-line generic CMYK boilerplate that was duplicated across all 15 AI products.
-- Color policy (owner): vivid/saturated tones allowed whenever they benefit the design,
-- but NEVER a very dark or predominantly black design/background.
-- The hierarchy line (business name → tagline → badges → location → phones) applies only
-- to identity/ad products; structured documents (menu/letterhead/receipt/Rx/stamp/pen/
-- hanging sign/sticker) keep their own product-specific structure sentence instead.
--
-- Also from the size audit:
--   * file_folder is 50cm wide × 35cm tall (landscape) but was set to a portrait canvas — fixed.
--   * flex / stamp / sticker only said "حسب الطلب" with no input — they now get an
--     ai_custom_size free-text input so the CUSTOMER'S typed size flows into the prompt
--     as the target size (resolveRequest already prefers the typed size).
--
-- NOTE: ai-design-generate's MAX_DIRECTIVES_CHARS is raised to 2500 in the same deploy —
-- these blocks are ~1,300 chars and would otherwise be truncated at 600.

-- ── Identity/ad products (WITH the hierarchy line) ─────────────────────────────────────

UPDATE public.services SET ai_directives = 'بطاقة عمل (كارت) بوجه واحد، تصميم احترافي بسيط ونظيف: الاسم والشعار ومعلومات التواصل بترتيب واضح.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'business_card';

UPDATE public.services SET ai_directives = 'بطاقة عمل (كارت تركي) بوجه واحد، تصميم احترافي فاخر وبسيط: الاسم والشعار ومعلومات التواصل بترتيب واضح.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'e6b7de07-d6c1-4c0b-88e6-c603c02990bc';

UPDATE public.services SET ai_directives = 'بطاقة عمل (كارت) بوجهين أمامي وخلفي — اعرض الوجهين جنباً إلى جنب في نفس الصورة، تصميم احترافي بسيط.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom (on each face): business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'vip_card';

UPDATE public.services SET ai_directives = 'غلاف حافظة/فولدر مؤسسي بسيط: الشعار واسم النشاط بوضوح وألوان هادئة ومساحات نظيفة.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'file_folder';

UPDATE public.services SET ai_directives = 'غلاف حافظة ماستر مؤسسي بسيط: الشعار واسم النشاط بوضوح وألوان هادئة ومساحات نظيفة.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'master_folder';

UPDATE public.services SET ai_directives = 'لوحة فلكس إعلانية كبيرة: نص ضخم جداً وواضح يُقرأ من مسافة بعيدة ورسالة أساسية واحدة، تصميم بسيط مع تباين عالٍ.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'flex';

UPDATE public.services SET ai_directives = 'بانر رول-أب عمودي طويل: العنوان والرسالة الأساسية بخط ضخم يُقرأ من بعيد، الشعار أعلى أو أسفل، تصميم بسيط ونظيف.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no card floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'rollup';

-- ── Structured documents (their own structure line instead of the generic hierarchy) ───

UPDATE public.services SET ai_directives = 'قائمة طعام (منيو) منظمة بأقسام وأصناف وأسعار، تخطيط أنيق وسهل القراءة مع أيقونات بسيطة عند الحاجة.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no paper floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'menu';

UPDATE public.services SET ai_directives = 'ترويسة/فورما رسمية: اسم النشاط والشعار أعلى الصفحة ومعلومات التواصل في التذييل مع مساحة بيضاء واسعة للكتابة، تصميم رسمي بسيط.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no paper floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'letterhead';

UPDATE public.services SET ai_directives = 'وصفة طبية (راجيتة) بقياس A5: ترويسة باسم الطبيب والاختصاص والعيادة، رمز Rx وأسطر للوصفة، تذييل بالعنوان والهاتف، تصميم طبي نظيف وبسيط.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no paper floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'doctor_rx';

UPDATE public.services SET ai_directives = 'وصل/فاتورة رسمية بجدول (التفاصيل، العدد، السعر المفرد، المبلغ الكلي) وترويسة باسم النشاط والهاتف والتاريخ، تخطيط نظيف ومنظم.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no paper floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'receipt_book';

UPDATE public.services SET ai_directives = 'ختم حبر رسمي باللون الأزرق فقط، حدود واضحة (مستطيلة أو مربعة أو دائرية) ونص كبير مقروء جداً، بدون صور أو تدرجات أو تعبئة، خلفية بيضاء بالكامل.

PRINT RULES:
- Single-color blue ink only (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.'
WHERE id = 'stamp';

UPDATE public.services SET ai_directives = 'ملصق (ستيكر) بتصميم بسيط وجذّاب: شعار بارز ونص كبير واضح وأشكال نظيفة، الاسم ورقم الهاتف هما الأولوية.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no sticker peeling off a surface, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'sticker';

UPDATE public.services SET ai_directives = 'تصميم بسيط جداً للطباعة على قلم: اسم النشاط والشعار فقط ضمن شريط أفقي ضيق، نص قصير وواضح بدون تفاصيل كثيرة.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines; the single line of text must be large and bold.
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no pen object, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.'
WHERE id = 'pen';

UPDATE public.services SET ai_directives = 'علاقة باب عمودية: رسالة قصيرة بخط كبير جداً (اسم النشاط أو عبارة مثل مفتوح أو مغلق)، تصميم بسيط وجذّاب.

PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no hanger on a door, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.'
WHERE id = 'hanging_sign';

-- ── Size audit fixes ────────────────────────────────────────────────────────────────────

-- file_folder is 50cm WIDE × 35cm TALL (landscape); the portrait canvas was wrong.
UPDATE public.services SET ai_canvas = '1536x1024' WHERE id = 'file_folder';

-- "حسب الطلب" products get a free-text size input; the typed size becomes the prompt's
-- target size (resolveRequest prefers the typed custom size over the static label).
UPDATE public.services SET ai_custom_size = '{"label":"القياس المطلوب (بالسنتيمتر أو بالمتر)","placeholder":"مثال: 3 × 2 متر"}'::jsonb WHERE id = 'flex';
UPDATE public.services SET ai_custom_size = '{"label":"قياس الختم (سم)","placeholder":"مثال: 4 × 4 سم"}'::jsonb WHERE id = 'stamp';
UPDATE public.services SET ai_custom_size = '{"label":"قياس اللاصق (سم)","placeholder":"مثال: 10 × 5 سم"}'::jsonb WHERE id = 'sticker';
