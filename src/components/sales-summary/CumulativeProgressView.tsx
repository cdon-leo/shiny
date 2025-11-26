'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { LatestIntervalData } from '@/lib/data';
import { BranchBars } from './BranchBars';
import { calculateCumulativeBarHeights } from './helpers';
import branchColors from '@/config/branch-colors.json';

const branchLogos: Record<string, string> = {
  fyndiq: '/fyndiq.svg',
  cdon: '/cdon.svg',
};

interface CumulativeProgressViewProps {
  data: LatestIntervalData;
}

export function CumulativeProgressView({ data }: CumulativeProgressViewProps) {
  const barHeights = calculateCumulativeBarHeights(data.branches);

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
        className="text-2xl text-foreground mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Progress at {data.time}
      </motion.h1>

      {/* Branch charts side by side */}
      <div className="flex gap-24">
        {sortedHeights.map((branchData, branchIndex) => {
          // Find the original branch data to get raw values for change indicators
          const originalBranch = data.branches.find(b => b.branch === branchData.branch);

          const branchColor = branchColors.branches[branchData.branch as keyof typeof branchColors.branches]?.primary;
          
          const logoSrc = branchLogos[branchData.branch];

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
                  width={branchData.branch === 'fyndiq' ? 100 : 48}
                  height={48}
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
              baseDelay={branchIndex * 3.5}
              thisYearColor={branchColor}
            />
          );
        })}
      </div>
    </div>
  );
}

