import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DbService } from '@/hooks/useServices';
import {
  allowedOptions,
  tierQtyLabel,
  type ServiceVariant,
  type VariantAttribute,
  type VariantSelection,
  type VariantTier,
} from '@/types/variants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─────────────────────────────────────────────────────────────────────────────
// Shared variant-tier picker: group (optional) → variant (size/shape) → tier
// (qty/price) → product-wide attribute Selects (ink color, bag color…), in
// that cascade order. See the VARIANTPICKER CONTRACT for the full behavior
// spec this implements.
//
// `value`/`onChange` behave as an "output mirror": the picker owns its own
// draft (partial) selection internally — the parent can only ever hold either
// `null` (incomplete) or a fully-resolved `VariantSelection`, so there is no
// well-defined partial state to feed back in. `value` is accepted to satisfy
// the shared prop contract (and to keep the component's public API stable for
// any future controlled/pre-filled use) but is not read here.
// ─────────────────────────────────────────────────────────────────────────────

interface VariantPickerProps {
  service: DbService;
  variants: ServiceVariant[];
  value: VariantSelection | null;
  onChange: (sel: VariantSelection) => void;
  discountPct?: number;
  disabled?: boolean;
  compact?: boolean;
}

interface RawTierPick {
  variantId: string;
  qty: number;
}

const EMPTY_ATTRIBUTES: VariantAttribute[] = [];

const round = (n: number) => Math.round(n);

/**
 * The tier price the customer is charged after `discountPct` — MUST use the same
 * rounding (`Math.round`) as `buildVariantPricingSnapshot` in src/lib/orderPricing.ts
 * so the on-screen price always equals the stored `pricing.line_total` (money parity).
 */
export function discountedTierPrice(tier: VariantTier, discountPct: number): number {
  return discountPct > 0 ? round(tier.price * (1 - discountPct / 100)) : tier.price;
}

/**
 * Walk `attributes` in array order, keeping each attribute's previous pick only if it's
 * still within its (cascade-restricted via `allowedOptions`) allowed set, auto-selecting
 * when exactly one option remains. Pure — safe to re-derive from scratch on every pick,
 * which is exactly what gives us "changing an earlier attribute clears later selections
 * that became invalid" for free.
 */
function deriveAttrs(attributes: VariantAttribute[], picks: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const attr of attributes) {
    const options = allowedOptions(attributes, attr, result);
    const picked = picks[attr.id];
    if (picked && options.some(o => o.id === picked)) {
      result[attr.id] = picked;
    } else if (options.length === 1) {
      result[attr.id] = options[0].id;
    }
  }
  return result;
}

// Chips: rounded-xl bordered buttons; selected = border-primary + soft ring, matching the
// repo's active-state idiom (see AdminAiDesigns/AdminTemplates selection cards). Minimum
// 40px touch target regardless of `compact`.
function chipClass(selected: boolean, compact?: boolean) {
  return cn(
    'min-h-10 rounded-xl border-2 text-center font-bold leading-tight transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
    selected
      ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary'
      : 'border-border bg-background text-foreground hover:border-primary/40',
  );
}

const VariantPicker = ({
  service,
  variants,
  onChange,
  discountPct = 0,
  disabled,
  compact,
}: VariantPickerProps) => {
  const attributesList = useMemo(() => service.variant_attributes ?? EMPTY_ATTRIBUTES, [service.variant_attributes]);

  // Group chips — unique group_label values, in the order they first appear (variants are
  // already sort_order-sorted upstream by useServiceVariants).
  const groupLabels: string[] = [];
  for (const v of variants) {
    if (v.group_label && !groupLabels.includes(v.group_label)) groupLabels.push(v.group_label);
  }
  const hasGroups = groupLabels.length > 0;

  const [rawGroup, setRawGroup] = useState<string | null>(null);
  const [rawVariantId, setRawVariantId] = useState<string | null>(null);
  const [rawTier, setRawTier] = useState<RawTierPick | null>(null);
  const [rawAttrs, setRawAttrs] = useState<Record<string, string>>({});
  const firedKeyRef = useRef<string | null>(null);

  // Reset the whole draft whenever the underlying service changes (a different product) —
  // this component instance stays mounted across template navigations that share a service.
  useEffect(() => {
    setRawGroup(null);
    setRawVariantId(null);
    setRawTier(null);
    setRawAttrs({});
    firedKeyRef.current = null;
  }, [service.id]);

  // Auto-select single options.
  const effectiveGroup = hasGroups
    ? (rawGroup && groupLabels.includes(rawGroup) ? rawGroup : (groupLabels.length === 1 ? groupLabels[0] : null))
    : null;

  const filteredVariants = hasGroups
    ? (effectiveGroup ? variants.filter(v => v.group_label === effectiveGroup) : [])
    : variants;

  const explicitVariant = rawVariantId ? filteredVariants.find(v => v.id === rawVariantId) : undefined;
  const effectiveVariant: ServiceVariant | null =
    explicitVariant ?? (filteredVariants.length === 1 ? filteredVariants[0] : null);

  // Variant change resets tier to first: `rawTier` is scoped to the variant it was picked
  // under, so it's simply ignored (falls back to tiers[0]) once the effective variant differs.
  const effectiveTier: VariantTier | null = effectiveVariant
    ? (rawTier && rawTier.variantId === effectiveVariant.id
      ? effectiveVariant.tiers.find(t => t.qty === rawTier.qty) ?? effectiveVariant.tiers[0] ?? null
      : effectiveVariant.tiers[0] ?? null)
    : null;

  const effectiveAttrs = useMemo(() => deriveAttrs(attributesList, rawAttrs), [attributesList, rawAttrs]);

  const isComplete = Boolean(
    effectiveVariant && effectiveTier && attributesList.every(a => effectiveAttrs[a.id]),
  );

  // Fire onChange only when a complete selection is reached, and only once per distinct
  // selection (a stable string key dedupes re-renders / parent callback identity churn).
  useEffect(() => {
    if (!isComplete || !effectiveVariant || !effectiveTier) return;
    const attrKey = Object.entries(effectiveAttrs)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    const key = `${effectiveVariant.id}::${effectiveTier.qty}::${attrKey}`;
    if (firedKeyRef.current === key) return;
    firedKeyRef.current = key;
    onChange({ variant: effectiveVariant, tier: effectiveTier, attributes: effectiveAttrs });
  }, [isComplete, effectiveVariant, effectiveTier, effectiveAttrs, onChange]);

  const pickGroup = (g: string) => {
    if (disabled) return;
    setRawGroup(g);
    setRawVariantId(null);
    setRawTier(null);
  };
  const pickVariant = (v: ServiceVariant) => {
    if (disabled) return;
    setRawVariantId(v.id);
    setRawTier(null); // reset tier to first on variant change
  };
  const pickTier = (t: VariantTier) => {
    if (disabled || !effectiveVariant) return;
    setRawTier({ variantId: effectiveVariant.id, qty: t.qty });
  };
  const pickAttr = (attrId: string, optionId: string) => {
    if (disabled) return;
    setRawAttrs(prev => deriveAttrs(attributesList, { ...prev, [attrId]: optionId }));
  };

  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {hasGroups && (
        <div>
          <p className={cn('font-semibold text-muted-foreground mb-2', compact ? 'text-[11px]' : 'text-xs')}>
            الشكل
          </p>
          <div className="flex flex-wrap gap-2">
            {groupLabels.map(g => (
              <button
                key={g}
                type="button"
                disabled={disabled}
                onClick={() => pickGroup(g)}
                className={chipClass(effectiveGroup === g, compact)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {(!hasGroups || effectiveGroup) && filteredVariants.length > 0 && (
        <div>
          <p className={cn('font-semibold text-muted-foreground mb-2', compact ? 'text-[11px]' : 'text-xs')}>
            النوع
          </p>
          <div className="flex flex-wrap gap-2">
            {filteredVariants.map(v => (
              <button
                key={v.id}
                type="button"
                disabled={disabled}
                onClick={() => pickVariant(v)}
                className={chipClass(effectiveVariant?.id === v.id, compact)}
              >
                <span className="block">{v.label}</span>
                {v.size_label && (
                  <span className="block text-[10px] font-normal opacity-70">{v.size_label}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {effectiveVariant && effectiveVariant.tiers.length > 0 && (
        <div>
          <p className={cn('font-semibold text-muted-foreground mb-2', compact ? 'text-[11px]' : 'text-xs')}>
            الكمية
          </p>
          <div className="flex flex-wrap gap-2">
            {effectiveVariant.tiers.map(t => {
              const selected = effectiveTier?.qty === t.qty;
              const discounted = discountedTierPrice(t, discountPct);
              return (
                <button
                  key={t.qty}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickTier(t)}
                  className={chipClass(selected, compact)}
                >
                  <span className="block">{tierQtyLabel(t, effectiveVariant.unit_label)}</span>
                  <span className="flex items-center justify-center gap-1 mt-0.5">
                    <span className={discountPct > 0 ? 'text-success' : undefined}>
                      {discounted.toLocaleString('en-US')} د.ع
                    </span>
                    {discountPct > 0 && (
                      <span className="text-[10px] text-destructive line-through font-normal">
                        {t.price.toLocaleString('en-US')}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {attributesList.map(attr => {
        const options = allowedOptions(attributesList, attr, effectiveAttrs);
        return (
          <div key={attr.id}>
            <label className={cn('font-semibold text-muted-foreground mb-2 block', compact ? 'text-[11px]' : 'text-xs')}>
              {attr.label}
            </label>
            <Select
              dir="rtl"
              disabled={disabled || options.length === 0}
              value={effectiveAttrs[attr.id] ?? ''}
              onValueChange={val => pickAttr(attr.id, val)}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder={`اختر ${attr.label}`} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {options.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
};

export default VariantPicker;
