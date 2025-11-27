'use client';

import { useState, useEffect, useRef } from 'react';
import LaserFlow from './LaserFlow';
import GlitchText from './GlitchText';
import { useAnticipation } from './AnticipationContext';

/**
 * Sales incoming overlay with laser animation and countdown.
 * 
 * Optimizations:
 * - Uses CSS-based GlitchText instead of canvas-based FuzzyText
 * - Flat component structure (no nested Countdown component)
 * - Single timer for countdown instead of multiple useEffects
 * - LaserFlow pauses when not visible
 */
export default function SalesIncoming() {
  const { state, countdownSeconds, hide } = useAnticipation();
  const [count, setCount] = useState(countdownSeconds);
  const hasStartedRef = useRef(false);
  
  const isShowing = state === 'showing';

  // Reset and run countdown when overlay becomes visible
  useEffect(() => {
    if (isShowing && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setCount(countdownSeconds);
    } else if (!isShowing) {
      hasStartedRef.current = false;
    }
  }, [isShowing, countdownSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!isShowing) return;
    
    if (count <= 0) {
      hide();
      return;
    }

    const timer = setTimeout(() => {
      setCount(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isShowing, count, hide]);

  return (
    <div 
      className="fixed inset-0 bg-black z-50"
      style={{ 
        visibility: isShowing ? 'visible' : 'hidden',
        opacity: isShowing ? 1 : 0,
        pointerEvents: isShowing ? 'auto' : 'none',
        transition: 'opacity 0.3s ease-out'
      }}
    >
      <LaserFlow 
        className="absolute inset-0"
        style={{ zIndex: 5 }}
        horizontalBeamOffset={0.0}
        verticalBeamOffset={0.16}
        verticalSizing={2.5}
        horizontalSizing={0.75}
        color="#FF79C6"
        dpr={1}
        isPaused={!isShowing}
      />
      
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 flex items-center justify-center w-1/2 h-[32vh]"
        style={{
          backgroundColor: 'rgba(6, 0, 16, 1)',
          borderColor: '#FF79C6',
          boxShadow: '0 0 60px rgba(255, 121, 198, 0.3), inset 0 0 60px rgba(255, 121, 198, 0.05)',
          zIndex: 6
        }}
      >
        <div className="flex flex-col items-center gap-6">
          <GlitchText 
            fontSize="4rem" 
            fontWeight={900} 
            color="#fff" 
            enableHover={true} 
            intensity={0.15}
          >
            Latest sales arriving
          </GlitchText>
          
          <GlitchText 
            fontSize="2rem" 
            fontWeight={900} 
            color="#fff" 
            enableHover={true} 
            intensity={0.2}
          >
            Get ready
          </GlitchText>
          
          {isShowing && count > 0 && (
            <GlitchText 
              fontSize="6rem" 
              fontWeight={900} 
              color="#FF79C6" 
              intensity={0.3}
            >
              {count}
            </GlitchText>
          )}
        </div>
      </div>
    </div>
  );
}
