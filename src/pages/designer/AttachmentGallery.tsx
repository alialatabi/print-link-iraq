import { useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

/**
 * Designer-facing attachment gallery: images render FULL WIDTH (uncropped, one per row) so the
 * designer sees the whole design at card size, and every attachment gets فتح + تنزيل actions.
 * Non-image files (pdf/tif/psd…) render as a file tile with the same actions.
 *
 * Download note: the `download` attribute is ignored for cross-origin URLs (Supabase storage),
 * so we fetch → blob → object URL to force a real download; falls back to opening the file.
 */

const IMG_RE = /\.(png|jpe?g|webp|gif)(\?|$)/i;

/** Derive a sane filename from a storage URL (last path segment), with a numbered fallback. */
export function attachmentFilename(url: string, index: number): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    if (last && last.includes('.')) return last;
  } catch { /* not a valid URL — fall through */ }
  return `مرفق-${index + 1}`;
}

/**
 * Force a real download of a (possibly cross-origin) storage URL: fetch → blob → object URL, since
 * the `download` attribute is ignored cross-origin. Throws on failure so callers that download many
 * files in sequence (تنزيل كل المرفقات) can decide whether to keep going. `blobDownload` is the raw
 * helper; `downloadAttachment` wraps it with busy state + a per-file fallback toast.
 */
export async function blobDownload(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadAttachment(url: string, filename: string, onBusy: (busy: boolean) => void) {
  onBusy(true);
  try {
    await blobDownload(url, filename);
  } catch {
    // CORS/network hiccup — at least open the original so the designer can save manually.
    toast({ title: 'تعذّر التنزيل المباشر', description: 'تم فتح الملف في تبويب جديد', variant: 'destructive' });
    window.open(url, '_blank', 'noopener,noreferrer');
  } finally {
    onBusy(false);
  }
}

function AttachmentRow({ url, index }: { url: string; index: number }) {
  const [downloading, setDownloading] = useState(false);
  const isImg = IMG_RE.test(url);
  const filename = attachmentFilename(url, index);

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/20">
      {isImg ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title="فتح بالحجم الكامل">
          <img src={url} alt="" loading="lazy" className="w-full h-auto object-contain" />
        </a>
      ) : (
        <div className="flex items-center gap-3 p-4 min-w-0">
          <FileText className="w-8 h-8 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground truncate min-w-0 flex-1" dir="ltr">{filename}</span>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 p-2 border-t border-border/60 bg-card">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg h-8 text-xs"
          disabled={downloading}
          onClick={() => downloadAttachment(url, filename, setDownloading)}
        >
          {downloading
            ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
            : <Download className="w-3.5 h-3.5 ml-1" />}
          تنزيل
        </Button>
        <Button asChild type="button" variant="ghost" size="sm" className="rounded-lg h-8 text-xs">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
            فتح
          </a>
        </Button>
      </div>
    </div>
  );
}

const AttachmentGallery = ({ urls }: { urls: string[] }) => (
  <div className="space-y-3">
    {urls.map((url, i) => <AttachmentRow key={`${url}-${i}`} url={url} index={i} />)}
  </div>
);

export default AttachmentGallery;
