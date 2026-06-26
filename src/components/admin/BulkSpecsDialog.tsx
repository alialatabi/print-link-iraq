import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DbSpecialization } from '@/hooks/useServices';

interface BulkSpecsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  applyingSpecs: boolean;
  specializations: DbSpecialization[];
  bulkSpecMode: 'replace' | 'add' | 'remove';
  setBulkSpecMode: (mode: 'replace' | 'add' | 'remove') => void;
  bulkSpecs: string[];
  toggleBulkSpec: (id: string) => void;
  setBulkSpecs: (specs: string[]) => void;
  applyBulkSpecs: () => Promise<void>;
}

export function BulkSpecsDialog({
  open, onOpenChange,
  selectedCount, applyingSpecs,
  specializations,
  bulkSpecMode, setBulkSpecMode,
  bulkSpecs, toggleBulkSpec, setBulkSpecs,
  applyBulkSpecs,
}: BulkSpecsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تغيير تخصصات {selectedCount} قالب</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Mode selector */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">طريقة التغيير</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'replace', label: 'استبدال' },
                { key: 'add', label: 'إضافة' },
                { key: 'remove', label: 'إزالة' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setBulkSpecMode(m.key)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    bulkSpecMode === m.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {bulkSpecMode === 'replace' && 'يستبدل تخصصات كل القوالب المحددة بالمختار (اترك الكل فارغاً لمسح التخصصات).'}
              {bulkSpecMode === 'add' && 'يضيف التخصصات المختارة دون حذف الحالية.'}
              {bulkSpecMode === 'remove' && 'يزيل التخصصات المختارة من القوالب المحددة.'}
            </p>
          </div>

          {/* Specializations multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-foreground">التخصصات</label>
              {specializations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = bulkSpecs.length === specializations.length;
                    setBulkSpecs(allSelected ? [] : specializations.map(s => s.id));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {bulkSpecs.length === specializations.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border bg-background min-h-[44px]">
              {specializations.map(s => {
                const selected = bulkSpecs.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleBulkSpec(s.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {s.icon} {s.label}
                  </button>
                );
              })}
              {specializations.length === 0 && (
                <span className="text-xs text-muted-foreground">لا توجد تخصصات</span>
              )}
            </div>
            {bulkSpecs.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{bulkSpecs.length} تخصص محدد</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={applyBulkSpecs} disabled={applyingSpecs} className="flex-1 rounded-xl">
              {applyingSpecs ? 'جاري التطبيق...' : 'تطبيق'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applyingSpecs} className="rounded-xl">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
