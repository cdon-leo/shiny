'use client';

import { CSSProperties, ReactNode } from 'react';

interface GlitchTextProps {
  children: ReactNode;
  fontSize?: string;
  fontWeight?: number;
  color?: string;
  intensity?: number;
  enableHover?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * GPU-accelerated glitch text effect using CSS animations.
 * Replaces the heavy canvas-based FuzzyText component.
 * 
 * Performance: Zero per-frame JS, pure CSS transforms (GPU composited)
 */
export function GlitchText({
  children,
  fontSize = '4rem',
  fontWeight = 900,
  color = '#fff',
  intensity = 0.18,
  enableHover = false,
  className = '',
  style = {},
}: GlitchTextProps) {
  const text = typeof children === 'string' ? children : String(children);
  
  return (
    <span
      className={`glitch-text ${enableHover ? 'glitch-text-hover' : ''} ${className}`}
      data-text={text}
      style={{
        fontSize,
        fontWeight,
        color,
        '--glitch-intensity': intensity,
        ...style,
      } as CSSProperties}
    >
      {children}
    </span>
  );
}

export default GlitchText;

