-- Enable AI design on every real product (leaf service) with a flat 1,000 IQD fee and
-- auto-generated per-product rules (appropriate canvas/size + shape/format directives).
-- Colors (light CMYK, no dark) + text-focus are already enforced globally by the
-- ai-design-generate system prompt; the directives add the per-product shape/format and a
-- short reminder. Overwrite mode: resets any prior per-size options for a uniform result.
-- Category headers (services that have children) are intentionally left non-AI.

-- 1) Enable AI + flat fee on every leaf product; clear size options for a clean overwrite.
UPDATE public.services
SET ai_enabled = true,
    ai_fee = 1000,
    ai_option_label = NULL,
    ai_options = '[]'::jsonb,
    ai_custom_size = NULL
WHERE id NOT IN (SELECT parent_id FROM public.services WHERE parent_id IS NOT NULL);

-- 2) Per-product canvas + size hint + directives.

-- Single-face business cards (كارت وجه / كارت تركي)
UPDATE public.services SET ai_canvas = '1536x1024', ai_size_label = '9×5 سم',
  ai_directives = 'بطاقة عمل (كارت) بوجه واحد، تصميم احترافي بسيط ونظيف: الاسم والشعار ومعلومات التواصل بترتيب واضح. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id IN ('business_card', 'e6b7de07-d6c1-4c0b-88e6-c603c02990bc');

-- Two-sided card (كارت وجهين)
UPDATE public.services SET ai_canvas = '1536x1024', ai_size_label = '9×5 سم (وجهان)',
  ai_directives = 'بطاقة عمل (كارت) بوجهين أمامي وخلفي — اعرض الوجهين جنباً إلى جنب في نفس الصورة، تصميم احترافي بسيط. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'vip_card';

-- Menu (منيو)
UPDATE public.services SET ai_canvas = '1024x1536', ai_size_label = 'A4 (21×29.7 سم)',
  ai_directives = 'قائمة طعام (منيو) منظمة بأقسام وأصناف وأسعار، تخطيط أنيق وسهل القراءة مع أيقونات بسيطة عند الحاجة. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'menu';

-- Letterhead / form (فورما)
UPDATE public.services SET ai_canvas = '1024x1536', ai_size_label = 'A4 (21×29.7 سم)',
  ai_directives = 'ترويسة/فورما رسمية: اسم النشاط والشعار أعلى الصفحة ومعلومات التواصل في التذييل مع مساحة بيضاء واسعة للكتابة، تصميم رسمي بسيط. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'letterhead';

-- Folders (حافظة ماستر / فايل)
UPDATE public.services SET ai_canvas = '1024x1536', ai_size_label = 'A4',
  ai_directives = 'غلاف حافظة/فولدر مؤسسي بسيط: الشعار واسم النشاط بوضوح وألوان هادئة ومساحات نظيفة. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id IN ('master_folder', 'file_folder');

-- Receipt book (دفتر وصل)
UPDATE public.services SET ai_canvas = '1024x1536', ai_size_label = 'A5/A6',
  ai_directives = 'وصل/فاتورة رسمية بجدول (التفاصيل، العدد، السعر المفرد، المبلغ الكلي) وترويسة باسم النشاط والهاتف والتاريخ، تخطيط نظيف ومنظم. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'receipt_book';

-- Pen print (قلم)
UPDATE public.services SET ai_canvas = '1536x1024', ai_size_label = 'شريط ضيق',
  ai_directives = 'تصميم بسيط جداً للطباعة على قلم: اسم النشاط والشعار فقط ضمن شريط أفقي ضيق، نص قصير وواضح بدون تفاصيل كثيرة. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'pen';

-- Stamp (ختم) — blue ink only, white background (its own color rule).
UPDATE public.services SET ai_canvas = '1024x1024', ai_size_label = 'حسب الطلب',
  ai_directives = 'ختم حبر رسمي باللون الأزرق فقط، حدود واضحة (مستطيلة أو مربعة أو دائرية) ونص كبير مقروء جداً، بدون صور أو تدرجات أو تعبئة، خلفية بيضاء بالكامل.'
WHERE id = 'stamp';

-- Sticker (ستيكر لاصق)
UPDATE public.services SET ai_canvas = '1024x1024', ai_size_label = 'حسب الطلب',
  ai_directives = 'ملصق (ستيكر) بتصميم بسيط وجذّاب: شعار بارز ونص كبير واضح وأشكال نظيفة. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'sticker';

-- Door hanger (علاقة)
UPDATE public.services SET ai_canvas = '1024x1536', ai_size_label = 'علاقة باب',
  ai_directives = 'علاقة باب عمودية: رسالة قصيرة بخط كبير جداً (اسم النشاط أو عبارة مثل مفتوح أو مغلق)، تصميم بسيط وجذّاب. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'hanging_sign';

-- Roll-up banner (رول اب)
UPDATE public.services SET ai_canvas = '1024x1536', ai_size_label = '85×200 سم',
  ai_directives = 'بانر رول-أب عمودي طويل: العنوان والرسالة الأساسية بخط ضخم يُقرأ من بعيد، الشعار أعلى أو أسفل، تصميم بسيط ونظيف. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'rollup';

-- Flex advertising banner (فلكس إعلاني)
UPDATE public.services SET ai_canvas = '1536x1024', ai_size_label = 'حسب الطلب',
  ai_directives = 'لوحة فلكس إعلانية كبيرة: نص ضخم جداً وواضح يُقرأ من مسافة بعيدة ورسالة أساسية واحدة، تصميم بسيط مع تباين عالٍ. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'flex';

-- Doctor prescription (راجيتة طبيب)
UPDATE public.services SET ai_canvas = '1024x1536', ai_size_label = 'A5 (14.8×21 سم)',
  ai_directives = 'وصفة طبية (راجيتة) بقياس A5: ترويسة باسم الطبيب والاختصاص والعيادة، رمز Rx وأسطر للوصفة، تذييل بالعنوان والهاتف، تصميم طبي نظيف وبسيط. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id = 'doctor_rx';

-- 3) Safety net: any leaf product still without directives (e.g. an unexpected id) gets a generic rule.
UPDATE public.services SET ai_canvas = COALESCE(ai_canvas, '1024x1536'),
  ai_directives = 'تصميم مطبوع احترافي بسيط ونظيف. استخدم ألوان CMYK فاتحة ومناسبة للطباعة وتجنّب الأسود الغامق والخلفيات الداكنة، واجعل النصوص كبيرة وواضحة ومقروءة جداً وهي العنصر الأساسي في التصميم.'
WHERE id NOT IN (SELECT parent_id FROM public.services WHERE parent_id IS NOT NULL)
  AND (ai_directives IS NULL OR ai_directives = '');
