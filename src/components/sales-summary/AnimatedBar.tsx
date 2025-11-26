'use client';

import { motion } from 'motion/react';

export interface AnimatedBarProps {
  /** The formatted value to display inside the bar */
  displayValue: string;
  /** Height as a percentage (0-100) */
  heightPercent: number;
  /** Animation delay in seconds */
  delay: number;
  /** Whether to animate the bar (false = show immediately) */
  animate?: boolean;
  /** Bar color */
  color?: string;
  /** Bar width in pixels */
  width?: number;
}

export function AnimatedBar({
  displayValue,
  heightPercent,
  delay,
  animate = true,
  color = '#171717',
  width = 80,
}: AnimatedBarProps) {
  return (
    <div
      className="relative flex items-end justify-center"
      style={{ width, height: '100%' }}
    >
      <motion.div
        className="relative flex items-start justify-center rounded"
        style={{
          width: '100%',
          backgroundColor: color,
        }}
        initial={{ height: animate ? 0 : `${heightPercent}%` }}
        animate={{ height: `${heightPercent}%` }}
        transition={animate ? {
          duration: 2.5,
          delay,
          ease: [0.25, 0.1, 0.25, 1],
        } : { duration: 0 }}
      >
        <motion.span
          className="absolute top-3 text-sm font-semibold text-background whitespace-pre-line text-center leading-tight"
          initial={{ opacity: animate ? 0 : 1 }}
          animate={{ opacity: 1 }}
          transition={animate ? { duration: 0.3, delay: delay + 2 } : { duration: 0 }}
        >
          {displayValue}
        </motion.span>
      </motion.div>
    </div>
  );
}

