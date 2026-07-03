import { useEffect, useState } from 'react';
import { createRevisionSignedUrl } from '@/services/orders';

/**
 * Renders a customer's revision-reference thumbnails (private `order-attachments` bucket paths).
 * Resolves each path to a short-lived signed URL, then shows a grid of tappable thumbnails that
 * open the shared `ImageLightbox` via the parent-owned `onView` callback.
 *
 * Shared by the customer tracking view (OrderItemCard) and the designer order view (DesignItemCard)
 * so both render revision attachments identically. Extracted from OrderItemCard with zero behavior
 * change on the customer side.
 */
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

export default RevisionImages;
