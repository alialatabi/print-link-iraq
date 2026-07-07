import { useState } from 'react';
import { m as motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ImageLightbox from '@/components/ImageLightbox';
import { CheckCircle2, Download, ExternalLink, Eye, FileText, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl, isImageUrl, FACE_LABELS, type DesignFace } from '@/lib/designUtils';
import type { DesignVersion } from '@/pages/designer/DesignItemCard';

/**
 * Designer-facing list of uploaded design versions with in-app preview + download.
 *
 * Replaces the old "عرض → window.open(signed url)" flow shared by DesignItemCard and
 * ItemlessOrderPanel:
 *  - image versions (png/jpg/webp…) open in the shared ImageLightbox (in-app, deters casual save),
 *  - non-browser-renderable versions (pdf/tif/psd…) keep open-in-a-new-tab,
 *  - EVERY version gains a تنزيل action that forces a real download via a
 *    Content-Disposition-attachment signed URL (getDesignSignedUrl's downloadName).
 *
 * Two-face products (`faces === 2`) group each version's two rows (أمامي / خلفي) under one
 * version header; every face keeps its own عرض/تنزيل and its own trash action (per-face delete —
 * re-uploading a deleted face refills the SAME version, see nextFaceUpload). Single-face rendering
 * (the default) is unchanged.
 *
 * Owns its own lightbox so both panels reuse it with zero extra wiring. `canDelete` decides which
 * rows show the trash action (DesignItemCard hides it for approved versions; ItemlessOrderPanel
 * shows it whenever the order is still editable).
 */

function versionDownloadName(design: DesignVersion): string {
  const ext = (design.file_url?.split('?')[0].split('.').pop() || 'file').toLowerCase();
  const face = design.face ? `-${design.face === 'front' ? 'أمامي' : 'خلفي'}` : '';
  return `تصميم-الإصدار-${design.version}${face}.${ext}`;
}

function triggerDownload(url: string, filename: string): void {
  // The signed URL already carries Content-Disposition: attachment, so a plain anchor click
  // downloads it even cross-origin (where the `download` attribute alone is ignored).
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** View + forced-download actions for one design file. Shared by single-face rows and face rows. */
function useDesignFileActions(design: DesignVersion, onView: (url: string) => void) {
  const [viewing, setViewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isImage = isImageUrl(design.file_url);

  const handleView = async () => {
    if (!design.file_url) return;
    setViewing(true);
    try {
      const url = await getDesignSignedUrl(design.file_url);
      if (!url) { toast({ title: 'فشل فتح الملف', variant: 'destructive' }); return; }
      if (isImage) onView(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setViewing(false);
    }
  };

  const handleDownload = async () => {
    if (!design.file_url) return;
    setDownloading(true);
    try {
      const url = await getDesignSignedUrl(design.file_url, versionDownloadName(design));
      if (!url) { toast({ title: 'تعذّر التنزيل', variant: 'destructive' }); return; }
      triggerDownload(url, versionDownloadName(design));
    } finally {
      setDownloading(false);
    }
  };

  return { isImage, viewing, downloading, handleView, handleDownload };
}

/** Compact view/download/delete action cluster for one design file. */
const FileActions = ({
  design,
  canDelete,
  onDelete,
  onView,
}: {
  design: DesignVersion;
  canDelete: boolean;
  onDelete?: (design: DesignVersion) => void | Promise<void>;
  onView: (url: string) => void;
}) => {
  const { isImage, viewing, downloading, handleView, handleDownload } = useDesignFileActions(design, onView);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {design.approved && (
        <span className="text-[11px] bg-success/10 text-success px-2 py-0.5 rounded-full flex items-center gap-1 mr-1">
          <CheckCircle2 className="w-3 h-3" />معتمد
        </span>
      )}
      {design.file_url && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="px-2.5 text-xs"
            onClick={handleView}
            disabled={viewing}
            title={isImage ? 'عرض' : 'فتح في تبويب'}
          >
            {viewing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isImage
                ? <Eye className="w-4 h-4 ml-1" />
                : <ExternalLink className="w-4 h-4 ml-1" />}
            {isImage ? 'عرض' : 'فتح'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="px-2.5 text-xs"
            onClick={handleDownload}
            disabled={downloading}
            title="تنزيل"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 ml-1" />}
            تنزيل
          </Button>
        </>
      )}
      {canDelete && onDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="px-2.5 text-xs text-destructive"
          onClick={() => onDelete(design)}
          title="حذف"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

const VersionRow = ({
  design,
  index,
  canDelete,
  onDelete,
  onView,
}: {
  design: DesignVersion;
  index: number;
  canDelete: boolean;
  onDelete?: (design: DesignVersion) => void | Promise<void>;
  onView: (url: string) => void;
}) => (
  <div
    className={cn(
      'rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
      index === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border border-border',
    )}
  >
    <div className="flex items-center gap-3 min-w-0">
      <FileText className={cn('w-4 h-4 shrink-0', index === 0 ? 'text-primary' : 'text-muted-foreground')} />
      <div className="min-w-0">
        <p className="font-medium text-foreground text-sm">
          الإصدار {design.version}{' '}
          {index === 0 && <span className="text-primary text-xs mr-1">(الأحدث)</span>}
        </p>
        <p className="text-muted-foreground text-[11px]">
          {new Date(design.uploaded_at).toLocaleDateString('ar')}
        </p>
      </div>
    </div>
    <FileActions design={design} canDelete={canDelete} onDelete={onDelete} onView={onView} />
  </div>
);

/** One face (أمامي / خلفي) inside a two-face version group. */
const FaceRow = ({
  face,
  design,
  canDelete,
  onDelete,
  onView,
}: {
  face: DesignFace;
  design: DesignVersion | undefined;
  canDelete: boolean;
  onDelete?: (design: DesignVersion) => void | Promise<void>;
  onView: (url: string) => void;
}) => (
  <div className="rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-background/60 border border-border/60">
    <p className="text-xs font-medium text-foreground shrink-0">{FACE_LABELS[face]}</p>
    {design ? (
      <FileActions design={design} canDelete={canDelete} onDelete={onDelete} onView={onView} />
    ) : (
      <span className="text-[11px] text-muted-foreground">لم يُرفع بعد</span>
    )}
  </div>
);

/** A two-face version: header + its front/back rows. */
const FaceVersionGroup = ({
  version,
  front,
  back,
  isLatest,
  uploadedAt,
  canDelete,
  onDelete,
  onView,
}: {
  version: number;
  front: DesignVersion | undefined;
  back: DesignVersion | undefined;
  isLatest: boolean;
  uploadedAt: string;
  canDelete?: (design: DesignVersion, index: number) => boolean;
  onDelete?: (design: DesignVersion) => void | Promise<void>;
  onView: (url: string) => void;
}) => (
  <div className={cn('rounded-xl p-3 space-y-2', isLatest ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border border-border')}>
    <div className="flex items-center justify-between gap-2">
      <p className="font-medium text-foreground text-sm">
        الإصدار {version}{' '}
        {isLatest && <span className="text-primary text-xs mr-1">(الأحدث)</span>}
      </p>
      <p className="text-muted-foreground text-[11px]">{new Date(uploadedAt).toLocaleDateString('ar')}</p>
    </div>
    <FaceRow face="front" design={front} canDelete={!!front && !!canDelete && canDelete(front, isLatest ? 0 : 1)} onDelete={onDelete} onView={onView} />
    <FaceRow face="back" design={back} canDelete={!!back && !!canDelete && canDelete(back, isLatest ? 0 : 1)} onDelete={onDelete} onView={onView} />
  </div>
);

interface FaceGroup {
  version: number;
  front?: DesignVersion;
  back?: DesignVersion;
  uploadedAt: string;
}

/** Group the (version-desc sorted) two-face designs by version, newest first. */
function groupFaces(designs: DesignVersion[]): FaceGroup[] {
  const byVersion = new Map<number, FaceGroup>();
  for (const d of designs) {
    const g = byVersion.get(d.version) ?? { version: d.version, uploadedAt: d.uploaded_at };
    if (d.face === 'front') g.front = d;
    else if (d.face === 'back') g.back = d;
    // Show the newest upload date within the version.
    if (new Date(d.uploaded_at) > new Date(g.uploadedAt)) g.uploadedAt = d.uploaded_at;
    byVersion.set(d.version, g);
  }
  return [...byVersion.values()].sort((a, b) => b.version - a.version);
}

const DesignVersionList = ({
  designs,
  faces = 1,
  canDelete,
  onDelete,
}: {
  designs: DesignVersion[];
  /** 2 groups each version's two faces under one header; 1 (default) is unchanged. */
  faces?: 1 | 2;
  canDelete?: (design: DesignVersion, index: number) => boolean;
  onDelete?: (design: DesignVersion) => void | Promise<void>;
}) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  if (designs.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      {faces === 2
        ? groupFaces(designs).map((g, i) => (
            <FaceVersionGroup
              key={g.version}
              version={g.version}
              front={g.front}
              back={g.back}
              isLatest={i === 0}
              uploadedAt={g.uploadedAt}
              canDelete={canDelete}
              onDelete={onDelete}
              onView={setLightboxUrl}
            />
          ))
        : designs.map((design, i) => (
            <VersionRow
              key={design.id}
              design={design}
              index={i}
              canDelete={canDelete ? canDelete(design, i) : false}
              onDelete={onDelete}
              onView={setLightboxUrl}
            />
          ))}
      <ImageLightbox
        src={lightboxUrl}
        open={!!lightboxUrl}
        onOpenChange={o => { if (!o) setLightboxUrl(null); }}
      />
    </motion.div>
  );
};

export default DesignVersionList;
