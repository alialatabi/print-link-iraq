import React from 'react';
import { m as motion } from 'framer-motion';
import { Upload, RefreshCw, AlertTriangle, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/designUtils';

/**
 * Designer design-upload dropzone, shared by DesignItemCard (per-item) and ItemlessOrderPanel
 * (order-level). Three states:
 *  - idle: dashed dropzone, click to pick a file,
 *  - uploading: filename + size + an INDETERMINATE progress bar (Supabase storage-js 2.95 exposes
 *    no upload progress events, so a real percentage isn't available — the bar signals liveness),
 *  - failed: a persistent inline error with a one-tap "إعادة المحاولة" that re-uploads the SAME
 *    File (the parent keeps the failed File and wraps the upload in retryAsync).
 *
 * The parent owns the <input> ref (it resets `value` after each upload so the same file can be
 * re-picked) and exposes `onPick` to open the picker — so the child never needs to hold the ref.
 */

interface DesignUploadZoneProps {
  canUpload: boolean;
  uploading: boolean;
  /** filename + size shown during an in-flight upload */
  uploadingInfo?: { name: string; size: number } | null;
  /** the File that failed after all retries — when set, show the persistent error + retry */
  failedFile?: File | null;
  /** true when at least one version already exists (label: "رفع إصدار جديد" vs "رفع التصميم") */
  hasExisting: boolean;
  inputRef: React.Ref<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** open the file picker (parent clicks the input it owns) */
  onPick: () => void;
  onRetry: () => void;
}

const IndeterminateBar = () => (
  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/15 mt-2">
    <motion.div
      className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
      animate={{ x: ['-120%', '360%'] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

const DesignUploadZone = ({
  canUpload,
  uploading,
  uploadingInfo,
  failedFile,
  hasExisting,
  inputRef,
  onFileSelect,
  onPick,
  onRetry,
}: DesignUploadZoneProps) => {
  if (!canUpload) return null;

  return (
    <div className="mb-4">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff"
        onChange={onFileSelect}
        className="hidden"
      />

      {/* Persistent failure: keep the file, offer a one-tap retry (or pick a different file). */}
      {failedFile && !uploading ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-bold text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            فشل رفع الملف بعد عدة محاولات
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground min-w-0">
            <FileWarning className="w-4 h-4 shrink-0" />
            <span className="truncate" dir="ltr">{failedFile.name}</span>
            <span className="shrink-0">· {formatBytes(failedFile.size)}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button onClick={onRetry} size="sm" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <RefreshCw className="w-4 h-4 ml-1.5" />
              إعادة المحاولة
            </Button>
            <Button onClick={onPick} size="sm" variant="outline">
              <Upload className="w-4 h-4 ml-1.5" />
              اختيار ملف آخر
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && onPick()}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 text-center transition-all',
            uploading
              ? 'border-primary/50 bg-primary/5 cursor-default'
              : 'border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer',
          )}
        >
          {uploading ? (
            <>
              <RefreshCw className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
              <p className="text-foreground font-medium text-sm">جاري الرفع...</p>
              {uploadingInfo && (
                <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted-foreground min-w-0">
                  <span className="truncate max-w-[70%]" dir="ltr">{uploadingInfo.name}</span>
                  <span className="shrink-0">· {formatBytes(uploadingInfo.size)}</span>
                </div>
              )}
              <div className="max-w-xs mx-auto"><IndeterminateBar /></div>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-foreground font-medium text-sm">
                {hasExisting ? 'رفع إصدار جديد' : 'رفع التصميم'}
              </p>
              <p className="text-muted-foreground text-xs mt-1">PDF, PNG, JPG, TIF — حتى 10MB</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DesignUploadZone;
