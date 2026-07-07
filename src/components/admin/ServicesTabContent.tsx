import { useState } from 'react';
import { m as motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, GripVertical, Sparkles, Ruler } from 'lucide-react';
import IconDisplay from '@/components/admin/IconDisplay';
import VariantManager from '@/components/admin/VariantManager';
import type { Service } from '@/components/admin/adminTypes';

interface ServicesTabContentProps {
  services: Service[];
  dragId: string | null;
  onDragStart: (id: string, group: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetId: string, group: string) => Promise<void>;
  onAdd: () => void;
  onEdit: (item: Service) => void;
  onDelete: (item: Service) => void;
}

const ServicesTabContent = ({
  services,
  dragId,
  onDragStart,
  onDragOver,
  onDrop,
  onAdd,
  onEdit,
  onDelete,
}: ServicesTabContentProps) => {
  // Local dialog state for the "القياسات والأسعار" entry point — AdminServicesSpecs
  // (the parent) owns none of this; it only ever renders <ServicesTabContent />.
  const [variantsFor, setVariantsFor] = useState<{ id: string; label: string } | null>(null);

  return (
  <>
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm text-muted-foreground">الخدمات العامة والفرعية</p>
      <Button onClick={onAdd} className="rounded-xl">
        <Plus className="w-4 h-4 ml-1" />
        إضافة خدمة
      </Button>
    </div>
    <div className="space-y-2">
      {services
        .filter(s => !s.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((parent, i) => {
          const children = services
            .filter(s => s.parent_id === parent.id)
            .sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={parent.id}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                draggable
                onDragStart={() => onDragStart(parent.id, 'parents')}
                onDragOver={onDragOver}
                onDrop={() => onDrop(parent.id, 'parents')}
                className={`bg-card rounded-xl p-4 border border-border flex items-center gap-3 group cursor-grab active:cursor-grabbing transition-all ${dragId === parent.id ? 'opacity-50 scale-95' : ''}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <IconDisplay icon={parent.icon} iconUrl={parent.icon_url} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm">{parent.label}</h4>
                  <div className="flex items-center gap-3 gap-y-0.5 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground/60 font-mono break-all">ID: {parent.id}</span>
                    <span className="text-[10px] font-bold text-primary shrink-0">خدمة عامة • {children.length} فرعية</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(parent)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => onDelete(parent)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
              {/* Sub-services */}
              {children.length > 0 && (
                <div className="mr-8 mt-1 space-y-1 border-r-2 border-primary/20 pr-3">
                  {children.map((child, j) => (
                    <motion.div
                      key={child.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 + j * 0.02 }}
                      draggable
                      onDragStart={e => { e.stopPropagation(); onDragStart(child.id, parent.id); }}
                      onDragOver={e => { e.stopPropagation(); onDragOver(e); }}
                      onDrop={e => { e.stopPropagation(); onDrop(child.id, parent.id); }}
                      className={`bg-muted/40 rounded-lg p-3 border border-border/60 flex items-center gap-3 group cursor-grab active:cursor-grabbing transition-all ${dragId === child.id ? 'opacity-50 scale-95' : ''}`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                      <IconDisplay icon={child.icon} iconUrl={child.icon_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground text-xs">{child.label}</h4>
                        <div className="flex items-center gap-2 gap-y-0.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/60 font-mono break-all">ID: {child.id}</span>
                          {child.ai_enabled && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 shrink-0">
                              <Sparkles className="w-2.5 h-2.5" /> AI{child.ai_fee ? ` · ${child.ai_fee.toLocaleString('en-US')} د.ع` : ''}
                            </span>
                          )}
                          {child.print_enabled === false && (
                            <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded-full shrink-0">غير مطبوع</span>
                          )}
                          {child.price > 0 && (
                            <span className="text-[10px] font-bold text-success shrink-0">سعر: {child.price.toLocaleString('en-US')} د.ع</span>
                          )}
                          {child.cost > 0 && (
                            <span className="text-[10px] font-bold text-destructive shrink-0">تكلفة: {child.cost.toLocaleString('en-US')} د.ع</span>
                          )}
                          {child.completion_days > 0 && (
                            <span className="text-[10px] font-bold text-blue-500 shrink-0">⏱ {child.completion_days} {child.completion_days === 1 ? 'يوم' : 'أيام'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="القياسات والأسعار"
                          onClick={() => setVariantsFor({ id: child.id, label: child.label })}
                        >
                          <Ruler className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(child)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(child)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
    {/* Always mounted (like ServiceEditDialog) so Radix's close animation isn't cut off by unmounting. */}
    <VariantManager
      serviceId={variantsFor?.id ?? ''}
      serviceLabel={variantsFor?.label ?? ''}
      open={!!variantsFor}
      onOpenChange={o => { if (!o) setVariantsFor(null); }}
    />
  </>
  );
};

export default ServicesTabContent;
