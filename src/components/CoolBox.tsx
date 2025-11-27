'use client';

import './CoolBox.css';

interface CoolBoxProps {
  children: React.ReactNode;
  color: string;
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function CoolBox({ children, color }: CoolBoxProps) {
  const rgb = hexToRgb(color);
  
  // Create CSS custom properties for the color at various opacities
  const cssVars = {
    '--box-color': color,
    '--box-color-04': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.04)`,
    '--box-color-08': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`,
    '--box-color-10': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)`,
    '--box-color-12': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    '--box-color-15': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    '--box-color-18': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`,
    '--box-color-20': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`,
    '--box-color-30': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.30)`,
    '--box-color-35': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
    '--box-color-40': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.40)`,
    '--box-color-60': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.60)`,
  } as React.CSSProperties;

  return (
    <div
      className="cool-box flex-1 min-h-0 p-4"
      style={cssVars}
    >
      {/* Corner glows */}
      <div className="cool-box-corner-tl" />
      <div className="cool-box-corner-br" />
      
      {/* Shimmer effect */}
      <div className="cool-box-shimmer-container">
        <div className="cool-box-shimmer" />
      </div>
      
      {/* Top edge highlight */}
      <div className="cool-box-edge" />
      
      {/* Content */}
      <div className="cool-box-content">
        {children}
      </div>
    </div>
  );
}
