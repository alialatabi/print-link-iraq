import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Expense, ExpenseForm } from './types';

const EXPENSE_CATEGORIES = ['إيجار', 'رواتب', 'صيانة', 'مصاريف تشغيلية', 'تسويق', 'نقل وتوصيل', 'عام'];

interface ExpenseDialogsProps {
  // Add/Edit dialog
  expenseDialogOpen: boolean;
  setExpenseDialogOpen: (open: boolean) => void;
  editingExpense: Expense | null;
  expenseForm: ExpenseForm;
  setExpenseForm: React.Dispatch<React.SetStateAction<ExpenseForm>>;
  savingExpense: boolean;
  handleSaveExpense: () => Promise<void>;
  // Delete dialog
  expenseToDelete: Expense | null;
  setExpenseToDelete: (e: Expense | null) => void;
  deletingExpense: boolean;
  confirmDeleteExpense: () => Promise<void>;
}

export function ExpenseDialogs({
  expenseDialogOpen, setExpenseDialogOpen, editingExpense,
  expenseForm, setExpenseForm, savingExpense, handleSaveExpense,
  expenseToDelete, setExpenseToDelete, deletingExpense, confirmDeleteExpense,
}: ExpenseDialogsProps) {
  return (
    <>
      {/* ═══ Expense Dialog ═══ */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'تعديل مصروف' : 'إضافة مصروف'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">العنوان *</label>
              <Input
                value={expenseForm.title}
                onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))}
                placeholder="مثال: إيجار المحل"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">المبلغ (د.ع) *</label>
                <Input
                  type="number"
                  value={expenseForm.amount || ''}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))}
                  placeholder="500000"
                  className="rounded-xl"
                  dir="ltr"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">التاريخ</label>
                <Input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                  className="rounded-xl"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الفئة</label>
              <Select value={expenseForm.category} onValueChange={v => setExpenseForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">ملاحظات</label>
              <Textarea
                value={expenseForm.notes}
                onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات إضافية..."
                className="rounded-xl min-h-[60px]"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveExpense} disabled={savingExpense} className="flex-1 rounded-xl">
                {savingExpense ? 'جاري الحفظ...' : editingExpense ? 'حفظ التغييرات' : 'إضافة'}
              </Button>
              <Button variant="outline" onClick={() => setExpenseDialogOpen(false)} disabled={savingExpense} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Expense Confirmation ═══ */}
      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => { if (!open && !deletingExpense) setExpenseToDelete(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المصروف "{expenseToDelete?.title ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deletingExpense} className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteExpense(); }}
              disabled={deletingExpense}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingExpense ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
