'use client';

import { useDashboard } from '@/context/DashboardContext';
import LaserFlow from '@/components/LaserFlow';
import GlitchText from '@/components/GlitchText';

/**
 * Sales incoming page with laser animation and countdown.
 * 
 * This page only mounts when navigated to, so the WebGL LaserFlow
 * component is fully disposed when leaving this page.
 */
export default function IncomingPage() {
  const { incomingCountdown, laserFlowKey } = useDashboard();

  return (
    <div 
      className="bg-black"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
      }}
    >
      <LaserFlow
        key={laserFlowKey}
        className="absolute inset-0"
        style={{ 
          zIndex: 5,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        horizontalBeamOffset={0.0}
        verticalBeamOffset={0.16}
        verticalSizing={2.5}
        horizontalSizing={0.75}
        color="#FF79C6"
        dpr={1}
        isPaused={false}
        skipInViewCheck={true}
      />
      
      <div 
        className="rounded-2xl border-2 flex items-center justify-center w-1/2 h-[32vh]"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
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
          
          {incomingCountdown > 0 && (
            <GlitchText 
              fontSize="6rem" 
              fontWeight={900} 
              color="#FF79C6" 
              intensity={0.3}
            >
              {incomingCountdown}
            </GlitchText>
          )}
        </div>
      </div>
    </div>
  );
}

