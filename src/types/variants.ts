// ─────────────────────────────────────────────────────────────────────────────
// Product variants — one sub-service (e.g. وصل) carries its sizes/shapes as
// `service_variants` rows, and each variant prices itself through an
// admin-defined list of quantity→price tiers (no formulas: the admin
// enumerates every orderable quantity, per the shop owner's pricing model).
// Product-wide choices that don't change the size/die (stamp ink color, bag
// color…) live as `variant_attributes` JSON on the services row; an attribute
// option can restrict LATER attributes via `allows` (bag color → ink colors).
//
// The generated Supabase types don't include `service_variants` /
// `services.variant_attributes` yet — queries cast with `as never`, the same
// pattern as the AI catalog columns (see useAiProducts).
// ─────────────────────────────────────────────────────────────────────────────

/** One orderable quantity of a variant, priced by the admin by hand. */
export interface VariantTier {
  /** Orderable quantity (pieces, or books for receipts — see `unit_label`). */
  qty: number;
  /** Total price in IQD for this qty, BEFORE any percentage discount. */
  price: number;
  /** Production cost for this qty (accounting/P&L; 0 until the admin sets it). */
  cost?: number;
  /** Free extra units included (stickers: 500 → +100 هدية). */
  gift?: number;
}

/** A size/shape row under a sub-service (maps 1:1 to a `service_variants` row). */
export interface ServiceVariant {
  id: string;
  service_id: string;
  /** 'A4', '16×25', '6×4', 'وجهين' */
  label: string;
  /** Optional first-level grouping the customer picks before the size (stamp shape: 'مستطيل'). */
  group_label: string | null;
  /** Display dimensions, e.g. '21×29.7 سم'. */
  size_label: string | null;
  /** Overrides services.faces for this variant (2 for وجهين variants). */
  faces: number | null;
  /** Arabic unit noun for tier quantities ('دفتر' for receipts); null = pieces. */
  unit_label: string | null;
  tiers: VariantTier[];
  sort_order: number;
  active: boolean;
}

export interface AttributeOption {
  id: string;
  label: string;
  /** Restricts LATER attributes: attrId → allowed option ids. Absent = no restriction. */
  allows?: Record<string, string[]>;
}

/** Product-wide choice (ink color…), stored in services.variant_attributes JSON. */
export interface VariantAttribute {
  id: string; // 'ink_color', 'bag_color'
  label: string; // 'لون الحبر'
  options: AttributeOption[];
}

/** What the customer picked in the VariantPicker (carried picker → cart → order). */
export interface VariantSelection {
  variant: ServiceVariant;
  tier: VariantTier;
  /** attrId → optionId */
  attributes: Record<string, string>;
}

/** Denormalized variant info stored on a cart line and in order details. */
export interface CartVariantInfo {
  variantId: string;
  variantLabel: string;
  groupLabel?: string;
  sizeLabel?: string;
  unitLabel?: string;
  tierQty: number;
  /** Tier price BEFORE discount (for strikethrough display; the charged price lives on the cart line). */
  tierPrice: number;
  tierCost?: number;
  gift?: number;
  faces?: number;
  /** attrId → { label: 'لون الحبر', value: 'أزرق' } — human-readable for staff/receipts. */
  attributes?: Record<string, { label: string; value: string }>;
}

/**
 * Options of `attr` that remain allowed given the selections made on EARLIER
 * attributes (attribute order in the array is the cascade order). An earlier
 * option without an `allows` entry for this attribute imposes no restriction.
 */
export function allowedOptions(
  attributes: VariantAttribute[],
  attr: VariantAttribute,
  selection: Record<string, string>,
): AttributeOption[] {
  const attrIndex = attributes.findIndex(a => a.id === attr.id);
  let options = attr.options;
  for (let i = 0; i < attrIndex; i++) {
    const earlier = attributes[i];
    const chosenId = selection[earlier.id];
    if (!chosenId) continue;
    const chosen = earlier.options.find(o => o.id === chosenId);
    const allowed = chosen?.allows?.[attr.id];
    if (allowed) options = options.filter(o => allowed.includes(o.id));
  }
  return options;
}

/** '500' / '500 + 100 هدية' / '5 دفاتر' — the quantity chip text for a tier. */
export function tierQtyLabel(tier: VariantTier, unitLabel?: string | null): string {
  const qty = tier.qty.toLocaleString('en-US');
  const base = unitLabel ? `${qty} ${unitLabel}` : qty;
  return tier.gift ? `${base} + ${tier.gift.toLocaleString('en-US')} هدية` : base;
}

/** Build the denormalized cart/order payload from a picker selection. */
export function toCartVariantInfo(
  attributes: VariantAttribute[] | null | undefined,
  sel: VariantSelection,
): CartVariantInfo {
  const attrLabels: Record<string, { label: string; value: string }> = {};
  for (const attr of attributes ?? []) {
    const optionId = sel.attributes[attr.id];
    const option = attr.options.find(o => o.id === optionId);
    if (option) attrLabels[attr.id] = { label: attr.label, value: option.label };
  }
  return {
    variantId: sel.variant.id,
    variantLabel: sel.variant.label,
    groupLabel: sel.variant.group_label || undefined,
    sizeLabel: sel.variant.size_label || undefined,
    unitLabel: sel.variant.unit_label || undefined,
    tierQty: sel.tier.qty,
    tierPrice: sel.tier.price,
    tierCost: sel.tier.cost,
    gift: sel.tier.gift,
    faces: sel.variant.faces || undefined,
    attributes: Object.keys(attrLabels).length ? attrLabels : undefined,
  };
}

/** 'مستطيل 6×4' / 'A4' — the full human-readable variant name for staff views. */
export function variantDisplayName(info: Pick<CartVariantInfo, 'groupLabel' | 'variantLabel'>): string {
  return [info.groupLabel, info.variantLabel].filter(Boolean).join(' ');
}
