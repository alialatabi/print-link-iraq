-- Per-sub-service icons for the launch catalog (categories already had icons in the seed).
-- Emojis chosen for broad Android/iOS/Windows rendering; shapes mirror the physical product
-- (stamp shapes, size-colored dots for round stickers, rolled scroll for the roll-up).

-- كروت
UPDATE public.services SET icon = '🪪' WHERE id = 'card_iq_1';
UPDATE public.services SET icon = '💳' WHERE id = 'card_iq_2';
UPDATE public.services SET icon = '👑' WHERE id = 'card_turkish';
UPDATE public.services SET icon = '🤍' WHERE id = 'card_ivory_1';
UPDATE public.services SET icon = '💠' WHERE id = 'card_ivory_2';

-- مطبوعات إدارية
UPDATE public.services SET icon = '📂' WHERE id = 'master_folder';
UPDATE public.services SET icon = '🗂️' WHERE id = 'file_folder';
UPDATE public.services SET icon = '📄' WHERE id = 'letterhead';
UPDATE public.services SET icon = '🩺' WHERE id = 'doctor_rx';

-- وصولات
UPDATE public.services SET icon = '🧾' WHERE id = 'receipt_a4';
UPDATE public.services SET icon = '📋' WHERE id = 'receipt_a5';
UPDATE public.services SET icon = '🗒️' WHERE id = 'receipt_a6';
UPDATE public.services SET icon = '📑' WHERE id = 'receipt_dl';

-- أختام (شكل الختم)
UPDATE public.services SET icon = '🟦' WHERE id IN ('stamp_rect_6x4','stamp_rect_5x3','stamp_rect_47x18','stamp_rect_35x14');
UPDATE public.services SET icon = '🔘' WHERE id IN ('stamp_sq_5x5','stamp_sq_4x4','stamp_sq_3x3','stamp_sq_2x2');
UPDATE public.services SET icon = '⭕' WHERE id IN ('stamp_oval_3x45','stamp_oval_35x55');
UPDATE public.services SET icon = '👝' WHERE id IN ('stamp_pocket_35x14','stamp_pocket_47x18');
UPDATE public.services SET icon = '🌈' WHERE id = 'stamp_color';

-- ملصقات (نقاط ملوّنة حسب القياس)
UPDATE public.services SET icon = '⚪' WHERE id = 'sticker_round_3';
UPDATE public.services SET icon = '🔵' WHERE id = 'sticker_round_4';
UPDATE public.services SET icon = '🟢' WHERE id = 'sticker_round_5';
UPDATE public.services SET icon = '🟡' WHERE id = 'sticker_round_6';
UPDATE public.services SET icon = '🏷️' WHERE id = 'sticker_rect_card';

-- تغليف (علاكات)
UPDATE public.services SET icon = '🛍️' WHERE id IN ('bag_16x25_500','bag_20x30_500','bag_25x35_500','bag_30x40_500','bag_37x50_500');
UPDATE public.services SET icon = '👜' WHERE id IN ('bag_16x25_1000','bag_20x30_1000','bag_25x35_1000','bag_30x40_1000','bag_37x50_1000');

-- مواد إعلانية
UPDATE public.services SET icon = '📰' WHERE id = 'brochure_a4';
UPDATE public.services SET icon = '🗞️' WHERE id = 'brochure_a5';
UPDATE public.services SET icon = '📃' WHERE id = 'brochure_4c_1';
UPDATE public.services SET icon = '📖' WHERE id = 'brochure_4c_2';
UPDATE public.services SET icon = '🍽️' WHERE id = 'menu';
UPDATE public.services SET icon = '🖊️' WHERE id = 'pen';

-- لوحات وإعلانات
UPDATE public.services SET icon = '📜' WHERE id = 'rollup';
UPDATE public.services SET icon = '🖼️' WHERE id = 'flex';
