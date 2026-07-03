import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { attachmentFilename, blobDownload } from '@/pages/designer/AttachmentGallery';

/**
 * "تنزيل كل المرفقات" — downloads every attachment in sequence, reusing AttachmentGallery's
 * blob-download helper (fetch → blob → object URL, so cross-origin storage URLs still save).
 * Sequential (not parallel) so browsers don't block a burst of simultaneous downloads. Reports
 * how many succeeded; if any failed, the per-file rows still offer individual تنزيل/فتح.
 */
const DownloadAllButton = ({ urls, className }: { urls: string[]; className?: string }) => {
  const [busy, setBusy] = useState(false);
  if (urls.length < 2) return null; // a single attachment already has its own تنزيل button

  const downloadAll = async () => {
    setBusy(true);
    let ok = 0;
    for (let i = 0; i < urls.length; i++) {
      try {
        await blobDownload(urls[i], attachmentFilename(urls[i], i));
        ok++;
      } catch {
        /* keep going — a partial failure shouldn't abort the rest */
      }
    }
    setBusy(false);
    if (ok === urls.length) {
      toast({ title: 'تم تنزيل كل المرفقات', description: `${ok} من ${urls.length}` });
    } else if (ok > 0) {
      toast({ title: 'تم تنزيل بعض المرفقات', description: `${ok} من ${urls.length} — نزّل الباقي يدوياً`, variant: 'destructive' });
    } else {
      toast({ title: 'تعذّر تنزيل المرفقات', description: 'جرّب تنزيلها فردياً', variant: 'destructive' });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={downloadAll}
      disabled={busy}
      className={className}
    >
      {busy ? <Loader2 className="w-4 h-4 ml-1.5 animate-spin" /> : <Download className="w-4 h-4 ml-1.5" />}
      تنزيل كل المرفقات ({urls.length})
    </Button>
  );
};

export default DownloadAllButton;
