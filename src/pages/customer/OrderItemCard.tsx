import React, { useEffect, useRef, useState } from 'react';
import { m as motion } from 'framer-motion';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ImageLightbox from '@/components/ImageLightbox';
import {
  CheckCircle, Clock, FileText, Palette, Printer, Truck,
  Eye, MessageSquare, RefreshCw, ImagePlus, X, ChevronDown, ChevronUp, Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import type { OrderStatus } from '@/data/mockData';
import type { OrderDetailsJson } from '@/types/db';
import { getDesignSignedUrl } from '@/lib/storage';
import { createRevisionSignedUrl } from '@/services/orders';
import { IMAGE_ACCEPT } from '@/lib/uploadValidation';

export interface DesignVersion {
  id: string;
  version: number;
  file_url: string | null;
  approved: boolean | null;
  uploaded_at: string;
  order_item_id: string | null;
}

interface RevisionEntry {
  version: number;
  note: string;
  date: string;
  images?: string[];
}

interface DesignerMessage {
  text: string;
  date: string;
  version?: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  template_id: string | null;
  status: OrderStatus;
  details: OrderDetailsJson;
  templates?: { name: string; service_type: string } | null;
}

interface ServiceMeta {
  id: string;
  completion_days: number;
}

// ── RevisionImages ─────────────────────────────────────────────────────────

const RevisionImages = ({ paths, onView }: { paths: string[]; onView: (url: string) => void }) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const results = await Promise.all(paths.map(p => createRevisionSignedUrl(p)));
      if (!cancelled) setUrls(results.filter(Boolean) as string[]);
    };
    load();
    return () => { cancelled = true; };
  }, [paths]);
  if (urls.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {urls.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`مرفق ${i + 1}`}
          draggable={false}
          onContextMenu={e => e.preventDefault()}
          className="w-16 h-16 rounded-lg object-cover border border-border/60 cursor-pointer select-none"
          onClick={() => onView(url)}
        />
      ))}
    </div>
  );
};

// ── ITEM_STEPS ─────────────────────────────────────────────────────────────

const ITEM_STEPS = [
  { status: 'submitted', label: 'تم الإرسال', icon: FileText },
  { status: 'assigned', label: 'تم تعيين مصمم', icon: Palette },
  { status: 'waiting_approval', label: 'بانتظار الموافقة', icon: Clock },
  { status: 'approved', label: 'تمت الموافقة', icon: CheckCircle },
  { status: 'print_ready', label: 'جاهز للطباعة', icon: Printer },
  { status: 'delivered', label: 'تم التسليم', icon: Truck },
];

// ── OrderItemCard ───────────────────────────────────────────────────────────

interface OrderItemCardProps {
  item: OrderItem;
  idx: number;
  isExpanded: boolean;
  onToggle: () => void;
  itemDesigns: DesignVersion[];
  submittingItem: string | null;
  showRevisionItem: string | null;
  setShowRevisionItem: (id: string | null) => void;
  revisionNote: string;
  onRevisionNoteChange: (note: string) => void;
  revisionImagePreviews: string[];
  revisionImageFiles: File[];
  onRevisionImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveRevisionImage: (index: number) => void;
  onApproveItem: () => void;
  onRequestRevision: () => void;
  previewUrls: Record<string, string>;
  setPreviewUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  allServices: ServiceMeta[];
}

const OrderItemCard = ({
  item,
  idx,
  isExpanded,
  onToggle,
  itemDesigns,
  submittingItem,
  showRevisionItem,
  setShowRevisionItem,
  revisionNote,
  onRevisionNoteChange,
  revisionImagePreviews,
  revisionImageFiles,
  onRevisionImageSelect,
  onRemoveRevisionImage,
  onApproveItem,
  onRequestRevision,
  previewUrls,
  setPreviewUrls,
  allServices,
}: OrderItemCardProps) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const revisionImgRef = useRef<HTMLInputElement>(null);

  const itemDetails = item.details || {};
  const revisions: RevisionEntry[] = (itemDetails.revisions as RevisionEntry[]) || [];
  const designerMessages: DesignerMessage[] = (itemDetails.designer_messages as DesignerMessage[]) || [];
  const currentStepIndex = ITEM_STEPS.findIndex(s => s.status === item.status);
  const showDesignReview = ['waiting_approval', 'design_uploaded'].includes(item.status) || itemDesigns.length > 0;

  return (
    <>
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        {/* Item Header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors text-right"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-sm">{idx + 1}</span>
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{item.templates?.name || 'عنصر'}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {SERVICE_LABELS[item.templates?.service_type as ServiceType] || ''}
                </p>
                {(() => {
                  const svc = allServices.find(s => s.id === item.templates?.service_type);
                  return svc && svc.completion_days > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <Timer className="w-3 h-3" />
                      {svc.completion_days} {svc.completion_days === 1 ? 'يوم' : 'أيام'}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={item.status} />
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-t border-border"
          >
            {/* Progress Steps */}
            <div className="p-5 border-b border-border/60">
              <h4 className="font-bold text-foreground text-sm mb-4">مراحل العنصر</h4>
              <div className="space-y-2">
                {ITEM_STEPS.map((step, i) => {
                  const isComplete = i <= currentStepIndex;
                  const isCurrent = i === currentStepIndex;
                  return (
                    <div key={step.status} className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                        isComplete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
                        isCurrent && 'ring-2 ring-success/30 ring-offset-1 ring-offset-background',
                      )}>
                        <step.icon className="w-3.5 h-3.5" />
                      </div>
                      <p className={cn('font-medium text-sm flex-1', isComplete ? 'text-foreground' : 'text-muted-foreground')}>
                        {step.label}
                      </p>
                      {isComplete && <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Design Review */}
            {showDesignReview && (
              <div className="p-5">
                <h4 className="font-bold text-foreground text-sm mb-4">التصميم</h4>

                {itemDesigns.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {itemDesigns.map((design, i) => {
                      const isSelected = previewUrls[`${item.id}_selected`] === design.id;
                      return (
                        <div key={design.id}>
                          <div
                            onClick={async () => {
                              if (!design.file_url) return;
                              if (isSelected) {
                                setPreviewUrls(prev => {
                                  const n = { ...prev };
                                  delete n[`${item.id}_selected`];
                                  delete n[`${item.id}_inline`];
                                  return n;
                                });
                              } else {
                                const url = await getDesignSignedUrl(design.file_url);
                                if (url) setPreviewUrls(prev => ({ ...prev, [`${item.id}_selected`]: design.id, [`${item.id}_inline`]: url }));
                              }
                            }}
                            className={cn(
                              'rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition-all',
                              isSelected
                                ? 'bg-primary/10 border-2 border-primary/30'
                                : i === 0
                                  ? 'bg-primary/5 border border-primary/10 hover:bg-primary/8'
                                  : 'bg-muted/40 border border-border/50 hover:bg-muted/60',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className={cn('w-4 h-4', isSelected || i === 0 ? 'text-primary' : 'text-muted-foreground')} />
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  الإصدار {design.version}{' '}
                                  {i === 0 && <span className="text-primary text-[11px] mr-1">(الأحدث)</span>}
                                </p>
                                <p className="text-muted-foreground text-[11px]">
                                  {new Date(design.uploaded_at).toLocaleDateString('ar')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {design.approved && (
                                <span className="text-[11px] bg-success/10 text-success px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />معتمد
                                </span>
                              )}
                              {isSelected ? (
                                <ChevronUp className="w-4 h-4 text-primary" />
                              ) : (
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          {/* Inline image preview */}
                          {isSelected && previewUrls[`${item.id}_inline`] && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-2 rounded-xl overflow-hidden border border-border/50 bg-muted/20"
                            >
                              <img
                                src={previewUrls[`${item.id}_inline`]}
                                alt={`الإصدار ${design.version}`}
                                draggable={false}
                                onContextMenu={e => e.preventDefault()}
                                onClick={() => setLightboxUrl(previewUrls[`${item.id}_inline`])}
                                className="w-full object-contain cursor-zoom-in select-none"
                              />
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Designer messages */}
                {designerMessages.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {designerMessages.slice().reverse().map((msg, i) => (
                      <div
                        key={i}
                        className={cn('rounded-xl p-3', i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40 border border-border/50')}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[11px] text-muted-foreground">
                            رسالة المصمم — {new Date(msg.date).toLocaleDateString('ar')}
                          </span>
                        </div>
                        <p className="text-foreground text-sm">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Approve / Revision */}
                {item.status === 'waiting_approval' && (
                  <div className="space-y-3">
                    <Button
                      onClick={onApproveItem}
                      disabled={submittingItem === item.id}
                      size="lg"
                      className="w-full bg-success hover:bg-success/90 text-success-foreground h-11"
                    >
                      <CheckCircle className="w-5 h-5 ml-2" />الموافقة على التصميم ✅
                    </Button>

                    {showRevisionItem !== item.id ? (
                      <Button
                        onClick={() => setShowRevisionItem(item.id)}
                        variant="outline"
                        size="lg"
                        className="w-full h-11 border-destructive/20 text-destructive hover:bg-destructive/5"
                      >
                        <MessageSquare className="w-5 h-5 ml-2" />طلب تعديل
                      </Button>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <Textarea
                          value={revisionNote}
                          onChange={e => onRevisionNoteChange(e.target.value)}
                          placeholder="اكتب ملاحظاتك للمصمم..."
                          className="min-h-[80px]"
                          dir="rtl"
                        />
                        <div>
                          <input
                            ref={revisionImgRef}
                            type="file"
                            accept={IMAGE_ACCEPT}
                            multiple
                            className="hidden"
                            onChange={onRevisionImageSelect}
                          />
                          {revisionImagePreviews.length > 0 && (
                            <div className="flex gap-2 flex-wrap mb-2">
                              {revisionImagePreviews.map((src, i) => (
                                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/60">
                                  <img src={src} alt="" className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => onRemoveRevisionImage(i)}
                                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {revisionImageFiles.length < 3 && (
                            <button
                              type="button"
                              onClick={() => revisionImgRef.current?.click()}
                              className="w-full border border-dashed border-border/50 hover:border-primary/40 rounded-xl p-2.5 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary text-sm"
                            >
                              <ImagePlus className="w-4 h-4" />إضافة صور (اختياري)
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={onRequestRevision}
                            disabled={submittingItem === item.id || !revisionNote.trim()}
                            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          >
                            {submittingItem === item.id ? 'جاري الإرسال...' : 'إرسال التعديل'}
                          </Button>
                          <Button
                            onClick={() => { setShowRevisionItem(null); onRevisionNoteChange(''); }}
                            variant="outline"
                          >
                            إلغاء
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {item.status === 'approved' && (
                  <div className="bg-success/8 rounded-xl p-4 text-center border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success mx-auto mb-2" />
                    <p className="font-medium text-foreground text-sm">تمت الموافقة! سيتم تحضيره للطباعة</p>
                  </div>
                )}

                {/* Revision History */}
                {revisions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="font-bold text-foreground text-sm mb-3">سجل التعديلات</h4>
                    <div className="space-y-2">
                      {revisions.map((rev, i) => (
                        <div key={i} className="bg-muted/40 rounded-xl p-3 border border-border/50">
                          <p className="text-[11px] text-muted-foreground mb-1">
                            الإصدار {rev.version} — {new Date(rev.date).toLocaleDateString('ar')}
                          </p>
                          <p className="text-foreground text-sm">{rev.note}</p>
                          {rev.images && rev.images.length > 0 && (
                            <RevisionImages paths={rev.images} onView={setLightboxUrl} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Waiting state if no designs yet */}
            {!showDesignReview && !['approved', 'print_ready', 'printed', 'delivered', 'cancelled'].includes(item.status) && (
              <div className="p-5 text-center">
                <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">المصمم يعمل على هذا العنصر...</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <ImageLightbox
        src={lightboxUrl}
        open={!!lightboxUrl}
        onOpenChange={o => { if (!o) setLightboxUrl(null); }}
      />
    </>
  );
};

export default OrderItemCard;
