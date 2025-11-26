// Type definitions for sales data

export interface RawSalesRow {
  branch: string;
  ts: { value: string };
  year: number;
  num_orders: number;
  gmv_sek: number;
}

export interface BarChartDataPoint {
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

export interface SalesResponse {
  data: BranchData[];
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
 * Calculate seconds until 1 minute after the next 10-minute interval.
 * E.g., targets :01, :11, :21, :31, :41, :51
 */
export function getSecondsUntilNextInterval(): number {
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
