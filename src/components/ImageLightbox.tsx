import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * In-app viewer for customer-facing design previews. Opens the image in a modal
 * *inside the app* — never a new browser tab — so the raw file URL is never
 * handed to the customer, and actively deters casual saving:
 *  - the image is painted as a CSS background (there is no <img> element to
 *    "Save image as" on desktop or long-press-save on mobile),
 *  - right-click, drag, and text/callout selection are blocked.
 *
 * This is a deterrent, not DRM: a determined user with devtools or a screenshot
 * can still capture the pixels. The goal is to stop one-click/long-press theft.
 */
const blockSave = (e: React.SyntheticEvent) => e.preventDefault();

interface ImageLightboxProps {
  /** Image URL to show (public or signed). When empty the dialog stays blank. */
  src?: string | null;
  /** Accessible label / alt text. */
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImageLightbox = ({ src, alt = 'تصميم', open, onOpenChange }: ImageLightboxProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      dir="rtl"
      onContextMenu={blockSave}
      className="max-w-3xl w-[calc(100%-1.5rem)] border-0 bg-transparent p-0 shadow-none text-white [&>button]:bg-black/60 [&>button]:text-white [&>button]:rounded-full [&>button]:p-1.5 [&>button]:opacity-90 [&>button]:right-3 [&>button]:top-3"
    >
      <DialogTitle className="sr-only">{alt}</DialogTitle>
      <div
        role="img"
        aria-label={alt}
        onContextMenu={blockSave}
        onDragStart={blockSave}
        style={src ? { backgroundImage: `url("${src}")` } : undefined}
        className="aspect-square w-full select-none rounded-2xl bg-black/30 bg-contain bg-center bg-no-repeat shadow-2xl [-webkit-touch-callout:none] sm:aspect-auto sm:h-[82dvh]"
      />
    </DialogContent>
  </Dialog>
);

export default ImageLightbox;
