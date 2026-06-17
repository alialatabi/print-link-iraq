import { CheckCircle2, FileSearch, Printer, Truck, XCircle } from 'lucide-react';
import { RESELLER_STAGES, resellerStageIndex, isCancelled } from '@/lib/resellerStages';
import type { OrderStatus } from '@/data/mockData';

const STAGE_ICONS = [FileSearch, Printer, Truck];

/** Horizontal 3-stage progress tracker for reseller orders. */
const ResellerStageTracker = ({ status }: { status: OrderStatus | string }) => {
  if (isCancelled(status)) {
    return (
      <div className="flex items-center gap-2 text-destructive bg-destructive/5 rounded-xl px-3 py-2">
        <XCircle className="w-4 h-4" />
        <span className="text-sm font-semibold">تم إلغاء الطلب</span>
      </div>
    );
  }

  const current = resellerStageIndex(status);

  return (
    <div className="flex items-center">
      {RESELLER_STAGES.map((stage, i) => {
        const Icon = STAGE_ICONS[i];
        const done = i < current;
        const active = i === current;
        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                done ? 'bg-success text-success-foreground' :
                active ? 'bg-primary text-primary-foreground ring-4 ring-primary/15' :
                'bg-muted text-muted-foreground'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] sm:text-[11px] font-semibold text-center leading-tight ${
                done || active ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {stage.label}
              </span>
            </div>
            {i < RESELLER_STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-5 rounded-full transition-all ${
                i < current ? 'bg-success' : 'bg-muted'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ResellerStageTracker;
