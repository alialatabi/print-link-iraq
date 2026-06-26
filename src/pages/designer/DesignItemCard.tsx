import React from 'react';
import { m as motion } from 'framer-motion';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, Send, FileText, Image, Trash2, CheckCircle2, RefreshCw,
  Eye, MessageSquare, AlertTriangle, ExternalLink, Printer,
  ChevronDown, ChevronUp, Sparkles, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import type { OrderStatus } from '@/data/mockData';
import type { OrderDetailsJson } from '@/types/db';

export interface DesignVersion {
  id: string;
  version: number;
  file_url: string | null;
  approved: boolean | null;
  uploaded_at: string;
  order_item_id: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  template_id: string | null;
  status: OrderStatus;
  details: OrderDetailsJson;
  templates?: { name: string; service_type: string; preview_url?: string } | null;
}

interface RevisionEntry {
  version: number;
  note: string;
  date: string;
  images?: string[];
}

interface DesignItemCardProps {
  item: OrderItem;
  idx: number;
  isExpanded: boolean;
  onToggle: () => void;
  itemDesigns: DesignVersion[];
  uploadingItem: string | null;
  sendingItem: string | null;
  printingItem: string | null;
  approvalFormItem: string | null;
  setApprovalFormItem: (id: string | null) => void;
  designerMessages: Record<string, string>;
  setDesignerMessages: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fileInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => Promise<void>;
  onSendForApproval: (itemId: string) => Promise<void>;
  onApproveAndPrint: (item: OrderItem) => Promise<void>;
  onSendExistingToPrint: (itemId: string) => Promise<void>;
  onViewDesign: (filePath: string) => Promise<void>;
  onDeleteDesign: (design: DesignVersion) => Promise<void>;
}

const DesignItemCard = ({
  item,
  idx,
  isExpanded,
  onToggle,
  itemDesigns,
  uploadingItem,
  sendingItem,
  printingItem,
  approvalFormItem,
  setApprovalFormItem,
  designerMessages,
  setDesignerMessages,
  fileInputRefs,
  onFileSelect,
  onSendForApproval,
  onApproveAndPrint,
  onSendExistingToPrint,
  onViewDesign,
  onDeleteDesign,
}: DesignItemCardProps) => {
  const canUpload = ['submitted', 'assigned', 'design_uploaded'].includes(item.status);
  const canSendApproval = canUpload && itemDesigns.length > 0;
  const itemDetails = item.details || {};
  const revisions: RevisionEntry[] = (itemDetails.revisions as RevisionEntry[]) || [];
  const aiAttachments: string[] = Array.isArray(itemDetails.attachment_urls) ? itemDetails.attachment_urls : [];
  const hasUploadedDesign = itemDesigns.some(d => d.file_url);
  const canApproveDirect = canUpload && (hasUploadedDesign || aiAttachments.length > 0);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Item Header - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-right"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold text-sm">{idx + 1}</span>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">
              {item.templates?.name || 'عنصر'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {SERVICE_LABELS[item.templates?.service_type as ServiceType] || ''}
              {itemDetails.quantity && ` • ${Number(itemDetails.quantity).toLocaleString()} نسخة`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={item.status} />
          {itemDesigns.length > 0 && (
            <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {itemDesigns.length} تصميم
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-border"
        >
          {/* Template Preview */}
          {item.templates?.preview_url && (
            <img
              src={item.templates.preview_url}
              alt=""
              className="w-full max-h-48 object-contain bg-muted/20"
            />
          )}

          {/* Customer Details for this item */}
          <div className="p-4 border-b border-border">
            {itemDetails.is_ai_design && (
              <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-bold text-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  تصميم بالذكاء الاصطناعي (مسودة)
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  الصورة المرفقة نتاج الذكاء الاصطناعي — يرجى تدقيق النصوص العربية وإعادة تنضيدها وتجهيز الملف للطباعة بدقة.
                </p>
                {itemDetails.edit_request && (
                  <div className="mt-2 rounded-lg border border-accent/40 bg-accent/10 p-2.5">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5 text-accent-foreground" />
                      التعديلات المطلوبة من الزبون
                    </p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                      {itemDetails.edit_request}
                    </p>
                  </div>
                )}
                {itemDetails.unit_price ? (
                  <p className="text-xs font-medium text-foreground mt-1">
                    رسوم التصميم بالذكاء الاصطناعي: {Number(itemDetails.unit_price).toLocaleString('en-US')} د.ع
                  </p>
                ) : null}
                {itemDetails.ai_prompt && (
                  <details className="mt-2">
                    <summary className="text-xs text-primary cursor-pointer">
                      عرض الوصف المُرسل للذكاء الاصطناعي
                    </summary>
                    <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap" dir="ltr">
                      {itemDetails.ai_prompt}
                    </p>
                  </details>
                )}
              </div>
            )}
            <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              تفاصيل الزبون
            </h4>
            {itemDetails.details ? (
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-xl p-4 border border-border/50">
                {itemDetails.details}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">لا توجد تفاصيل</p>
            )}
            {Array.isArray(itemDetails.attachment_urls) && itemDetails.attachment_urls.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  مرفقات ({itemDetails.attachment_urls.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(itemDetails.attachment_urls as string[]).map((url: string, i: number) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative rounded-xl overflow-hidden border border-border/60 aspect-square bg-muted/20 group hover:border-primary/40 transition-colors"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-white" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Section */}
          <div className="p-4">
            {canUpload && (
              <div className="mb-4">
                <input
                  ref={el => { fileInputRefs.current[item.id] = el; }}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff"
                  onChange={e => onFileSelect(e, item.id)}
                  className="hidden"
                />
                <div
                  onClick={() => uploadingItem !== item.id && fileInputRefs.current[item.id]?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                    uploadingItem === item.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5',
                  )}
                >
                  {uploadingItem === item.id ? (
                    <>
                      <RefreshCw className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                      <p className="text-foreground font-medium text-sm">جاري الرفع...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-foreground font-medium text-sm">
                        {itemDesigns.length > 0 ? 'رفع إصدار جديد' : 'رفع التصميم'}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">PDF, PNG, JPG, TIF — حتى 10MB</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Design Versions */}
            {itemDesigns.length > 0 && (
              <div className="space-y-2 mb-4">
                {itemDesigns.map((design, i) => (
                  <div
                    key={design.id}
                    className={cn(
                      'rounded-lg p-3 flex items-center justify-between gap-3',
                      i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border border-border',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={cn('w-4 h-4', i === 0 ? 'text-primary' : 'text-muted-foreground')} />
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          الإصدار {design.version}{' '}
                          {i === 0 && <span className="text-primary text-xs mr-1">(الأحدث)</span>}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {new Date(design.uploaded_at).toLocaleDateString('ar')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {design.approved && (
                        <span className="text-[11px] bg-success/10 text-success px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />معتمد
                        </span>
                      )}
                      {design.file_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => onViewDesign(design.file_url!)}
                        >
                          <Eye className="w-3 h-3 ml-1" />عرض
                        </Button>
                      )}
                      {canUpload && !design.approved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => onDeleteDesign(design)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send for Approval */}
            {canSendApproval && (
              <div className="space-y-3">
                {approvalFormItem !== item.id ? (
                  <Button
                    onClick={() => setApprovalFormItem(item.id)}
                    size="lg"
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl"
                  >
                    <Send className="w-4 h-4 ml-2" />إرسال للموافقة
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3"
                  >
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-accent-foreground" />رسالة للزبون (اختياري)
                    </p>
                    <Textarea
                      value={designerMessages[item.id] || ''}
                      onChange={e =>
                        setDesignerMessages(prev => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="مثال: تم التصميم حسب الطلب..."
                      className="min-h-[60px] text-sm resize-none"
                      dir="rtl"
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => onSendForApproval(item.id)}
                        disabled={sendingItem === item.id}
                        className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <Send className="w-4 h-4 ml-1" />
                        {sendingItem === item.id ? 'جاري الإرسال...' : 'إرسال'}
                      </Button>
                      <Button onClick={() => setApprovalFormItem(null)} variant="outline">
                        إلغاء
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Direct approve → send to print (no customer round-trip) */}
            {canApproveDirect && (
              <div className={cn(canSendApproval && 'mt-3 pt-3 border-t border-border/60')}>
                <Button
                  onClick={() => onApproveAndPrint(item)}
                  disabled={printingItem === item.id}
                  size="lg"
                  className="w-full bg-success hover:bg-success/90 text-success-foreground rounded-xl"
                >
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  {printingItem === item.id ? 'جاري الإرسال...' : 'الموافقة على التصميم وإرساله للطبع 🖨'}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                  {hasUploadedDesign
                    ? 'سيتم إرسال أحدث نسخة مرفوعة للطباعة مباشرة دون مراجعة الزبون'
                    : 'سيتم إرسال الصورة المرفقة للطباعة مباشرة دون مراجعة الزبون'}
                </p>
              </div>
            )}

            {/* Waiting approval state */}
            {item.status === 'waiting_approval' && (
              <div className="bg-accent/10 rounded-lg p-4 text-center">
                <RefreshCw className="w-5 h-5 text-accent-foreground mx-auto mb-2" />
                <p className="font-medium text-foreground text-sm">بانتظار موافقة الزبون</p>
              </div>
            )}

            {/* Approved - send the final design straight to the print group */}
            {item.status === 'approved' && (
              <div className="space-y-3">
                <div className="bg-success/10 rounded-lg p-4 text-center">
                  <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-2" />
                  <p className="font-medium text-foreground text-sm">تمت الموافقة!</p>
                  <p className="text-muted-foreground text-xs mt-1">أرسل التصميم النهائي للمطبعة</p>
                </div>
                <Button
                  onClick={() => onSendExistingToPrint(item.id)}
                  disabled={printingItem === item.id}
                  size="lg"
                  className="w-full bg-success hover:bg-success/90 text-success-foreground rounded-xl"
                >
                  <Printer className="w-4 h-4 ml-2" />
                  {printingItem === item.id ? 'جاري الإرسال...' : 'إرسال للطبع 🖨'}
                </Button>
              </div>
            )}

            {item.status === 'print_ready' && (
              <div className="bg-success/10 rounded-lg p-4 text-center">
                <Printer className="w-5 h-5 text-success mx-auto mb-2" />
                <p className="font-medium text-foreground text-sm">تم تحويل العنصر للطبع!</p>
              </div>
            )}

            {/* Revision Notes */}
            {revisions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-destructive" />
                  <h4 className="font-bold text-foreground text-sm">ملاحظات الزبون</h4>
                </div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 mb-2">
                  <p className="text-sm font-bold text-destructive mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />آخر تعديل
                  </p>
                  <p className="text-foreground text-sm">{revisions[revisions.length - 1].note}</p>
                </div>
                {revisions.length > 1 &&
                  revisions.slice(0, -1).reverse().map((rev, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 border border-border mb-1.5">
                      <p className="text-foreground text-sm">{rev.note}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(rev.date).toLocaleDateString('ar')}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DesignItemCard;
