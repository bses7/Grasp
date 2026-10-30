"use client";

/**
 * Easter egg portal (dev sessions only): a ring of sparks drawn on a 2D canvas behind the transparent 3D canvas.
 * Sparks are born on the ring, fly off along it (the direction the circles were drawn), cool from white through
 * orange to red, and some drip under gravity. The ring opens, holds, and collapses over PORTAL_MS.
 * Off-palette on purpose; it never appears in study sessions.
 */
import { useEffect, useRef } from "react";

export const PORTAL_MS = 2600;
const OPEN_MS = 450;
const CLOSE_MS = 500;
const SPARKS_PER_FRAME = 60;

type Spark = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  w: number;
  drip: boolean;
};

export function SparkPortal({
  clockwise,
  reducedMotion,
}: {
  clockwise: boolean;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(
    () =>
      ref.current
        ? runPortal(ref.current, clockwise, reducedMotion)
        : undefined,
    [clockwise, reducedMotion],
  );
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute top-[46%] left-1/2 aspect-square w-[min(84vmin,680px)] -translate-1/2"
    />
  );
}

/** Animate the portal on `c` (sized by CSS); returns a cancel function. */
export function runPortal(
  c: HTMLCanvasElement,
  clockwise: boolean,
  reducedMotion: boolean,
): () => void {
  const ctx = c.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = c.clientWidth;
  c.width = c.height = size * dpr;
  ctx.scale(dpr, dpr);
  const mid = size / 2;
  const R = size * 0.4;
  const dir = clockwise ? 1 : -1;
  const sparks: Spark[] = [];
  const t0 = performance.now();
  let raf = 0;

  const radiusAt = (ms: number) => {
    if (ms < OPEN_MS) return R * (1 - (1 - ms / OPEN_MS) ** 3);
    if (ms > PORTAL_MS - CLOSE_MS)
      return R * Math.max(0, (PORTAL_MS - ms) / CLOSE_MS) ** 0.6;
    return R * (1 + 0.015 * Math.sin(ms / 60)); // a living edge, never a perfect circle
  };

  const frame = (now: number) => {
    const ms = now - t0;
    const r = radiusAt(ms);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, size, size);

    // Soft heat glow under the sparks.
    if (r > 2) {
      const g = ctx.createRadialGradient(
        mid,
        mid,
        r * 0.86,
        mid,
        mid,
        r * 1.14,
      );
      g.addColorStop(0, "rgba(255,120,20,0)");
      g.addColorStop(0.5, `rgba(255,110,10,${0.4 + 0.1 * Math.random()})`);
      g.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mid, mid, r * 1.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emit along the ring, flying tangentially in the drawn direction.
    if (!reducedMotion && ms < PORTAL_MS - CLOSE_MS * 0.6) {
      for (let i = 0; i < SPARKS_PER_FRAME; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = r + (Math.random() - 0.5) * 6;
        const x = mid + rr * Math.cos(a);
        const y = mid + rr * Math.sin(a);
        const speed = 3 + Math.random() * 6;
        const out = (Math.random() - 0.35) * 1.4; // mostly outward spray
        const max = 16 + Math.random() * 30;
        sparks.push({
          x,
          y,
          px: x,
          py: y,
          vx: -Math.sin(a) * speed * dir + Math.cos(a) * out,
          vy: Math.cos(a) * speed * dir + Math.sin(a) * out,
          life: 0,
          max,
          w: 1 + Math.random() * 2,
          drip: Math.random() < 0.18,
        });
      }
    }

    // Normal blending: additive "lighter" washes out to white over the light studio backdrop.
    ctx.lineCap = "round";
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!;
      s.px = s.x;
      s.py = s.y;
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.96;
      s.vy = s.vy * 0.96 + (s.drip ? 0.22 : 0.02);
      if (++s.life > s.max) {
        sparks.splice(i, 1);
        continue;
      }
      const k = s.life / s.max; // 0 hot .. 1 cold
      const flicker = 0.7 + 0.3 * Math.random();
      const [cr, cg, cb] = k < 0.2 ? [255, 240, 185] : k < 0.55 ? [255, 160, 35] : [215, 70, 10];
      const a = (1 - k) * flicker;
      ctx.beginPath();
      ctx.moveTo(s.px - s.vx * 3, s.py - s.vy * 3); // a streak, not a dot
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = `rgba(255,110,0,${a * 0.3})`; // glow
      ctx.lineWidth = s.w * 3.2;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`; // core
      ctx.lineWidth = s.w * (1 - k * 0.5);
      ctx.stroke();
    }

    // The hot rim itself: an orange band with a white-hot line in it.
    if (r > 2) {
      ctx.beginPath();
      ctx.arc(mid, mid, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,120,10,${0.55 + 0.2 * Math.random()})`;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,236,190,${0.8 + 0.2 * Math.random()})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (ms < PORTAL_MS || sparks.length) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, size, size);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
