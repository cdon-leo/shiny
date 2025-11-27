import { LatestIntervalBranch, MetricType } from '@/lib/data';

/**
 * Format a metric value for display (e.g., 1.2M, 100k, 500)
 * For GMV: always use K/M formatting
 * For Orders: use plain numbers for small values, K/M for large
 */
export function formatMetric(value: number, metric: MetricType = 'gmv'): string {
  if(metric === 'orders') {
    return value.toFixed(0);
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)} M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)} K`;
  }
  return value.toFixed(0);
}

/**
 * @deprecated Use formatMetric instead
 */
export function formatGmv(value: number): string {
  return formatMetric(value, 'gmv');
}

/**
 * Calculate percent change between two values
 */
export function calculatePercentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

/**
 * Format a percent change with sign (e.g., "+20%", "-10%")
 */
export function formatPercentChange(percent: number): string {
  const rounded = Math.round(percent);
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

/**
 * Format an absolute change with sign (e.g., "+200 K", "-100 K")
 */
export function formatAbsoluteChange(from: number, to: number, metric: MetricType = 'gmv'): string {
  const diff = to - from;
  const sign = diff >= 0 ? '+' : '-';
  return `${sign}${formatMetric(Math.abs(diff), metric)}`;
}

export interface BarConfig {
  id: string;
  value: number;
  heightPercent: number;
  label: string;
  isThisYear?: boolean;
}

export interface BarHeightResult {
  branch: string;
  bars: BarConfig[];
}

/**
 * Calculate bar heights for interval view.
 * The largest of last year's values = 50% of chart height.
 * This gives room for this year's values to be up to 100% higher.
 */
export function calculateIntervalBarHeights(
  branches: LatestIntervalBranch[]
): BarHeightResult[] {
  // Find max of last year values across all branches
  const maxLastYear = Math.max(...branches.map(b => b.gmvLastYear));
  
  // This value represents 50% height
  const referenceHeight = 50;
  const scaleFactor = maxLastYear > 0 ? referenceHeight / maxLastYear : 1;
  
  return branches.map(branch => ({
    branch: branch.branch,
    bars: [
      {
        id: 'lastYear',
        value: branch.gmvLastYear,
        heightPercent: branch.gmvLastYear * scaleFactor,
        label: '2024',
        isThisYear: false,
      },
      {
        id: 'thisYear',
        value: branch.gmvThisYear,
        heightPercent: branch.gmvThisYear * scaleFactor,
        label: '2025',
        isThisYear: true,
      },
    ],
  }));
}

/**
 * Calculate bar heights for cumulative view.
 * The largest of last year's full day values = 80% of chart height.
 */
export function calculateCumulativeBarHeights(
  branches: LatestIntervalBranch[]
): BarHeightResult[] {
  // Find max of last year full day values across all branches
  const maxFullDay = Math.max(...branches.map(b => b.cumulativeLastYearFullDay));
  
  // This value represents 80% height
  const referenceHeight = 80;
  const scaleFactor = maxFullDay > 0 ? referenceHeight / maxFullDay : 1;
  
  // Order: 2024 so far → 2025 so far (animated, middle) → 2024 whole day
  return branches.map(branch => ({
    branch: branch.branch,
    bars: [
      {
        id: 'lastYearSoFar',
        value: branch.cumulativeLastYear,
        heightPercent: branch.cumulativeLastYear * scaleFactor,
        label: 'Right now\nin 2024',
        isThisYear: false,
      },
      {
        id: 'thisYearSoFar',
        value: branch.cumulativeThisYear,
        heightPercent: branch.cumulativeThisYear * scaleFactor,
        label: 'Today\nso far',
        isThisYear: true,
      },
      {
        id: 'lastYearFullDay',
        value: branch.cumulativeLastYearFullDay,
        heightPercent: branch.cumulativeLastYearFullDay * scaleFactor,
        label: 'End of day\nin 2024',
        isThisYear: false,
      },
    ],
  }));
}

/**
 * Parse a time string like "18:20" and return the start of the 10-min interval
 */
export function getIntervalStartTime(endTime: string): string {
  const [hours, minutes] = endTime.split(':').map(Number);
  let startMinutes = minutes - 10;
  let startHours = hours;
  
  if (startMinutes < 0) {
    startMinutes += 60;
    startHours -= 1;
    if (startHours < 0) startHours = 23;
  }
  
  return `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
}

/**
 * Animation timing constants for sequential animation flow
 */
export const ANIMATION_TIMING = {
  // Typing animation
  TYPING_START_DELAY: 0.5,
  TYPING_DURATION: 3.5,
  
  // Bar animation duration
  BAR_EXPAND_DURATION: 4.5,
  BAR_VALUE_DELAY: 4.0, // relative to bar start
  
  // Quick appear animation duration
  QUICK_APPEAR: 0.4,
  
  // Time between end of typing and first branch
  POST_TYPING_GAP: 0.3,
  
  // Time between branches
  BRANCH_GAP: 7.5,
};

export interface BranchAnimationDelays {
  logoDelay: number;
  lastYearDelay: number;
  thisYearDelay: number;
  metricsDelay: number;
}

/**
 * Calculate animation delays for a branch based on its index
 */
export function calculateBranchDelays(branchIndex: number): BranchAnimationDelays {
  const { TYPING_START_DELAY, TYPING_DURATION, POST_TYPING_GAP, BAR_EXPAND_DURATION, BAR_VALUE_DELAY, BRANCH_GAP } = ANIMATION_TIMING;
  
  // Base delay: after typing finishes + gap
  const baseDelay = TYPING_START_DELAY + TYPING_DURATION + POST_TYPING_GAP + (branchIndex * BRANCH_GAP);
  
  return {
    logoDelay: baseDelay,
    lastYearDelay: baseDelay + 0.5,
    thisYearDelay: baseDelay + 1.0,
    metricsDelay: baseDelay + 1.0 + BAR_EXPAND_DURATION - 0.4,
  };
}

