import { useState } from 'react';
import { m as motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ImageLightbox from '@/components/ImageLightbox';
import { CheckCircle2, Download, ExternalLink, Eye, FileText, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl, isImageUrl } from '@/lib/designUtils';
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
 * Owns its own lightbox so both panels reuse it with zero extra wiring. `canDelete` decides which
 * rows show the trash action (DesignItemCard hides it for approved versions; ItemlessOrderPanel
 * shows it whenever the order is still editable).
 */

function versionDownloadName(design: DesignVersion): string {
  const ext = (design.file_url?.split('?')[0].split('.').pop() || 'file').toLowerCase();
  return `تصميم-الإصدار-${design.version}.${ext}`;
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
}) => {
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

  return (
    <div
      className={cn(
        'rounded-lg p-3 flex items-center justify-between gap-3',
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
      <div className="flex items-center gap-1">
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
    </div>
  );
};

const DesignVersionList = ({
  designs,
  canDelete,
  onDelete,
}: {
  designs: DesignVersion[];
  canDelete?: (design: DesignVersion, index: number) => boolean;
  onDelete?: (design: DesignVersion) => void | Promise<void>;
}) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  if (designs.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      {designs.map((design, i) => (
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
