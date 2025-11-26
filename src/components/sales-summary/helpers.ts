import { LatestIntervalBranch } from '@/lib/data';

/**
 * Format a GMV value for display (e.g., 1.2M, 100k, 500)
 */
export function formatGmv(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)} K`;
  }
  return value.toFixed(0);
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
export function formatAbsoluteChange(from: number, to: number): string {
  const diff = to - from;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${formatGmv(Math.abs(diff))}`;
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
        label: '2024\nso far',
        isThisYear: false,
      },
      {
        id: 'thisYearSoFar',
        value: branch.cumulativeThisYear,
        heightPercent: branch.cumulativeThisYear * scaleFactor,
        label: '2025\nso far',
        isThisYear: true,
      },
      {
        id: 'lastYearFullDay',
        value: branch.cumulativeLastYearFullDay,
        heightPercent: branch.cumulativeLastYearFullDay * scaleFactor,
        label: '2024\nwhole day',
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

