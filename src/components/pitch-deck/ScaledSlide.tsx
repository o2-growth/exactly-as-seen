import { useEffect, useRef, useState } from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders children at fixed 1920x1080 and scales to fit the parent container.
 * Parent must be position:relative and have a defined size.
 */
export default function ScaledSlide({ children, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current?.parentElement;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(w / 1920, h / 1080);
      setScale(s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`slide-content ${className ?? ''}`}
      style={{
        position: 'absolute',
        width: 1920,
        height: 1080,
        left: '50%',
        top: '50%',
        marginLeft: -960,
        marginTop: -540,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      {children}
    </div>
  );
}
