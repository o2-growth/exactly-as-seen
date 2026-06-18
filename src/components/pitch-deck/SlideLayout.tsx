import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'dark' | 'light';
  page?: number;
  total?: number;
  className?: string;
}

/**
 * Wrapper for slide content with consistent O2 chrome (logo + page counter).
 * variant: 'dark' = navy bg (default), 'light' = white bg.
 */
export default function SlideLayout({ children, variant = 'dark', page, total, className }: Props) {
  const isDark = variant === 'dark';
  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className ?? ''}`}
      style={{
        width: 1920, height: 1080,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#e2e8f0' : '#0f172a',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Top chrome: brand */}
      <div className="absolute top-12 left-16 flex items-center gap-3">
        <div
          className="flex items-center justify-center font-black"
          style={{
            background: '#6BF169',
            color: '#0f172a',
            width: 64, height: 64,
            borderRadius: 12,
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 28,
            letterSpacing: '-0.05em',
          }}
        >
          O2
        </div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>
          O2 INC.
        </div>
      </div>

      {/* Page counter */}
      {page !== undefined && total !== undefined && (
        <div
          className="absolute bottom-12 right-16 slide-chrome"
          style={{ color: isDark ? '#64748b' : '#94a3b8', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {String(page).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
      )}

      {/* Accent corner */}
      <div className="absolute bottom-12 left-16" style={{ width: 48, height: 4, background: '#6BF169' }} />

      <div className="relative w-full h-full">{children}</div>
    </div>
  );
}
