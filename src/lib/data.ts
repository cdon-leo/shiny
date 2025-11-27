// Type definitions for sales data

export interface RawSalesRow {
  branch: string;
  ts: { value: string };
  year: number;
  num_orders: number;
  gmv_sek: number;
}

export interface BarChartDataPoint {
  [key: string]: string | number;
  time: string;
  thisYear: number;
  lastYear: number;
}

export interface LineChartSeries {
  id: string;
  data: Array<{ x: string; y: number }>;
}

export interface BranchData {
  branch: string;
  barData: BarChartDataPoint[];
  lineData: LineChartSeries[];
}

export interface LatestIntervalBranch {
  branch: string;
  gmvThisYear: number;
  gmvLastYear: number;
  cumulativeThisYear: number;
  cumulativeLastYear: number;
  cumulativeLastYearFullDay: number;
}

export interface LatestIntervalData {
  time: string;
  branches: LatestIntervalBranch[];
}

export interface SalesResponse {
  data: BranchData[];
  latestInterval: LatestIntervalData | null;
  lastUpdated: string;
  mock?: boolean;
  error?: string;
}

/**
 * Fetches transformed sales data from the API
 */
export async function fetchSalesData(): Promise<SalesResponse> {
  const response = await fetch('/api/sales', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sales data');
  }

  return response.json();
}

/**
 * Calculate seconds until 30 seconds after the next 10-minute interval ends.
 * E.g., targets :00:30, :10:30, :20:30, :30:30, :40:30, :50:30
 * This is when we silently preload data from the API.
 */
export function getSecondsUntilPreload(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  // Calculate which 10-minute interval we're in (0-5)
  const minuteInInterval = minutes % 10;
  
  // Target is :00:30, :10:30, etc.
  // If we're before :30 seconds in the :00 minute, target is current interval's :00:30
  // Otherwise, target is next interval's :00:30
  
  let minutesUntilTarget: number;
  let secondsOffset: number;
  
  if (minuteInInterval === 0 && seconds < 30) {
    // We're in the first 30 seconds of :00/:10/:20 etc. - target is in this same minute
    minutesUntilTarget = 0;
    secondsOffset = 30 - seconds;
  } else if (minuteInInterval === 0) {
    // We're past :30 in the :00 minute - target is next interval
    minutesUntilTarget = 10;
    secondsOffset = 30 - seconds;
  } else {
    // We're in minutes 1-9 of the interval - target is next :00:30
    minutesUntilTarget = 10 - minuteInInterval;
    secondsOffset = 30 - seconds;
  }
  
  let totalSeconds = minutesUntilTarget * 60 + secondsOffset;
  
  // Handle negative seconds (if seconds > 30)
  if (totalSeconds < 0) {
    totalSeconds += 600; // Add 10 minutes
  }
  
  return totalSeconds;
}

/**
 * Calculate seconds until 1 minute after the next 10-minute interval ends.
 * E.g., targets :01:00, :11:00, :21:00, :31:00, :41:00, :51:00
 * This is when we show the anticipation countdown.
 */
export function getSecondsUntilDisplay(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  // Calculate minutes until the next :01, :11, :21, etc.
  const minuteInInterval = minutes % 10;
  let minutesUntilNext: number;
  
  if (minuteInInterval === 0) {
    // At :00, :10, :20, etc. - need to wait 1 minute
    minutesUntilNext = 1;
  } else if (minuteInInterval >= 1) {
    // Past :01, need to wait until next interval's :01
    minutesUntilNext = 11 - minuteInInterval;
  } else {
    minutesUntilNext = 1 - minuteInInterval;
  }
  
  const secondsUntilNext = minutesUntilNext * 60 - seconds;
  
  return secondsUntilNext;
}

/**
 * @deprecated Use getSecondsUntilDisplay() instead
 */
export function getSecondsUntilNextInterval(): number {
  return getSecondsUntilDisplay();
}

/**
 * Get the cutoff time - the start of the most recently completed 10-minute interval.
 * E.g., at 18:41, returns a Date for 18:30:00
 */
export function getIntervalCutoffTime(): Date {
  const now = new Date();
  const minutes = now.getMinutes();
  
  // Get the start of the current interval
  const currentIntervalStart = Math.floor(minutes / 10) * 10;
  
  // The cutoff is the start of the PREVIOUS interval
  const cutoff = new Date(now);
  cutoff.setSeconds(0, 0);
  
  if (currentIntervalStart >= 10) {
    cutoff.setMinutes(currentIntervalStart - 10);
  } else {
    // Need to go to the previous hour
    cutoff.setHours(cutoff.getHours() - 1);
    cutoff.setMinutes(50);
  }
  
  return cutoff;
}
