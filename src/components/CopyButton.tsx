import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * One-tap copy-to-clipboard button. Copies `value`, shows a "تم النسخ" toast and a brief inline
 * check, and falls back gracefully when the Clipboard API is unavailable (older in-app webviews).
 */
const CopyButton = ({
  value,
  label = 'نسخ',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Legacy fallback for webviews without the async Clipboard API.
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(true);
      toast({ title: 'تم النسخ' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'تعذّر النسخ', variant: 'destructive' });
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copy}
      className={cn('h-8 min-h-8 gap-1.5 text-xs', className)}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      {label}
    </Button>
  );
};

export default CopyButton;
