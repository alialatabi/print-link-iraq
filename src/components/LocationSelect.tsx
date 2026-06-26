import { useState } from 'react';
import { Check, ChevronsUpDown, Building2, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useAlwaseetCities, useAlwaseetRegions, type AwLocation } from '@/hooks/useAlwaseetLocations';

/** Selected محافظة + منطقة — names (for display/back-compat) plus Al-Waseet ids. */
export interface LocationValue {
  provinceId: number | null;
  provinceName: string;
  areaId: number | null;
  areaName: string;
}

// eslint-disable-next-line react-refresh/only-export-components -- helper co-located with its component by design
export const emptyLocation = (init?: Partial<LocationValue>): LocationValue => ({
  provinceId: init?.provinceId ?? null,
  provinceName: init?.provinceName ?? '',
  areaId: init?.areaId ?? null,
  areaName: init?.areaName ?? '',
});

/** A single searchable combobox over a list of Al-Waseet locations. */
function Combobox({
  items, current, placeholder, searchPlaceholder, emptyText, disabled, loading, onSelect,
}: {
  items: AwLocation[];
  current: { id: number | null; name: string };
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  loading?: boolean;
  onSelect: (item: AwLocation) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal rounded-md h-10', !current.name && 'text-muted-foreground')}
        >
          <span className="truncate">{current.name || placeholder}</span>
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin opacity-50 shrink-0" />
            : <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start" dir="rtl">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="text-right" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => { onSelect(item); setOpen(false); }}
                  className="cursor-pointer"
                >
                  <Check className={cn('ml-2 w-4 h-4', current.id === item.id ? 'opacity-100' : 'opacity-0')} />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Cascading محافظة → منطقة selector sourced from the synced Al-Waseet catalog. Choosing a
 * محافظة loads its مناطق and resets the area. Emits names + ids so callers can persist both.
 */
export default function LocationSelect({
  value, onChange, disabled, className, compact = false,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  disabled?: boolean;
  className?: string;
  /** smaller labels for inline forms (e.g. add-address) */
  compact?: boolean;
}) {
  const { cities, loading: citiesLoading } = useAlwaseetCities();
  const { regions, loading: regionsLoading } = useAlwaseetRegions(value.provinceId);

  const labelCls = compact
    ? 'text-xs text-muted-foreground mb-1.5 flex items-center gap-1'
    : 'text-foreground text-sm font-medium flex items-center gap-2 mb-2';
  const iconCls = compact ? 'w-3 h-3' : 'w-4 h-4 text-muted-foreground';

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      <div>
        <Label className={labelCls}>
          <Building2 className={iconCls} /> المحافظة <span className="text-destructive">*</span>
        </Label>
        <Combobox
          items={cities}
          current={{ id: value.provinceId, name: value.provinceName }}
          placeholder="اختر المحافظة"
          searchPlaceholder="ابحث عن محافظة..."
          emptyText={citiesLoading ? 'جاري التحميل...' : 'لا توجد نتائج'}
          disabled={disabled}
          loading={citiesLoading}
          onSelect={(c) => onChange({ provinceId: c.id, provinceName: c.name, areaId: null, areaName: '' })}
        />
      </div>
      <div>
        <Label className={labelCls}>
          <Navigation className={iconCls} /> المنطقة <span className="text-destructive">*</span>
        </Label>
        <Combobox
          items={regions}
          current={{ id: value.areaId, name: value.areaName }}
          placeholder={value.provinceId ? 'اختر المنطقة' : 'اختر المحافظة أولاً'}
          searchPlaceholder="ابحث عن منطقة..."
          emptyText={regionsLoading ? 'جاري التحميل...' : 'لا توجد نتائج'}
          disabled={disabled || !value.provinceId}
          loading={regionsLoading}
          onSelect={(r) => onChange({ ...value, areaId: r.id, areaName: r.name })}
        />
      </div>
    </div>
  );
}
