'use client';

import { motion } from 'motion/react';
import { ANIMATION_TIMING } from './helpers';

export type AnimationMode = 'expand' | 'fadeIn' | 'none';

export interface AnimatedBarProps {
  /** The formatted value to display inside the bar */
  displayValue: string;
  /** Height as a percentage (0-100) */
  heightPercent: number;
  /** Animation delay in seconds */
  delay: number;
  /** Animation mode: 'expand' for grow animation, 'fadeIn' for opacity only, 'none' for immediate */
  animationMode?: AnimationMode;
  /** Bar color */
  color?: string;
  /** Bar width in pixels */
  width?: number;
  /** Text color */
  textColor?: string | undefined;
}

export function AnimatedBar({
  displayValue,
  heightPercent,
  delay,
  animationMode = 'expand',
  color = '#171717',
  width = 100,
  textColor,
}: AnimatedBarProps) {
  const { BAR_EXPAND_DURATION, BAR_VALUE_DELAY, QUICK_APPEAR } = ANIMATION_TIMING;
  
  // Determine initial and transition values based on animation mode
  const getBarAnimation = () => {
    switch (animationMode) {
      case 'expand':
        return {
          initial: { height: 0, opacity: 1 },
          animate: { height: `${heightPercent}%`, opacity: 1 },
          transition: { duration: BAR_EXPAND_DURATION, delay, ease: "anticipate" as const },
        };
      case 'fadeIn':
        return {
          initial: { height: `${heightPercent}%`, opacity: 0 },
          animate: { height: `${heightPercent}%`, opacity: 1 },
          transition: { duration: QUICK_APPEAR, delay },
        };
      case 'none':
      default:
        return {
          initial: { height: `${heightPercent}%`, opacity: 1 },
          animate: { height: `${heightPercent}%`, opacity: 1 },
          transition: { duration: 0 },
        };
    }
  };

  const barAnimation = getBarAnimation();
  const textDelay = animationMode === 'expand' ? delay + BAR_VALUE_DELAY : delay;
  
  return (
    <div
      className="relative flex items-end justify-center"
      style={{ width, height: '100%' }}
    >
      <motion.div
        className="relative flex items-start justify-center"
        style={{
          width: '100%',
          borderRadius: '4px 4px 2px 2px',
          backgroundColor: color,
        }}
        initial={barAnimation.initial}
        animate={barAnimation.animate}
        transition={barAnimation.transition}
      >
        <motion.span
          className={`absolute top-2 text-2xl font-bold whitespace-pre-line text-center leading-tight ${textColor ? `` : 'text-white/70'}`}
          style={{ color: textColor ? textColor : '' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: QUICK_APPEAR, delay: textDelay }}
        >
          {displayValue}
        </motion.span>
      </motion.div>
    </div>
  );
}

