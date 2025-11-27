import LaserFlow from './LaserFlow';
import FuzzyText from './FuzzyText';

export default function SalesIncoming() {
  return (
    <div className="fixed inset-0 bg-black z-50">
      <LaserFlow 
        className="absolute inset-0"
        style={{ zIndex: 5 }}
        horizontalBeamOffset={0.0}
        verticalBeamOffset={0.12}
        verticalSizing={2.5}
        horizontalSizing={0.75}
        color="#FF79C6"
        dpr={1}
      />
      
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 flex items-center justify-center w-1/2 h-[24vh]"
        style={{
          backgroundColor: 'rgba(6, 0, 16, 1)',
          borderColor: '#FF79C6',
          boxShadow: '0 0 60px rgba(255, 121, 198, 0.3), inset 0 0 60px rgba(255, 121, 198, 0.05)',
          zIndex: 6
        }}
      >
        <div className="flex flex-col items-center gap-6">
          <FuzzyText fontSize="4rem" fontWeight={900} fontFamily="inherit" color="#fff" enableHover={true} baseIntensity={0.15}>Latest sales arriving</FuzzyText>
          <FuzzyText fontSize="2rem" fontWeight={900} fontFamily="inherit" color="#fff" enableHover={true} baseIntensity={0.2}>Get ready</FuzzyText>
        </div>
      </div>
    </div>
  );
}   