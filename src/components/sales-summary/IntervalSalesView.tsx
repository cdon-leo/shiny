'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { TypeAnimation } from 'react-type-animation';
import { LatestIntervalData, MetricType } from '@/lib/data';
import { BranchBars } from './BranchBars';
import { calculateIntervalBarHeights, getIntervalStartTime, calculateBranchDelays, ANIMATION_TIMING } from './helpers';
import branchColors from '@/config/branch-colors.json';

const branchLogos: Record<string, string> = {
  fyndiq: '/fyndiq.svg',
  cdon: '/cdon.svg',
};

interface IntervalSalesViewProps {
  data: LatestIntervalData;
  metric: MetricType;
}

export function IntervalSalesView({ data, metric }: IntervalSalesViewProps) {
  const [typingComplete, setTypingComplete] = useState(false);
  const startTime = getIntervalStartTime(data.time);
  const barHeights = calculateIntervalBarHeights(data.branches);

  // Sort branches: Fyndiq first, then CDON (matching the mockup layout)
  const sortedHeights = [...barHeights].sort((a, b) => {
    if (a.branch === 'fyndiq') return -1;
    if (b.branch === 'fyndiq') return 1;
    return a.branch.localeCompare(b.branch);
  });

  const titleText = metric === 'orders' ? 'Orders during the past 10 minutes' : 'Sales during past 10 minutes';

  return (
    <div className="flex items-center justify-center h-full">
      {/* Title */}
      <motion.div
        className="flex flex-col items-center text-foreground mb-12 w-1/4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-xl mb-3 font-press-start-2p text-center">{titleText}</div>
        <span className="font-press-start-2p text-3xl">
          <TypeAnimation
            sequence={[
              ANIMATION_TIMING.TYPING_START_DELAY * 1000,
              `${startTime}–${data.time}`,
              () => setTypingComplete(true),
            ]}
            speed={{type: "keyStrokeDelayInMs", value: 300}}
            cursor={false}
          />
        </span>
      </motion.div>

      {/* Branch charts side by side */}
      <div className="flex items-center justify-center gap-48 w-1/2">
        {sortedHeights.map((branchData, branchIndex) => {
          // Find the original branch data to get raw values for change indicator
          const originalBranch = data.branches.find(b => b.branch === branchData.branch);

          const branchColor = branchColors.branches[branchData.branch as keyof typeof branchColors.branches]?.barColor;
          const branchTextColor = branchColors.branches[branchData.branch as keyof typeof branchColors.branches]?.barTextColor;
          const logoSrc = branchLogos[branchData.branch];

          // Calculate delays for this branch
          const delays = calculateBranchDelays(branchIndex);

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
                  afterBarIndex: 1, // Show above the "this year" bar
                  fromValue: originalBranch?.gmvLastYear ?? 0,
                  toValue: originalBranch?.gmvThisYear ?? 0,
                  showAbsolute: true, // Now showing absolute change
                },
              ]}
              logoDelay={delays.logoDelay}
              lastYearDelay={delays.lastYearDelay}
              thisYearDelay={delays.thisYearDelay}
              metricsDelay={delays.metricsDelay}
              showMetricsAboveBar={true} // Position metrics above the bar
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

