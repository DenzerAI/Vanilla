import { useEffect, useRef } from 'react';
import './welcome-particles.css';

/** A quiet forward drift, isolated from the welcome content and its layout. */
export function WelcomeParticles({ reduceMotion, theme }: { reduceMotion: boolean; theme: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const style = getComputedStyle(canvas);
    const colors = ['--muted', '--project-blue', '--project-purple', '--project-yellow'].map(key => style.getPropertyValue(key).trim());
    const opacity = Number(style.getPropertyValue('--particle-opacity'));
    const layerOpacity = Number(style.getPropertyValue('--particle-layer-opacity'));
    let width = 0, height = 0, frame = 0, previous = 0, elapsed = 0, visible = false;
    const points = Array.from({ length: 165 }, (_, index) => ({
      angle: Math.random() * Math.PI * 2,
      progress: Math.random(),
      layer: index % 3,
      phase: Math.random() * Math.PI * 2,
      color: index % 5 < 2 ? 0 : 1 + index % 3,
    }));
    function draw(delta = 0) {
      if (!context || !canvas) return;
      elapsed += delta;
      context.clearRect(0, 0, width, height);
      const radius = Math.hypot(width, height) * 0.62;
      for (const point of points) {
        point.progress = (point.progress + delta / (125 - point.layer * 25)) % 1;
        const distance = radius * (Math.exp(point.progress * 2) - 1) / (Math.exp(2) - 1);
        const fade = Math.min(1, point.progress * 9, (1 - point.progress) * 8);
        const pulse = 0.8 + 0.2 * Math.sin(elapsed * 0.65 + point.phase);
        context.globalAlpha = fade * pulse * (opacity + point.layer * layerOpacity);
        context.fillStyle = colors[point.color];
        context.beginPath();
        context.arc(width / 2 + Math.cos(point.angle) * distance, height * 0.46 + Math.sin(point.angle) * distance,
          (0.55 + point.layer * 0.25) * (0.65 + point.progress * 0.65), 0, Math.PI * 2);
        context.fill();
      }
    }
    function tick(now: number) {
      frame = 0;
      if (!visible || document.hidden || reduceMotion || media.matches) return;
      if (!previous || now - previous >= 32) {
        draw(previous ? Math.min((now - previous) / 1000, 0.08) : 0);
        previous = now;
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      previous = 0;
      draw();
      if (visible && !document.hidden && !reduceMotion && !media.matches) frame = requestAnimationFrame(tick);
    }
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      sync();
    });
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    resize.observe(canvas); intersection.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    media.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', sync); media.removeEventListener('change', sync);
    };
  }, [reduceMotion, theme]);
  return <canvas ref={ref} className="welcome-particles" aria-hidden="true" />;
}
