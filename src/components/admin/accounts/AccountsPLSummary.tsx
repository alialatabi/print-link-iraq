import { m as motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import {
  DollarSign, TrendingUp, PackageCheck, Minus, Sparkles, CircleDollarSign,
  Wallet, Clock, Target, BarChart3, ArrowUpRight, ArrowDownRight, Percent,
} from 'lucide-react';
import type { MonthlyTrendEntry } from './types';

const fmt = (n: number) => n.toLocaleString('en-US');

interface AccountsPLSummaryProps {
  // Primary KPI values
  totalSales: number;
  completedOrdersCount: number;
  totalProductionCost: number;
  grossProfit: number;
  grossMargin: number;
  totalExpenses: number;
  recurringForPeriod: number;
  manualExpenses: number;
  dateFilteredExpensesCount: number;
  aiCost: number;
  netProfit: number;
  netMargin: number;
  // Secondary KPI values
  confirmedPaid: number;
  totalCashReceived: number;
  pendingValue: number;
  pendingOrdersCount: number;
  collectionRate: number;
  confirmedRemaining: number;
  // Monthly trend
  monthlyTrend: MonthlyTrendEntry[];
  maxMonthRevenue: number;
  monthGrowth: number;
}

export function AccountsPLSummary({
  totalSales, completedOrdersCount, totalProductionCost, grossProfit, grossMargin,
  totalExpenses, recurringForPeriod, manualExpenses, dateFilteredExpensesCount,
  aiCost, netProfit, netMargin,
  confirmedPaid, totalCashReceived, pendingValue, pendingOrdersCount, collectionRate, confirmedRemaining,
  monthlyTrend, maxMonthRevenue, monthGrowth,
}: AccountsPLSummaryProps) {
  return (
    <>
      {/* ═══ P&L KPI Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'إجمالي المبيعات',
            value: fmt(totalSales),
            sub: `${completedOrdersCount} طلب مكتمل`,
            icon: DollarSign,
            iconBg: 'bg-primary/10',
            iconColor: 'text-primary',
          },
          {
            label: 'تكلفة الإنتاج',
            value: fmt(totalProductionCost),
            sub: `تكلفة الطلبات المكتملة`,
            icon: PackageCheck,
            iconBg: 'bg-destructive/10',
            iconColor: 'text-destructive',
            valueColor: 'text-destructive',
          },
          {
            label: 'الربح الإجمالي',
            value: fmt(grossProfit),
            sub: `هامش الربح: ${grossMargin}%`,
            icon: TrendingUp,
            iconBg: 'bg-success/10',
            iconColor: 'text-success',
            valueColor: grossProfit > 0 ? 'text-success' : 'text-destructive',
          },
          {
            label: 'المصروفات',
            value: fmt(totalExpenses),
            sub: recurringForPeriod > 0 ? `${fmt(recurringForPeriod)} متكرر + ${fmt(manualExpenses)} متفرق` : `${dateFilteredExpensesCount} مصروف`,
            icon: Minus,
            iconBg: 'bg-destructive/10',
            iconColor: 'text-destructive',
            valueColor: 'text-destructive',
          },
          {
            label: 'تكلفة الذكاء الاصطناعي',
            value: fmt(aiCost),
            sub: 'تكلفة التوليد الفعلية',
            icon: Sparkles,
            iconBg: 'bg-amber-500/10',
            iconColor: 'text-amber-600',
            valueColor: 'text-amber-600',
          },
          {
            label: 'صافي الربح',
            value: fmt(netProfit),
            sub: `صافي الهامش: ${netMargin}%`,
            icon: CircleDollarSign,
            iconBg: netProfit >= 0 ? 'bg-success/10' : 'bg-destructive/10',
            iconColor: netProfit >= 0 ? 'text-success' : 'text-destructive',
            valueColor: netProfit >= 0 ? 'text-success' : 'text-destructive',
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight">{stat.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center shrink-0`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                </div>
                <p className={`text-xl font-extrabold ${stat.valueColor || 'text-foreground'} leading-none`}>
                  {stat.value} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ═══ Secondary KPIs ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'المبالغ المستلمة', value: fmt(confirmedPaid), sub: `نقد مستلم (شامل العرابين): ${fmt(totalCashReceived)} د.ع`, icon: Wallet, iconBg: 'bg-success/10', iconColor: 'text-success', valueColor: 'text-success' },
          { label: 'الطلبات المعلقة', value: fmt(pendingValue), sub: `${pendingOrdersCount} طلب قيد المعالجة`, icon: Clock, iconBg: 'bg-accent/10', iconColor: 'text-accent-foreground' },
          { label: 'متوسط قيمة الطلب', value: fmt(completedOrdersCount > 0 ? Math.round(totalSales / completedOrdersCount) : 0), sub: `نسبة التحصيل: ${collectionRate}%`, icon: Target, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
          { label: 'متوسط الربح / طلب', value: fmt(completedOrdersCount > 0 ? Math.round(grossProfit / completedOrdersCount) : 0), sub: `صافي ربح لكل طلب`, icon: BarChart3, iconBg: 'bg-success/10', iconColor: 'text-success', valueColor: 'text-success' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight">{stat.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center shrink-0`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                </div>
                <p className={`text-xl font-extrabold ${stat.valueColor || 'text-foreground'} leading-none`}>
                  {stat.value} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ═══ Monthly Trend + Collection Rate ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              الأداء الشهري
            </h4>
            {monthGrowth !== 0 && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${monthGrowth > 0 ? 'text-success' : 'text-destructive'}`}>
                {monthGrowth > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {Math.abs(monthGrowth)}% عن الشهر السابق
              </div>
            )}
          </div>
          <div className="flex items-end gap-1 sm:gap-2 h-32">
            {monthlyTrend.map((m, i) => (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-foreground truncate w-full text-center">{m.revenue > 0 ? fmt(m.revenue) : ''}</span>
                <div className="w-full relative">
                  <div
                    className="w-full bg-primary/15 rounded-t-md transition-all duration-500 relative overflow-hidden"
                    style={{ height: `${Math.max((m.revenue / maxMonthRevenue) * 80, 4)}px` }}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-success rounded-t-md transition-all duration-500"
                      style={{ height: m.revenue > 0 ? `${(m.profit / m.revenue) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{m.label}</span>
                <span className="text-[9px] text-success font-bold truncate w-full text-center">{m.profit > 0 ? fmt(m.profit) : ''}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-success" />
              <span className="text-[10px] text-muted-foreground">صافي الربح</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-primary/15" />
              <span className="text-[10px] text-muted-foreground">المبيعات</span>
            </div>
          </div>
        </div>

        {/* Collection Rate Donut */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5 flex flex-col items-center justify-center">
          <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Percent className="w-4 h-4 text-success" />
            نسبة التحصيل
          </h4>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--success))" strokeWidth="3" strokeDasharray={`${collectionRate}, 100`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-success">{collectionRate}%</span>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 w-full">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">مستلم</span>
              <span className="font-bold text-success">{fmt(confirmedPaid)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">متبقي</span>
              <span className="font-bold text-destructive">{fmt(confirmedRemaining)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
