'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { TypeAnimation } from 'react-type-animation';
import { LatestIntervalData, MetricType } from '@/lib/data';
import { BranchBars } from './BranchBars';
import { calculateCumulativeBarHeights, calculateBranchDelays, ANIMATION_TIMING } from './helpers';
import branchColors from '@/config/branch-colors.json';

const branchLogos: Record<string, string> = {
  fyndiq: '/fyndiq.svg',
  cdon: '/cdon.svg',
};

interface CumulativeProgressViewProps {
  data: LatestIntervalData;
  metric: MetricType;
}

export function CumulativeProgressView({ data, metric }: CumulativeProgressViewProps) {
  const [typingComplete, setTypingComplete] = useState(false);
  const barHeights = calculateCumulativeBarHeights(data.branches);

  // Sort branches: Fyndiq first, then CDON (matching the mockup layout)
  const sortedHeights = [...barHeights].sort((a, b) => {
    if (a.branch === 'fyndiq') return -1;
    if (b.branch === 'fyndiq') return 1;
    return a.branch.localeCompare(b.branch);
  });

  return (
    <div className="flex items-center justify-center h-full">
      {/* Title */}
      <motion.div
        className="flex flex-col items-center text-foreground mb-12 w-1/4 px-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-2xl mb-6 font-press-start-2p text-center">Total orders compared to last year</div>
        <div className="text-2xl mb-3 font-press-start-2p text-center">Time:</div>
        <span className="font-press-start-2p text-5xl">
          <TypeAnimation
            sequence={[
              ANIMATION_TIMING.TYPING_START_DELAY * 1000,
              data.time,
              () => setTypingComplete(true),
            ]}
            speed={{type: "keyStrokeDelayInMs", value: 400}}
            cursor={false}
          />
        </span>
      </motion.div>

      {/* Branch charts side by side */}
      <div className="flex items-center justify-center gap-24 w-1/2">
        {sortedHeights.map((branchData, branchIndex) => {
          // Find the original branch data to get raw values for change indicators
          const originalBranch = data.branches.find(b => b.branch === branchData.branch);

          const branchColor = branchColors.branches[branchData.branch as keyof typeof branchColors.branches]?.barColor;
          const branchTextColor = branchColors.branches[branchData.branch as keyof typeof branchColors.branches]?.barTextColor;
          const logoSrc = branchLogos[branchData.branch];

          // Calculate delays for this branch
          const delays = calculateBranchDelays(branchIndex);

          // Bar order: 0=2024 so far, 1=2025 so far (animated), 2=2024 whole day
          // Show comparisons: 2025 vs 2024 so far, and 2025 vs 2024 whole day
          return (
            <BranchBars
              key={branchData.branch}
              branchName={branchData.branch}
              logo={logoSrc && (
                <Image
                  src={logoSrc}
                  alt={branchData.branch}
                  width={branchData.branch === 'fyndiq' ? 200 : 96}
                  height={96}
                />
              )}
              bars={branchData.bars}
              changeIndicators={[
                {
                  // Show 2025 so far vs 2024 so far (above the 2025 bar)
                  afterBarIndex: 1,
                  fromValue: originalBranch?.cumulativeLastYear ?? 0,
                  toValue: originalBranch?.cumulativeThisYear ?? 0,
                  showAbsolute: true,
                },
                {
                  // Show 2025 so far vs 2024 whole day (above the 2025 bar)
                  afterBarIndex: 1,
                  fromValue: originalBranch?.cumulativeLastYearFullDay ?? 0,
                  toValue: originalBranch?.cumulativeThisYear ?? 0,
                  showAbsolute: true,
                },
              ]}
              logoDelay={delays.logoDelay}
              lastYearDelay={delays.lastYearDelay}
              thisYearDelay={delays.thisYearDelay}
              metricsDelay={delays.metricsDelay}
              thisYearColor={branchColor}
              thisYearTextColor={branchTextColor}
              metric={metric}
            />
          );
        })}
      </div>
      <div className="w-1/4"></div>
    </div>
  );
}

