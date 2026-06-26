import { OrderStatus, STATUS_LABELS, STATUS_COLORS } from '@/data/mockData';

const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className={`inline-flex shrink-0 items-center whitespace-nowrap px-3 py-1 rounded-lg text-[11px] font-semibold tracking-wide ${STATUS_COLORS[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

export default StatusBadge;
