import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { LiveOverlayBox } from "@/types/session";

type LiveOverlayProps = {
  containerRef: React.RefObject<HTMLElement>;
  boxes: LiveOverlayBox[];
  sourceWidth: number;
  sourceHeight: number;
  enabled?: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function LiveOverlay({
  containerRef,
  boxes,
  sourceWidth,
  sourceHeight,
  enabled = true,
}: LiveOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = size;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!enabled || boxes.length === 0) return;

    const sourceAspect = sourceWidth / sourceHeight;
    const containerAspect = width / height;
    const drawWidth =
      containerAspect > sourceAspect ? height * sourceAspect : width;
    const drawHeight =
      containerAspect > sourceAspect ? height : width / sourceAspect;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    ctx.lineWidth = 2;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "top";

    boxes.forEach((box) => {
      const x = offsetX + clamp01(box.xmin) * drawWidth;
      const y = offsetY + clamp01(box.ymin) * drawHeight;
      const w = clamp01(box.width) * drawWidth;
      const h = clamp01(box.height) * drawHeight;
      if (w <= 0 || h <= 0) return;

      ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
      ctx.fillStyle = "rgba(14, 116, 144, 0.2)";
      ctx.strokeRect(x, y, w, h);
      ctx.fillRect(x, y, w, h);

      const label = [box.label, box.score != null ? `${Math.round(box.score * 100)}%` : ""]
        .filter(Boolean)
        .join(" ");
      if (label) {
        const padding = 4;
        const textWidth = ctx.measureText(label).width;
        const textX = x;
        const textY = Math.max(0, y - 18);
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(textX, textY, textWidth + padding * 2, 16);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, textX + padding, textY + 2);
      }
    });
  }, [boxes, enabled, size, sourceWidth, sourceHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    />
  );
}
