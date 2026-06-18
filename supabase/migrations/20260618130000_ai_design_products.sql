-- New product categories for the AI-design + catalog expansion (2026-06-18).
-- Single/double-sided cards reuse existing 'business_card'; receipt design reuses 'receipt'.
INSERT INTO public.services (id, label, icon, description, sort_order) VALUES
  ('stamp',        'أختام',          '🔖', 'تصميم وطباعة أختام حبر باللون الأزرق بأشكال وقياسات متعددة', 7),
  ('sticker',      'لاصقات',         '🏷️', 'لاصقات دائرية ومستطيلة بقياسات مختلفة', 8),
  ('flex',         'فلكس إعلاني',    '🪧', 'قطع فلكس ولوحات إعلانية بأي قياس', 9),
  ('doctor_rx',    'راجيتة طبيب',    '🩺', 'وصفات طبية (راجيتة) بقياس A5 قياسي', 10)
ON CONFLICT (id) DO NOTHING;
