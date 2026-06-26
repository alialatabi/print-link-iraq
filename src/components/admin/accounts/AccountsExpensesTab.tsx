import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertCircle, Megaphone, CalendarDays, Plus, Pencil, Trash2, Minus } from 'lucide-react';
import type { Expense, RecurringExpense } from './types';

const MARKETING_CATEGORY = 'تسويق';
const fmt = (n: number) => n.toLocaleString('en-US');

interface AccountsExpensesTabProps {
  dateFilteredExpenses: Expense[];
  marketingSpend: number;
  marketingPctOfSales: number;
  marketingRoi: number;
  marketingMonthlyRecurring: number;
  monthsInRange: number;
  recurring: RecurringExpense[];
  recurringMonthly: number;
  recurringForPeriod: number;
  expenseByCategory: [string, number][];
  totalExpenses: number;
  onAddRecurring: () => void;
  onEditRecurring: (r: RecurringExpense) => void;
  onToggleRecurringActive: (r: RecurringExpense) => void;
  onDeleteRecurring: (r: RecurringExpense) => void;
  onAddExpense: () => void;
  onEditExpense: (exp: Expense) => void;
  onDeleteExpense: (exp: Expense) => void;
}

export function AccountsExpensesTab({
  dateFilteredExpenses,
  marketingSpend, marketingPctOfSales, marketingRoi, marketingMonthlyRecurring, monthsInRange,
  recurring, recurringMonthly, recurringForPeriod,
  expenseByCategory, totalExpenses,
  onAddRecurring, onEditRecurring, onToggleRecurringActive, onDeleteRecurring,
  onAddExpense, onEditExpense, onDeleteExpense,
}: AccountsExpensesTabProps) {
  return (
    <TabsContent value="expenses">
      <div className="space-y-4">
        {/* Operating-expenses clarification */}
        <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
          <span>تُحتسب تكلفة الإنتاج تلقائياً لكل طلب. المصروفات هنا هي مصاريف تشغيلية فقط (إيجار، رواتب، تسويق…).</span>
        </div>

        {/* ═══ Marketing ═══ */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" /> التسويق
            </h4>
            <span className="text-[11px] text-muted-foreground">فئة «{MARKETING_CATEGORY}»</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">إنفاق التسويق</p>
              <p className="text-lg font-bold text-foreground leading-none">{fmt(marketingSpend)} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span></p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">نسبة من المبيعات</p>
              <p className="text-lg font-bold text-foreground leading-none">{marketingPctOfSales}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">العائد (مبيعات لكل 1 د.ع)</p>
              <p className={`text-lg font-bold leading-none ${marketingRoi >= 1 ? 'text-success' : 'text-destructive'}`}>
                {marketingRoi > 0 ? `${marketingRoi.toFixed(1)}×` : '—'}
              </p>
            </div>
          </div>
          {marketingMonthlyRecurring > 0 && (
            <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border/50">
              يشمل {fmt(marketingMonthlyRecurring)} د.ع تسويق شهري متكرر × {monthsInRange} شهر
            </p>
          )}
        </div>

        {/* ═══ Monthly recurring expenses ═══ */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" /> المصروفات الشهرية المتكررة
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                التزامات ثابتة تُحتسب تلقائياً كل شهر — {fmt(recurringMonthly)} د.ع/شهر
                {recurringForPeriod !== recurringMonthly && <> (≈ {fmt(recurringForPeriod)} د.ع لهذه الفترة × {monthsInRange} شهر)</>}
              </p>
            </div>
            <Button onClick={onAddRecurring} size="sm" variant="outline" className="rounded-xl gap-1.5">
              <Plus className="w-3.5 h-3.5" /> إضافة مصروف شهري
            </Button>
          </div>
          {recurring.length === 0 ? (
            <div className="text-center py-8 bg-card/80 rounded-2xl border border-border/50 text-muted-foreground text-sm">
              لا توجد مصروفات شهرية متكررة
            </div>
          ) : (
            <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-right text-[11px] font-semibold">العنوان</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold w-[100px]">الفئة</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold w-[110px]">المبلغ/شهر</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold w-[80px]">الحالة</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold w-[80px]">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurring.map(r => (
                      <TableRow key={r.id} className={`group ${!r.active ? 'opacity-50' : ''}`}>
                        <TableCell>
                          <p className="text-xs font-medium text-foreground">{r.title}</p>
                          {r.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.notes}</p>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{r.category}</Badge></TableCell>
                        <TableCell><span className="text-xs font-bold text-destructive">{fmt(r.amount)} د.ع</span></TableCell>
                        <TableCell>
                          <button
                            onClick={() => onToggleRecurringActive(r)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${r.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}
                          >
                            {r.active ? 'نشط' : 'متوقف'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEditRecurring(r)}><Pencil className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDeleteRecurring(r)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Expense category breakdown */}
        {expenseByCategory.length > 0 && (
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5">
            <h4 className="text-sm font-bold text-foreground mb-4">توزيع المصروفات حسب الفئة</h4>
            <div className="space-y-2">
              {expenseByCategory.map(([cat, amount]) => {
                const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">{cat}</span>
                      <span className="text-muted-foreground">{fmt(amount)} د.ع ({Math.round(pct)}%)</span>
                    </div>
                    <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-destructive h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add expense button */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">مصروفات لمرة واحدة</h3>
          <Button onClick={onAddExpense} size="sm" className="rounded-xl gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            إضافة مصروف
          </Button>
        </div>

        {/* Expenses list */}
        {dateFilteredExpenses.length === 0 ? (
          <div className="text-center py-16 bg-card/80 rounded-2xl border border-border/50">
            <Minus className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد مصروفات في هذه الفترة</p>
          </div>
        ) : (
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-right text-[11px] font-semibold">العنوان</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[100px]">الفئة</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[100px]">المبلغ</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[100px]">التاريخ</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[80px]">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dateFilteredExpenses.map(exp => (
                    <TableRow key={exp.id} className="group">
                      <TableCell>
                        <p className="text-xs font-medium text-foreground">{exp.title}</p>
                        {exp.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{exp.notes}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{exp.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-destructive">{fmt(exp.amount)} د.ع</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] text-muted-foreground">{new Date(exp.expense_date).toLocaleDateString('ar-IQ')}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEditExpense(exp)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDeleteExpense(exp)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </TabsContent>
  );
}
