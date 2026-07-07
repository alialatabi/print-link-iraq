import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import type { RecurringExpense, RecurringForm } from './types';

const EXPENSE_CATEGORIES = ['إيجار', 'رواتب', 'صيانة', 'مصاريف تشغيلية', 'تسويق', 'نقل وتوصيل', 'عام'];

interface RecurringExpenseDialogsProps {
  // Add/Edit dialog
  recurringDialogOpen: boolean;
  setRecurringDialogOpen: (open: boolean) => void;
  editingRecurring: RecurringExpense | null;
  recurringForm: RecurringForm;
  setRecurringForm: React.Dispatch<React.SetStateAction<RecurringForm>>;
  savingRecurring: boolean;
  handleSaveRecurring: () => Promise<void>;
  // Delete dialog
  recurringToDelete: RecurringExpense | null;
  setRecurringToDelete: (r: RecurringExpense | null) => void;
  deletingRecurring: boolean;
  confirmDeleteRecurring: () => Promise<void>;
}

export function RecurringExpenseDialogs({
  recurringDialogOpen, setRecurringDialogOpen, editingRecurring,
  recurringForm, setRecurringForm, savingRecurring, handleSaveRecurring,
  recurringToDelete, setRecurringToDelete, deletingRecurring, confirmDeleteRecurring,
}: RecurringExpenseDialogsProps) {
  return (
    <>
      {/* ═══ Recurring Expense Dialog ═══ */}
      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingRecurring ? 'تعديل مصروف شهري' : 'إضافة مصروف شهري متكرر'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">العنوان *</label>
              <Input
                value={recurringForm.title}
                onChange={e => setRecurringForm(f => ({ ...f, title: e.target.value }))}
                placeholder="مثال: إيجار المحل، راتب موظف..."
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">المبلغ شهرياً (د.ع) *</label>
                <Input
                  type="number"
                  value={recurringForm.amount || ''}
                  onChange={e => setRecurringForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))}
                  placeholder="500000"
                  className="rounded-xl"
                  dir="ltr"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">الفئة</label>
                <Select value={recurringForm.category} onValueChange={v => setRecurringForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">ملاحظات</label>
              <Textarea
                value={recurringForm.notes}
                onChange={e => setRecurringForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات إضافية..."
                className="rounded-xl min-h-[60px]"
              />
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 cursor-pointer">
              <span className="text-sm font-medium text-foreground">نشط (يُحتسب شهرياً)</span>
              <input
                type="checkbox"
                checked={recurringForm.active}
                onChange={e => setRecurringForm(f => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveRecurring} disabled={savingRecurring} className="flex-1 rounded-xl">
                {savingRecurring ? 'جاري الحفظ...' : editingRecurring ? 'حفظ التغييرات' : 'إضافة'}
              </Button>
              <Button variant="outline" onClick={() => setRecurringDialogOpen(false)} disabled={savingRecurring} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Recurring Confirmation ═══ */}
      <AlertDialog open={!!recurringToDelete} onOpenChange={(open) => { if (!open && !deletingRecurring) setRecurringToDelete(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المصروف الشهري "{recurringToDelete?.title ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deletingRecurring} className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteRecurring(); }}
              disabled={deletingRecurring}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRecurring ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
