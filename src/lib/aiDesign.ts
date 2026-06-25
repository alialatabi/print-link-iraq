import { supabase } from '@/integrations/supabase/client';
import type { PricingSnapshot } from '@/lib/orderPricing';

/**
 * AI Design feature helpers.
 *
 * Flow: customer writes a brief -> `ai-design-generate` edge function (GPT-5.5 rewrites the brief
 * into a CMYK-print-safe prompt, then gpt-image-2 generates an image) -> customer accepts ->
 * we create a normal order + order_item so the existing designer pipeline finalizes it for print.
 */

export type AiCanvasSize = '1024x1024' | '1536x1024' | '1024x1536';

/** One choice in a product's cascading selector (orientation or size). */
export interface AiProductOption {
  id: string;
  label: string;        // Arabic label shown in the dropdown
  sizeLabel: string;    // print-size hint, e.g. 'A5 (14.8×21 سم)'
  canvas: AiCanvasSize; // canvas this option renders on
}

export interface AiProductType {
  id: string;
  label: string;        // Arabic
  /** default canvas when the product has no options / uses a custom size */
  canvas: AiCanvasSize;
  /** size hint shown when the product has a single fixed size (no options/customSize) */
  sizeLabel?: string;
  /** label for the cascading selector, e.g. 'اتجاه الكارت' or 'قياس الوصل' */
  optionLabel?: string;
  /** cascading options; when present the user MUST pick one */
  options?: AiProductOption[];
  /** when present, show a free-text size input (Arabic label + placeholder) */
  customSize?: { label: string; placeholder: string };
  /** product-specific design directives appended to the generation prompt (Arabic) */
  directives?: string;
  /** price (IQD) shown in the dropdown and charged for this AI design; from the admin catalog */
  price?: number;
}

/** Product types offered on the standalone AI Design page. */
export const AI_PRODUCT_TYPES: AiProductType[] = [
  { id: 'flyer', label: 'فلاير / منشور', canvas: '1024x1536', sizeLabel: 'A5 (14.8×21 سم)' },
  { id: 'poster', label: 'بوستر', canvas: '1024x1536', sizeLabel: 'A3 (29.7×42 سم)' },
  { id: 'menu', label: 'منيو', canvas: '1024x1536', sizeLabel: 'A4 (21×29.7 سم)' },
  { id: 'letterhead', label: 'ترويسة رسمية', canvas: '1536x1024', sizeLabel: 'A4 أفقي' },
  { id: 'roll_up', label: 'رول أب', canvas: '1024x1536', sizeLabel: '85×200 سم' },
  // كارت وجه واحد — orientation selector
  {
    id: 'card_single', label: 'كارت وجه واحد', canvas: '1536x1024',
    optionLabel: 'اتجاه الكارت',
    options: [
      { id: 'landscape', label: 'بالعرض', sizeLabel: '9×5 سم أفقي', canvas: '1536x1024' },
      { id: 'portrait',  label: 'بالطول', sizeLabel: '5×9 سم عمودي', canvas: '1024x1536' },
    ],
    directives: 'بطاقة عمل (كارت) بوجه واحد، تصميم احترافي بسيط.',
  },
  // كارت وجهين
  {
    id: 'card_double', label: 'كارت وجهين', canvas: '1536x1024',
    optionLabel: 'اتجاه الكارت',
    options: [
      { id: 'landscape', label: 'بالعرض', sizeLabel: '9×5 سم أفقي', canvas: '1536x1024' },
      { id: 'portrait',  label: 'بالطول', sizeLabel: '5×9 سم عمودي', canvas: '1024x1536' },
    ],
    directives: 'بطاقة عمل (كارت) بوجهين أمامي وخلفي — اعرض الوجهين جنباً إلى جنب في نفس الصورة.',
  },
  // تصميم وصل
  {
    id: 'receipt_design', label: 'تصميم وصل', canvas: '1024x1536',
    optionLabel: 'قياس الوصل',
    options: [
      { id: 'a4', label: 'A4', sizeLabel: 'A4 (21×29.7 سم)', canvas: '1024x1536' },
      { id: 'a5', label: 'A5', sizeLabel: 'A5 (14.8×21 سم)', canvas: '1024x1536' },
      { id: 'a6', label: 'A6', sizeLabel: 'A6 (10.5×14.8 سم)', canvas: '1024x1536' },
      { id: 'dl', label: 'DL', sizeLabel: 'DL (9.9×21 سم)', canvas: '1024x1536' },
    ],
    directives: 'وصل/فاتورة رسمية بجدول (التفاصيل، العدد، السعر المفرد، المبلغ الكلي) وترويسة باسم النشاط والهاتف والتاريخ، تخطيط نظيف.',
  },
  // تصميم ختم — blue only, sizes from the reference image
  {
    id: 'stamp', label: 'تصميم ختم', canvas: '1024x1024',
    optionLabel: 'قياس الختم',
    options: [
      { id: 'rect_6x4',    label: 'مستطيل 6×4 سم',     sizeLabel: '6×4 سم',     canvas: '1536x1024' },
      { id: 'rect_5x3',    label: 'مستطيل 5×3 سم',     sizeLabel: '5×3 سم',     canvas: '1536x1024' },
      { id: 'rect_47x18',  label: 'مستطيل 4.7×1.8 سم', sizeLabel: '4.7×1.8 سم', canvas: '1536x1024' },
      { id: 'rect_35x14',  label: 'مستطيل 3.5×1.4 سم', sizeLabel: '3.5×1.4 سم', canvas: '1536x1024' },
      { id: 'sq_5x5',      label: 'مربع/دائري 5×5 سم', sizeLabel: '5×5 سم', canvas: '1024x1024' },
      { id: 'sq_4x4',      label: 'مربع/دائري 4×4 سم', sizeLabel: '4×4 سم', canvas: '1024x1024' },
      { id: 'sq_3x3',      label: 'مربع/دائري 3×3 سم', sizeLabel: '3×3 سم', canvas: '1024x1024' },
      { id: 'sq_2x2',      label: 'مربع/دائري 2×2 سم', sizeLabel: '2×2 سم', canvas: '1024x1024' },
      { id: 'oval_3x45',   label: 'بيضوي 3×4.5 سم',    sizeLabel: '3×4.5 سم',   canvas: '1024x1536' },
      { id: 'oval_35x55',  label: 'بيضوي 3.5×5.5 سم',  sizeLabel: '3.5×5.5 سم', canvas: '1024x1536' },
      { id: 'pocket_35x14',label: 'ختم جيب 3.5×1.4 سم',sizeLabel: '3.5×1.4 سم', canvas: '1536x1024' },
      { id: 'pocket_47x18',label: 'ختم جيب 4.7×1.8 سم',sizeLabel: '4.7×1.8 سم', canvas: '1536x1024' },
    ],
    directives: 'ختم حبر رسمي باللون الأزرق فقط (single-color blue ink). خطوط واضحة وحدود حسب القياس (مستطيلة/مربعة/دائرية/بيضوية)، نص كبير ومقروء جداً، بدون صور أو تدرجات أو تعبئة، خلفية بيضاء.',
  },
  // لاصق دائري — diameter dropdown 3..10 cm
  {
    id: 'sticker_circle', label: 'لاصق دائري', canvas: '1024x1024',
    optionLabel: 'قطر اللاصق',
    options: [3,4,5,6,7,8,9,10].map((n) => ({
      id: `d${n}`, label: `${n} سم`, sizeLabel: `دائري قطر ${n} سم`, canvas: '1024x1024' as const,
    })),
    directives: 'لاصق دائري (ستيكر) — تصميم بسيط ونص كبير واضح. اجعل خلفية/لون التصميم يمتد خارج حافة الدائرة بمقدار 0.5 سم (full bleed) ليملأ كامل الصورة المربعة حتى الحواف بلا أي هامش أبيض. لا تُظهر أي خطوط قص أو حدود bleed أو علامات قص (crop/trim marks) أو مساطر أو أرقام أو قيم قياس على التصميم. أبقِ النصوص والشعار ضمن منطقة آمنة بعيداً عن الحافة.',
  },
  // لاصق مستطيل — custom size text
  {
    id: 'sticker_rect', label: 'لاصق مستطيل', canvas: '1536x1024',
    customSize: { label: 'القياس المطلوب (الطول × العرض بالسنتيمتر)', placeholder: 'مثال: 10 × 5 سم' },
    directives: 'لاصق مستطيل (ستيكر) — تصميم بسيط ونص كبير واضح.',
  },
  // قطعة فلكس إعلانية أو لاصق — custom size text
  {
    id: 'flex', label: 'قطعة فلكس إعلانية أو لاصق', canvas: '1536x1024',
    customSize: { label: 'القياس المطلوب (بالسنتيمتر أو بالمتر)', placeholder: 'مثال: 3 × 2 متر' },
    directives: 'لوحة فلكس إعلانية كبيرة الحجم — نص ضخم جداً وواضح يُقرأ من بعيد، تصميم بسيط، تركيز على الرسالة الأساسية.',
  },
  // راجيتة طبيب — fixed A5
  {
    id: 'doctor_rx', label: 'راجيتة طبيب', canvas: '1024x1536', sizeLabel: 'A5 (14.8×21 سم)',
    directives: 'وصفة طبية (راجيتة) بقياس A5 قياسي — ترويسة باسم الطبيب والاختصاص والعيادة، رمز Rx، أسطر للوصفة، تذييل بالعنوان والهاتف. تصميم نظيف طبي بألوان فاتحة ونص كبير واضح.',
  },
];

export interface AiDesignRequest {
  productType: string;
  productLabel: string;
  sizeLabel: string;
  canvasSize: AiCanvasSize;
  directives: string;
}

/**
 * Resolve the canvas + size label + directives for a product, the chosen option id (if the
 * product has options), and the typed custom size (if the product has a customSize input).
 * Pure (no I/O) so it is unit-testable.
 */
export function resolveRequest(
  product: AiProductType,
  optionId?: string,
  customSize?: string,
): AiDesignRequest {
  const option = product.options?.find((o) => o.id === optionId);
  const canvasSize = option?.canvas ?? product.canvas;
  let sizeLabel: string;
  if (option) sizeLabel = option.sizeLabel;
  else if (product.customSize && customSize?.trim()) sizeLabel = customSize.trim();
  else sizeLabel = product.sizeLabel ?? canvasSize;
  return {
    productType: product.id,
    productLabel: product.label,
    sizeLabel,
    canvasSize,
    directives: product.directives ?? '',
  };
}

/** Row shape from the admin-managed `ai_products` table. */
export interface AiProductRow {
  id: string;
  label: string;
  canvas: string;
  size_label: string | null;
  option_label: string | null;
  options: unknown;        // jsonb: [{id,label,sizeLabel,canvas}]
  custom_size: unknown;    // jsonb: {label,placeholder} | null
  directives: string | null;
  price: number | null;
  sort_order: number;
  active: boolean;
}

const AI_CANVASES: AiCanvasSize[] = ['1024x1024', '1536x1024', '1024x1536'];
const asCanvas = (v: unknown): AiCanvasSize =>
  typeof v === 'string' && (AI_CANVASES as string[]).includes(v) ? (v as AiCanvasSize) : '1024x1024';

/** Parse a jsonb options array into typed AiProductOptions. */
function parseAiOptions(raw: unknown): AiProductOption[] {
  const rawOptions = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  return rawOptions
    .filter((o) => o && typeof o.id === 'string' && typeof o.label === 'string')
    .map((o) => ({
      id: String(o.id),
      label: String(o.label),
      sizeLabel: String(o.sizeLabel ?? ''),
      canvas: asCanvas(o.canvas),
    }));
}

/** Parse a jsonb custom-size object into the {label,placeholder} shape (or undefined). */
function parseCustomSize(raw: unknown): { label: string; placeholder: string } | undefined {
  const cs = raw as Record<string, unknown> | null;
  return cs && typeof cs.label === 'string'
    ? { label: String(cs.label), placeholder: String(cs.placeholder ?? '') }
    : undefined;
}

/** Map an `ai_products` DB row to the runtime AiProductType used by the page + prompt. Pure. */
export function dbRowToAiProduct(row: AiProductRow): AiProductType {
  const options = parseAiOptions(row.options);
  return {
    id: row.id,
    label: row.label,
    canvas: asCanvas(row.canvas),
    sizeLabel: row.size_label || undefined,
    optionLabel: row.option_label || undefined,
    options: options.length ? options : undefined,
    customSize: parseCustomSize(row.custom_size),
    directives: row.directives || undefined,
    price: typeof row.price === 'number' ? row.price : undefined,
  };
}

/** Shape of the `ai_*` columns read off a `services` row (AI catalog now lives in services). */
export interface AiServiceRow {
  id: string;
  label: string;
  ai_enabled?: boolean | null;
  ai_fee?: number | null;
  ai_canvas?: string | null;
  ai_size_label?: string | null;
  ai_option_label?: string | null;
  ai_options?: unknown;       // jsonb
  ai_custom_size?: unknown;   // jsonb
  ai_directives?: string | null;
}

/** Map a `services` row's `ai_*` fields to the runtime AiProductType. Pure. */
export function dbServiceToAiProduct(row: AiServiceRow): AiProductType {
  const options = parseAiOptions(row.ai_options);
  return {
    id: row.id,
    label: row.label,
    canvas: asCanvas(row.ai_canvas),
    sizeLabel: row.ai_size_label || undefined,
    optionLabel: row.ai_option_label || undefined,
    options: options.length ? options : undefined,
    customSize: parseCustomSize(row.ai_custom_size),
    directives: row.ai_directives || undefined,
    price: typeof row.ai_fee === 'number' ? row.ai_fee : undefined,
  };
}

/**
 * Map a product type to the gpt-image-2 canvas size. Kept in sync with the edge function's
 * `sizeForProduct`; exported as a pure function so it can be unit-tested.
 */
export function sizeForProduct(productType: string): string {
  const product = AI_PRODUCT_TYPES.find((p) => p.id === productType);
  if (product) return product.canvas;
  switch (productType) {
    case 'business_card':
    case 'banner':
    case 'letterhead':
      return '1536x1024'; // landscape
    case 'flyer':
    case 'menu':
    case 'invitation':
    case 'poster':
    case 'roll_up':
      return '1024x1536'; // portrait
    default:
      return '1024x1024'; // square (logo / social / generic)
  }
}

export interface GenerateResult {
  imageDataUrl: string;
  rewrittenPrompt: string;
  generationId: string | null;
  remaining: number;
}

/** Invoke the edge function to generate an AI design. Throws an Error (Arabic message) on failure. */
export async function generateAiDesign(params: {
  brief: string;
  productType: string;
  productLabel: string;
  sizeLabel: string;
  canvasSize: AiCanvasSize;
  directives: string;
  /** optional reference/logo images (base64 data URLs) composited into the design */
  referenceImages?: string[];
}): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke('ai-design-generate', {
    body: params,
  });
  if (error) {
    // supabase-js collapses any non-2xx into a FunctionsHttpError whose generic message hides the
    // real reason. The raw Response is on `error.context` — read the function's own `{ error }`
    // body (e.g. the daily-limit message) so the user sees it instead of the wrapper text.
    let message = (error as { message?: string })?.message || 'فشل توليد التصميم';
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      try {
        const body = await (ctx as Response).json();
        if (body?.error) message = body.error as string;
      } catch { /* keep the fallback message */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.imageDataUrl) throw new Error('لم يتم توليد صورة');
  return data as GenerateResult;
}

/** Flat fee (IQD) charged for any AI-designed item, in any order. */
export const AI_DESIGN_FEE = 1000;

/** Payload carried on a cart item created from an accepted AI design. */
export interface AiCartPayload {
  brief: string;
  productType: string;
  productLabel: string;
  sizeLabel: string;
  rewrittenPrompt: string;
  imageUrl: string; // already-uploaded public URL (not a data URL)
}

/**
 * Upload an accepted AI design (data URL) to the public `order-attachments` bucket and return
 * its public URL. Done at accept time so the cart stores a small URL, not a ~2MB data URL.
 */
export async function uploadAiDraftImage(userId: string, imageDataUrl: string): Promise<string> {
  const blob = await (await fetch(imageDataUrl)).blob();
  const path = `ai-drafts/${userId}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from('order-attachments')
    .upload(path, blob, { contentType: 'image/png' });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);
  return publicUrl;
}

export interface AiOrderItemDetails {
  details: string;
  attachment_urls: string[];
  quantity: number;
  is_ai_design: true;
  ai_prompt: string;
  product_type: string;
  service_label: string;
  size_label?: string;
  /** AI design fee recorded on the item so any order view can show it. */
  unit_price: number;
  /** Immutable pricing snapshot read by accounting (AI is a flat fee, no catalog cost). */
  pricing: PricingSnapshot;
  /** set when the customer asked a human designer to edit the AI design */
  needs_human_edit?: boolean;
  edit_request?: string;
}

/**
 * Shape the `order_items.details` JSON for an AI design. Pure (no I/O) so it is unit-testable.
 * Putting the brief in `details` and the image in `attachment_urls` means the existing designer
 * view renders it with no extra wiring; `is_ai_design`/`ai_prompt` drive the AI-draft label.
 */
export function buildAiOrderItemDetails(args: {
  brief: string;
  productType: string;
  productLabel: string;
  rewrittenPrompt: string;
  imageUrls: string[];
  quantity?: number;
  sizeLabel?: string;
  /** per-product price (IQD) from the admin catalog; defaults to the legacy flat fee */
  unitPrice?: number;
  /** coupon/discount percent (0–100) applied to the AI fee, recorded in the snapshot */
  discountPct?: number;
  /** the customer's requested edits (routes the order to a human designer) */
  editRequest?: string;
}): AiOrderItemDetails {
  const edit = args.editRequest?.trim();
  const qty = args.quantity ?? 1;
  const fee = args.unitPrice ?? AI_DESIGN_FEE;
  const discountPct = args.discountPct ?? 0;
  // AI items are a flat fee with no catalog cost; build the snapshot manually.
  const unitPrice = discountPct > 0 ? Math.round(fee * (1 - discountPct / 100)) : fee;
  const pricing: PricingSnapshot = {
    service_type: args.productType || 'ai_design',
    quantity: qty,
    min_quantity: 1,
    unit_price: unitPrice,
    unit_cost: 0,
    line_total: unitPrice * qty,
    line_cost: 0,
    ...(discountPct > 0 ? { discount_pct: discountPct } : {}),
  };
  return {
    details: args.brief.trim(),
    attachment_urls: args.imageUrls,
    quantity: qty,
    is_ai_design: true,
    ai_prompt: args.rewrittenPrompt,
    product_type: args.productType,
    service_label: args.productLabel,
    size_label: args.sizeLabel,
    unit_price: fee,
    pricing,
    ...(edit ? { needs_human_edit: true, edit_request: edit } : {}),
  };
}

/**
 * Send an AI design to a human designer for edits. Uploads the image, then creates an order +
 * order_item carrying the brief, the AI image and the customer's edit request, with status
 * 'submitted' so it enters the normal designer queue + the existing review/revision loop.
 * Returns the new order id.
 */
export async function createAiEditOrder(args: {
  userId: string;
  brief: string;
  productType: string;
  productLabel: string;
  sizeLabel: string;
  rewrittenPrompt: string;
  imageDataUrl: string;
  editRequest: string;
}): Promise<string> {
  const imageUrl = await uploadAiDraftImage(args.userId, args.imageDataUrl);

  // AI edit orders charge the flat AI fee (qty 1, no catalog cost) — record an immutable snapshot.
  const orderPricing: PricingSnapshot = {
    service_type: args.productType || 'ai_design',
    quantity: 1,
    min_quantity: 1,
    unit_price: AI_DESIGN_FEE,
    unit_cost: 0,
    line_total: AI_DESIGN_FEE,
    line_cost: 0,
  };

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id: args.userId,
      status: 'submitted' as never,
      details: { item_count: 1, order_type: 'ai_design', ai_generated: true, needs_human_edit: true, pricing: orderPricing } as never,
    })
    .select('id')
    .single();
  if (orderErr || !order) throw orderErr || new Error('فشل إنشاء الطلب');

  const { error: itemErr } = await supabase
    .from('order_items' as never)
    .insert({
      order_id: order.id,
      template_id: null,
      status: 'submitted',
      details: buildAiOrderItemDetails({
        brief: args.brief,
        productType: args.productType,
        productLabel: args.productLabel,
        rewrittenPrompt: args.rewrittenPrompt,
        imageUrls: [imageUrl],
        sizeLabel: args.sizeLabel,
        editRequest: args.editRequest,
      }) as never,
    });
  if (itemErr) throw itemErr;

  return order.id as string;
}
