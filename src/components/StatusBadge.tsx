import { OrderStatus, STATUS_LABELS, STATUS_COLORS } from '@/data/mockData';

const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

export default StatusBadge;
