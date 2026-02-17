import { useRef, useEffect } from 'react';

interface TextField {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontColor: string;
  fontWeight: string;
  textAlign: string;
  maxWidth: number;
  placeholder: string;
}

interface DesignCanvasPreviewProps {
  imageUrl: string;
  fields: TextField[];
  values: Record<string, string>;
  className?: string;
}

/**
 * Renders template image with text fields overlaid using Canvas API.
 * Used for customer preview and final design generation.
 */
const DesignCanvasPreview = ({ imageUrl, fields, values, className = '' }: DesignCanvasPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw template image
      ctx.drawImage(img, 0, 0);

      // Draw each text field
      fields.forEach(field => {
        const text = values[field.key] || '';
        if (!text) return;

        const x = (field.x / 100) * canvas.width;
        const y = (field.y / 100) * canvas.height;
        const maxW = (field.maxWidth / 100) * canvas.width;

        // Scale font size relative to canvas
        const scaledFontSize = (field.fontSize / 100) * canvas.width * 0.25;

        ctx.save();
        ctx.font = `${field.fontWeight === 'bold' ? 'bold' : field.fontWeight === 'lighter' ? '300' : 'normal'} ${scaledFontSize}px Cairo, sans-serif`;
        ctx.fillStyle = field.fontColor;
        ctx.textAlign = field.textAlign as CanvasTextAlign;
        ctx.textBaseline = 'middle';

        // Simple text wrapping
        const words = text.split(' ');
        let line = '';
        let lineY = y;
        const lineHeight = scaledFontSize * 1.3;

        words.forEach(word => {
          const testLine = line ? line + ' ' + word : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxW && line) {
            ctx.fillText(line, x, lineY);
            line = word;
            lineY += lineHeight;
          } else {
            line = testLine;
          }
        });
        if (line) {
          ctx.fillText(line, x, lineY);
        }

        ctx.restore();
      });
    };
    img.src = imageUrl;
  }, [imageUrl, fields, values]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full rounded-xl border border-border ${className}`}
    />
  );
};

export default DesignCanvasPreview;
