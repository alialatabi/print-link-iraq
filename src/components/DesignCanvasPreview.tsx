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
  fontFamily?: string;
  rotation?: number;
  letterSpacing?: number;
  opacity?: number;
  textDecoration?: string;
  lineHeight?: number;
}

interface DesignCanvasPreviewProps {
  imageUrl: string;
  fields: TextField[];
  values: Record<string, string>;
  className?: string;
}

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

      ctx.drawImage(img, 0, 0);

      fields.forEach(field => {
        const text = values[field.key] || '';
        if (!text) return;

        const x = (field.x / 100) * canvas.width;
        const y = (field.y / 100) * canvas.height;
        const maxW = (field.maxWidth / 100) * canvas.width;
        const scaledFontSize = (field.fontSize / 100) * canvas.width * 0.25;
        const fontFamily = field.fontFamily || 'Cairo';
        const weightStr = field.fontWeight === 'bold' ? 'bold' : field.fontWeight === 'lighter' ? '300' : 'normal';
        const lineHeightMul = field.lineHeight ?? 1.3;
        const opacity = (field.opacity ?? 100) / 100;
        const rotation = field.rotation || 0;
        const letterSpacing = field.letterSpacing || 0;
        const textDecoration = field.textDecoration || 'none';

        ctx.save();
        ctx.globalAlpha = opacity;

        // Rotation
        if (rotation !== 0) {
          ctx.translate(x, y);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-x, -y);
        }

        ctx.font = `${weightStr} ${scaledFontSize}px ${fontFamily}, sans-serif`;
        ctx.fillStyle = field.fontColor;
        ctx.textAlign = field.textAlign as CanvasTextAlign;
        ctx.textBaseline = 'middle';

        // Letter spacing workaround
        const drawText = (txt: string, tx: number, ty: number) => {
          if (letterSpacing && letterSpacing !== 0) {
            // Draw character by character for letter spacing
            const chars = txt.split('');
            let currentX = tx;
            // Adjust starting position based on textAlign
            if (field.textAlign === 'center') {
              const totalWidth = chars.reduce((sum, c) => sum + ctx.measureText(c).width + letterSpacing, -letterSpacing);
              currentX = tx - totalWidth / 2;
            } else if (field.textAlign === 'right') {
              const totalWidth = chars.reduce((sum, c) => sum + ctx.measureText(c).width + letterSpacing, -letterSpacing);
              currentX = tx - totalWidth;
            }
            ctx.textAlign = 'left';
            chars.forEach(char => {
              ctx.fillText(char, currentX, ty);
              currentX += ctx.measureText(char).width + letterSpacing;
            });
            // Reset
            ctx.textAlign = field.textAlign as CanvasTextAlign;
          } else {
            ctx.fillText(txt, tx, ty);
          }

          // Text decoration
          if (textDecoration !== 'none') {
            const metrics = ctx.measureText(txt);
            let lineX = tx;
            if (field.textAlign === 'center') lineX = tx - metrics.width / 2;
            else if (field.textAlign === 'right') lineX = tx - metrics.width;

            ctx.strokeStyle = field.fontColor;
            ctx.lineWidth = Math.max(1, scaledFontSize * 0.05);
            ctx.beginPath();
            const offsetY = textDecoration === 'underline' ? ty + scaledFontSize * 0.35 : ty;
            ctx.moveTo(lineX, offsetY);
            ctx.lineTo(lineX + metrics.width, offsetY);
            ctx.stroke();
          }
        };

        // Text wrapping
        const words = text.split(' ');
        let line = '';
        let lineY = y;
        const lineHeight = scaledFontSize * lineHeightMul;

        words.forEach(word => {
          const testLine = line ? line + ' ' + word : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxW && line) {
            drawText(line, x, lineY);
            line = word;
            lineY += lineHeight;
          } else {
            line = testLine;
          }
        });
        if (line) {
          drawText(line, x, lineY);
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
