import React, { useEffect, useState } from 'react';
import { m as motion } from 'framer-motion';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Send, FileText, Image, CheckCircle2, RefreshCw,
  MessageSquare, AlertTriangle, Printer,
  ChevronDown, ChevronUp, Sparkles, Pencil, GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AttachmentGallery from './AttachmentGallery';
import DownloadAllButton from '@/components/designer/DownloadAllButton';
import DesignVersionList from '@/components/designer/DesignVersionList';
import DesignUploadZone from '@/components/designer/DesignUploadZone';
import FaceUploadZones, { type FaceZoneState } from '@/components/designer/FaceUploadZones';
import RevisionImages from '@/components/RevisionImages';
import ImageLightbox from '@/components/ImageLightbox';
import CopyButton from '@/components/CopyButton';
import { evaluateDirectPrint, getDesignSignedUrl, isImageUrl, hasBothFaces, type DesignFace } from '@/lib/designUtils';
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
  /** Two-face products only: 'front' | 'back'. NULL/undefined for single-face designs. */
  face?: DesignFace | null;
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
  /** filename + size of the in-flight upload for THIS item */
  uploadInfo?: { name: string; size: number } | null;
  /** the File whose upload failed after retries for THIS item (drives the inline retry) */
  failedUpload?: File | null;
  sendingItem: string | null;
  printingItem: string | null;
  approvalFormItem: string | null;
  setApprovalFormItem: (id: string | null) => void;
  designerMessages: Record<string, string>;
  setDesignerMessages: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fileInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => Promise<void>;
  onRetryUpload: (itemId: string) => void;
  onSendForApproval: (itemId: string) => Promise<void>;
  onApproveAndPrint: (item: OrderItem) => Promise<void>;
  onSendExistingToPrint: (itemId: string) => Promise<void>;
  onDeleteDesign: (design: DesignVersion) => Promise<void>;
  /** 1 (default) = single upload zone; 2 = two labelled face zones (front/back). */
  faces?: 1 | 2;
  /** Two-face only: per-face upload state (uploading/info/failed/hasExisting) for this item. */
  faceState?: { front: FaceZoneState; back: FaceZoneState } | null;
  /** Two-face only: pick a file for a specific face. */
  onFaceFileSelect?: (e: React.ChangeEvent<HTMLInputElement>, itemId: string, face: DesignFace) => Promise<void>;
  /** Two-face only: retry a failed face upload. */
  onFaceRetry?: (itemId: string, face: DesignFace) => void;
}

/**
 * AI-draft ↔ latest-version side-by-side compare. Shown only for AI items that already have an
 * uploaded version; each pane is zoomable via the parent's lightbox (onView). The AI draft is a
 * public order-attachment URL; the designer version is signed on demand.
 */
const AiDraftCompare = ({
  draftUrl,
  versionPath,
  onView,
}: {
  draftUrl: string;
  versionPath: string;
  onView: (url: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [versionUrl, setVersionUrl] = useState<string | null>(null);
  const versionIsImage = isImageUrl(versionPath);

  useEffect(() => {
    if (!open || !versionIsImage) return;
    let cancelled = false;
    getDesignSignedUrl(versionPath).then(u => { if (!cancelled) setVersionUrl(u); });
    return () => { cancelled = true; };
  }, [open, versionPath, versionIsImage]);

  return (
    <div className="mt-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)} className="w-full">
        <GitCompare className="w-4 h-4 ml-1.5" />
        {open ? 'إخفاء المقارنة' : 'قارن مع المسودة'}
      </Button>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"
        >
          <figure className="rounded-xl overflow-hidden border border-primary/20 bg-muted/20">
            <figcaption className="text-[11px] font-bold text-primary bg-primary/5 px-2.5 py-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />مسودة الذكاء الاصطناعي
            </figcaption>
            <img
              src={draftUrl}
              alt="مسودة الذكاء الاصطناعي"
              loading="lazy"
              onClick={() => onView(draftUrl)}
              className="w-full h-auto object-contain cursor-zoom-in"
            />
          </figure>
          <figure className="rounded-xl overflow-hidden border border-success/20 bg-muted/20">
            <figcaption className="text-[11px] font-bold text-success bg-success/5 px-2.5 py-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />أحدث نسخة من المصمم
            </figcaption>
            {versionIsImage ? (
              versionUrl ? (
                <img
                  src={versionUrl}
                  alt="أحدث نسخة من المصمم"
                  loading="lazy"
                  onClick={() => onView(versionUrl)}
                  className="w-full h-auto object-contain cursor-zoom-in"
                />
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">جاري التحميل...</div>
              )
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">
                الملف غير قابل للمعاينة — افتحه من قائمة الإصدارات
              </div>
            )}
          </figure>
        </motion.div>
      )}
    </div>
  );
};

const DesignItemCard = ({
  item,
  idx,
  isExpanded,
  onToggle,
  itemDesigns,
  uploadingItem,
  uploadInfo,
  failedUpload,
  sendingItem,
  printingItem,
  approvalFormItem,
  setApprovalFormItem,
  designerMessages,
  setDesignerMessages,
  fileInputRefs,
  onFileSelect,
  onRetryUpload,
  onSendForApproval,
  onApproveAndPrint,
  onSendExistingToPrint,
  onDeleteDesign,
  faces = 1,
  faceState = null,
  onFaceFileSelect,
  onFaceRetry,
}: DesignItemCardProps) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isTwoFace = faces === 2;
  const canUpload = ['submitted', 'assigned', 'design_uploaded'].includes(item.status);
  // Two-face: both faces of the latest version must exist before sending. Single-face: unchanged.
  const bothFaces = hasBothFaces(itemDesigns);
  const canSendApproval = canUpload && (isTwoFace ? bothFaces : itemDesigns.length > 0);
  const itemDetails = item.details || {};
  const revisions: RevisionEntry[] = (itemDetails.revisions as RevisionEntry[]) || [];
  const aiAttachments: string[] = Array.isArray(itemDetails.attachment_urls) ? itemDetails.attachment_urls : [];
  const hasUploadedDesign = itemDesigns.some(d => d.file_url);
  const isAiDesign = Boolean(itemDetails.is_ai_design);
  const latestUploaded = itemDesigns.find(d => d.file_url);
  // Distinct version count (a two-face version = two rows; count versions, not rows).
  const versionCount = new Set(itemDesigns.map(d => d.version)).size;
  // Show the "ارفع الوجهين" hint once at least one face is up but the pair isn't complete.
  const needsSecondFace = isTwoFace && canUpload && itemDesigns.length > 0 && !bothFaces;

  // Direct approve→print eligibility. AI drafts can ONLY be printed from an uploaded final — the
  // attached AI image is a draft and must never reach the print group (see evaluateDirectPrint).
  // Two-face products additionally require BOTH final faces uploaded.
  const { canDirectPrint, blockedAiDraft } = evaluateDirectPrint({
    canWork: canUpload,
    isAiDesign,
    hasUploadedDesign,
    attachmentCount: aiAttachments.length,
    faces,
    bothFacesUploaded: bothFaces,
  });

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Item Header - clickable */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-right"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-sm">{idx + 1}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-foreground text-sm truncate">
                {item.templates?.name || 'عنصر'}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {SERVICE_LABELS[item.templates?.service_type as ServiceType] || ''}
                {itemDetails.variant_label && ` — ${itemDetails.variant_label}`}
                {itemDetails.quantity && ` • ${Number(itemDetails.quantity).toLocaleString()} نسخة`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={item.status} />
            {itemDesigns.length > 0 && (
              <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {isTwoFace ? `${versionCount} إصدار` : `${itemDesigns.length} تصميم`}
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
              {/* Variant selection (size/shape + product-wide attributes) — tells the designer
                  exactly what to produce, e.g. 'ختم مستطيل 6×4 — لون الحبر: أزرق'. */}
              {itemDetails.variant_label && (
                <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-bold text-primary">
                    {[SERVICE_LABELS[item.templates?.service_type as ServiceType], itemDetails.variant_label]
                      .filter(Boolean).join(' ')}
                    {itemDetails.attributes && Object.keys(itemDetails.attributes as Record<string, unknown>).length > 0 && (
                      ` — ${Object.values(itemDetails.attributes as Record<string, { label: string; value: string }>)
                        .map(a => `${a.label}: ${a.value}`).join('، ')}`
                    )}
                  </p>
                  {itemDetails.gift_quantity ? (
                    <p className="text-xs text-success mt-1 font-medium">
                      +{Number(itemDetails.gift_quantity).toLocaleString('en-US')} هدية
                    </p>
                  ) : null}
                </div>
              )}
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
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5 text-accent-foreground" />
                          التعديلات المطلوبة من الزبون
                        </p>
                        <CopyButton value={itemDetails.edit_request} />
                      </div>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words leading-relaxed">
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
                    <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <p className="text-[11px] font-bold text-muted-foreground">
                          الوصف المُرسل للذكاء الاصطناعي
                        </p>
                        <CopyButton value={itemDetails.ai_prompt} />
                      </div>
                      <p
                        className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono leading-relaxed"
                        dir="ltr"
                      >
                        {itemDetails.ai_prompt}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  تفاصيل الزبون
                </h4>
                {itemDetails.details && <CopyButton value={itemDetails.details} />}
              </div>
              {itemDetails.details ? (
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words bg-muted/30 rounded-xl p-4 border border-border/50">
                  {itemDetails.details}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">لا توجد تفاصيل</p>
              )}
              {aiAttachments.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <p className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Image className="w-4 h-4 text-primary" />
                      مرفقات ({aiAttachments.length})
                    </p>
                    <DownloadAllButton urls={aiAttachments} />
                  </div>
                  {/* Full-size, uncropped images + download — the designer works from these files. */}
                  <AttachmentGallery urls={aiAttachments} />
                </div>
              )}
            </div>

            {/* Upload Section */}
            <div className="p-4">
              {isTwoFace && faceState ? (
                <div className="mb-4">
                  <FaceUploadZones
                    canUpload={canUpload}
                    keyPrefix={item.id}
                    front={faceState.front}
                    back={faceState.back}
                    inputRefs={fileInputRefs}
                    onFileSelect={(e, face) => onFaceFileSelect?.(e, item.id, face)}
                    onRetry={(face) => onFaceRetry?.(item.id, face)}
                  />
                </div>
              ) : (
                <DesignUploadZone
                  canUpload={canUpload}
                  uploading={uploadingItem === item.id}
                  uploadingInfo={uploadInfo}
                  failedFile={failedUpload}
                  hasExisting={itemDesigns.length > 0}
                  inputRef={el => { fileInputRefs.current[item.id] = el; }}
                  onFileSelect={e => onFileSelect(e, item.id)}
                  onPick={() => fileInputRefs.current[item.id]?.click()}
                  onRetry={() => onRetryUpload(item.id)}
                />
              )}

              {/* Two-face: remind the designer both faces are required before sending. */}
              {needsSecondFace && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-4">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ارفع الوجهين قبل الإرسال
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    هذا المنتج بوجهين — ارفع الوجه الأمامي والوجه الخلفي معاً قبل الإرسال للموافقة أو الطبع.
                  </p>
                </div>
              )}

              {/* Design Versions — in-app preview + download (item 5) */}
              {itemDesigns.length > 0 && (
                <div className="mb-4">
                  <DesignVersionList
                    designs={itemDesigns}
                    faces={faces}
                    canDelete={(d) => canUpload && !d.approved}
                    onDelete={onDeleteDesign}
                  />
                </div>
              )}

              {/* AI draft ↔ latest version compare (item 9) */}
              {isAiDesign && hasUploadedDesign && aiAttachments[0] && latestUploaded?.file_url && (
                <AiDraftCompare
                  draftUrl={aiAttachments[0]}
                  versionPath={latestUploaded.file_url}
                  onView={setLightboxUrl}
                />
              )}

              {/* AI draft with no uploaded final: block direct print, explain why (item 2) */}
              {blockedAiDraft && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mt-2">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ارفع التصميم النهائي أولاً
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    لا يمكن طباعة مسودة الذكاء الاصطناعي — جهّز الملف النهائي وارفعه ثم أرسله للطبع.
                  </p>
                </div>
              )}

              {/* Send for Approval */}
              {canSendApproval && (
                <div className="space-y-3 mt-2">
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
              {canDirectPrint && (
                <div className={cn(canSendApproval && 'mt-3 pt-3 border-t border-border/60')}>
                  <Button
                    onClick={() => onApproveAndPrint(item)}
                    disabled={printingItem === item.id}
                    size="lg"
                    className="w-full whitespace-normal bg-success hover:bg-success/90 text-success-foreground rounded-xl"
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

              {/* Revision Notes — version label (item 4) + reference images (item 1) */}
              {revisions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-destructive" />
                    <h4 className="font-bold text-foreground text-sm">ملاحظات الزبون</h4>
                  </div>
                  <div className="space-y-2">
                    {revisions.slice().reverse().map((rev, i) => {
                      const isLatest = i === 0;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'rounded-xl p-3 border',
                            isLatest ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/50 border-border',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                            <p
                              className={cn(
                                'text-xs font-bold flex items-center gap-1',
                                isLatest ? 'text-destructive' : 'text-muted-foreground',
                              )}
                            >
                              {isLatest && <AlertTriangle className="w-3.5 h-3.5" />}
                              {isLatest ? 'آخر تعديل' : 'تعديل سابق'}
                              {typeof rev.version === 'number' && rev.version > 0 && (
                                <span className="font-medium"> — تعديل على الإصدار {rev.version}</span>
                              )}
                            </p>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(rev.date).toLocaleDateString('ar')}
                            </span>
                          </div>
                          <p className="text-foreground text-sm whitespace-pre-wrap break-words">{rev.note}</p>
                          {rev.images && rev.images.length > 0 && (
                            <RevisionImages paths={rev.images} onView={setLightboxUrl} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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

export default DesignItemCard;
