import { m as motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import IconDisplay from '@/components/admin/IconDisplay';
import type { Specialization } from '@/components/admin/adminTypes';

interface SpecializationsTabContentProps {
  specializations: Specialization[];
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetId: string) => Promise<void>;
  onAdd: () => void;
  onEdit: (item: Specialization) => void;
  onDelete: (item: Specialization) => void;
}

const SpecializationsTabContent = ({
  specializations,
  dragId,
  onDragStart,
  onDragOver,
  onDrop,
  onAdd,
  onEdit,
  onDelete,
}: SpecializationsTabContentProps) => (
  <>
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm text-muted-foreground">تخصصات مجالات الأعمال</p>
      <Button onClick={onAdd} className="rounded-xl">
        <Plus className="w-4 h-4 ml-1" />
        إضافة تخصص
      </Button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {specializations
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((spec, i) => (
          <motion.div
            key={spec.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            draggable
            onDragStart={() => onDragStart(spec.id)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(spec.id)}
            className={`bg-card rounded-xl p-4 border border-border flex items-center gap-3 group cursor-grab active:cursor-grabbing transition-all ${dragId === spec.id ? 'opacity-50 scale-95' : ''}`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <IconDisplay icon={spec.icon} iconUrl={spec.icon_url} />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-foreground text-sm">{spec.label}</h4>
              <span className="text-[10px] text-muted-foreground/60 font-mono break-all">ID: {spec.id}</span>
            </div>
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(spec)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => onDelete(spec)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        ))}
    </div>
  </>
);

export default SpecializationsTabContent;
