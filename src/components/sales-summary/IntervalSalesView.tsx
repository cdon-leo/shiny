'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { LatestIntervalData } from '@/lib/data';
import { BranchBars } from './BranchBars';
import { calculateIntervalBarHeights, getIntervalStartTime } from './helpers';
import branchColors from '@/config/branch-colors.json';

const branchLogos: Record<string, string> = {
  fyndiq: '/fyndiq.svg',
  cdon: '/cdon.svg',
};

interface IntervalSalesViewProps {
  data: LatestIntervalData;
}

export function IntervalSalesView({ data }: IntervalSalesViewProps) {
  const startTime = getIntervalStartTime(data.time);
  const barHeights = calculateIntervalBarHeights(data.branches);

  // Sort branches: Fyndiq first, then CDON (matching the mockup layout)
  const sortedHeights = [...barHeights].sort((a, b) => {
    if (a.branch === 'fyndiq') return -1;
    if (b.branch === 'fyndiq') return 1;
    return a.branch.localeCompare(b.branch);
  });

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Title */}
      <motion.h1
        className="text-3xl font-bold text-foreground mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Sales {startTime}–{data.time}
      </motion.h1>

      {/* Branch charts side by side */}
      <div className="flex gap-72">
        {sortedHeights.map((branchData, branchIndex) => {
          // Find the original branch data to get raw values for change indicator
          const originalBranch = data.branches.find(b => b.branch === branchData.branch);

          const branchColor = branchColors.branches[branchData.branch as keyof typeof branchColors.branches]?.primary;

          const logoSrc = branchLogos[branchData.branch];

          return (
            <BranchBars
              key={branchData.branch}
              branchName={branchData.branch}
              logo={logoSrc && (
                <Image
                  src={logoSrc}
                  alt={branchData.branch}
                  width={branchData.branch === 'fyndiq' ? 100 : 48}
                  height={48}
                />
              )}
              bars={branchData.bars}
              changeIndicators={[
                {
                  afterBarIndex: 1, // Show above the "this year" bar
                  fromValue: originalBranch?.gmvLastYear ?? 0,
                  toValue: originalBranch?.gmvThisYear ?? 0,
                  showAbsolute: false,
                },
              ]}
              baseDelay={branchIndex * 3.5}
              thisYearColor={branchColor}
            />
          );
        })}
      </div>
    </div>
  );
}

