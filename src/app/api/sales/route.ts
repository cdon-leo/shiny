import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as pl from 'nodejs-polars';
import * as fs from 'fs';
import * as path from 'path';
import dashboardConfig from '@/config/dashboard.json';

type MetricType = 'gmv' | 'orders';
const metric: MetricType = dashboardConfig.metric as MetricType;

// Cache for BigQuery results keyed by interval
let cache: {
  intervalKey: string;
  data: ReturnType<typeof transformData>;
  latestInterval: LatestIntervalData | null;
  timestamp: Date;
} | null = null;

// Read the SQL query from file
function getSqlQuery(): string {
  const queryPath = path.join(process.cwd(), 'src/queries/live_sales_vs_ly.sql');
  return fs.readFileSync(queryPath, 'utf-8');
}

// Get BigQuery client (same logic as query route)
async function getBigQueryClient(): Promise<BigQuery> {
  const secretName = process.env.SECRET_NAME;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const bigqueryProject = process.env.BIGQUERY_PROJECT;

  if (secretName) {
    if (!projectId) {
      throw new Error(
        'GOOGLE_CLOUD_PROJECT environment variable is required when using SECRET_NAME'
      );
    }

    const secretClient = new SecretManagerServiceClient();
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name });

    const payload = version.payload?.data;
    if (!payload) {
      throw new Error('Secret payload is empty');
    }

    const keyJsonStr =
      typeof payload === 'string'
        ? payload
        : Buffer.from(payload as Uint8Array).toString('utf-8');
    const keyData = JSON.parse(keyJsonStr);
    const dataProjectId = keyData.project_id || bigqueryProject;

    return new BigQuery({
      projectId: dataProjectId,
      credentials: keyData,
    });
  } else {
    const options = bigqueryProject ? { projectId: bigqueryProject } : {};
    return new BigQuery(options);
  }
}

// Fetch raw data from BigQuery
async function fetchFromBigQuery() {
  const query = getSqlQuery();
  const bigquery = await getBigQueryClient();
  
  const [rows] = await bigquery.query({
    query,
    location: 'europe-north1',
  });

  return rows;
}

// Get current year
function getCurrentYear(): number {
  return new Date().getFullYear();
}

// Format time for display (HH:MM)
function formatTime(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Type for latest interval summary
interface LatestIntervalBranch {
  branch: string;
  gmvThisYear: number;
  gmvLastYear: number;
  cumulativeThisYear: number;
  cumulativeLastYear: number;
  cumulativeLastYearFullDay: number;
}

interface LatestIntervalData {
  time: string;
  branches: LatestIntervalBranch[];
}

/**
 * Get the cutoff time - the end of the most recently completed 10-minute interval.
 * E.g., at 18:41, returns a Date for 18:40:00 (representing the 18:30-18:40 interval)
 * This matches the SQL which assigns ts = end of interval.
 */
function getIntervalCutoffTime(): Date {
  const now = new Date();
  const minutes = now.getMinutes();
  
  // Get the start of the current interval, which equals the END of the previous interval
  const currentIntervalStart = Math.floor(minutes / 10) * 10;
  
  const cutoff = new Date(now);
  cutoff.setSeconds(0, 0);
  cutoff.setMinutes(currentIntervalStart);
  
  return cutoff;
}

/**
 * Generate a cache key for the current interval.
 * Format: YYYY-MM-DD_HH_MM (based on cutoff time)
 */
function getIntervalCacheKey(): string {
  const cutoff = getIntervalCutoffTime();
  return `${cutoff.toISOString().split('T')[0]}_${cutoff.getHours()}_${cutoff.getMinutes()}`;
}

// Transform data using Polars
function transformData(rows: Array<{
  branch: string;
  ts: { value: string };
  year: number;
  num_orders: number;
  gmv_sek: number;
}>) {
  if (!rows || rows.length === 0) {
    return [];
  }

  const currentYear = getCurrentYear();
  const lastYear = currentYear - 1;
  // Use cutoff time (previous complete interval) instead of current time
  const cutoffTime = getIntervalCutoffTime();

  // Convert to Polars DataFrame
  const df = pl.DataFrame({
    branch: rows.map(r => r.branch),
    ts: rows.map(r => r.ts.value),
    year: rows.map(r => r.year),
    num_orders: rows.map(r => r.num_orders),
    gmv_sek: rows.map(r => r.gmv_sek),
  });

  // Get unique branches
  const branches = df
    .select('branch')
    .unique()
    .getColumn('branch')
    .toArray() as string[];

  const results = branches.map(branch => {
    // Filter data for this branch
    const filtered = df.filter(pl.col('branch').eq(pl.lit(branch)));

    // Get all unique timestamps (sorted)
    const allTimestamps = filtered
      .select('ts')
      .unique()
      .sort('ts')
      .getColumn('ts')
      .toArray() as string[];

    // Create bar chart data (metric by time bucket)
    const metricColumn = metric === 'orders' ? 'num_orders' : 'gmv_sek';
    const barData = allTimestamps.map(ts => {
      const tsDate = new Date(ts);
      
      // Get this year's value (only if before cutoff time - the previous complete interval)
      let thisYearValue = 0;
      if (tsDate <= cutoffTime) {
        const thisYearRow = filtered.filter(
          pl.col('ts').eq(pl.lit(ts)).and(pl.col('year').eq(pl.lit(currentYear)))
        );
        if (thisYearRow.height > 0) {
          thisYearValue = thisYearRow.getColumn(metricColumn).get(0) as number;
        }
      }

      // Get last year's value (always show)
      let lastYearValue = 0;
      const lastYearRow = filtered.filter(
        pl.col('ts').eq(pl.lit(ts)).and(pl.col('year').eq(pl.lit(lastYear)))
      );
      if (lastYearRow.height > 0) {
        lastYearValue = lastYearRow.getColumn(metricColumn).get(0) as number;
      }

      return {
        time: formatTime(ts),
        thisYear: Math.round(thisYearValue),
        lastYear: Math.round(lastYearValue),
      };
    });

    // Create line chart data (cumulative metric)
    const thisYearLine: Array<{ x: string; y: number }> = [];
    const lastYearLine: Array<{ x: string; y: number }> = [];
    
    let thisYearCumulative = 0;
    let lastYearCumulative = 0;

    allTimestamps.forEach(ts => {
      const tsDate = new Date(ts);
      const timeLabel = formatTime(ts);

      // Last year cumulative (always show full day)
      const lastYearRow = filtered.filter(
        pl.col('ts').eq(pl.lit(ts)).and(pl.col('year').eq(pl.lit(lastYear)))
      );
      if (lastYearRow.height > 0) {
        lastYearCumulative += lastYearRow.getColumn(metricColumn).get(0) as number;
      }
      lastYearLine.push({ x: timeLabel, y: Math.round(lastYearCumulative) });

      // This year cumulative (only up to cutoff time - the previous complete interval)
      if (tsDate <= cutoffTime) {
        const thisYearRow = filtered.filter(
          pl.col('ts').eq(pl.lit(ts)).and(pl.col('year').eq(pl.lit(currentYear)))
        );
        if (thisYearRow.height > 0) {
          thisYearCumulative += thisYearRow.getColumn(metricColumn).get(0) as number;
        }
        thisYearLine.push({ x: timeLabel, y: Math.round(thisYearCumulative) });
      }
    });

    return {
      branch,
      barData,
      lineData: [
        { id: `${currentYear}`, data: thisYearLine },
        { id: `${lastYear}`, data: lastYearLine },
      ],
    };
  });

  return results;
}

// Extract latest interval summary from raw data
function extractLatestIntervalSummary(rows: Array<{
  branch: string;
  ts: { value: string };
  year: number;
  num_orders: number;
  gmv_sek: number;
}>): LatestIntervalData | null {
  if (!rows || rows.length === 0) {
    return null;
  }

  const currentYear = getCurrentYear();
  const lastYear = currentYear - 1;
  const cutoffTime = getIntervalCutoffTime();
  const cutoffTimeStr = cutoffTime.toISOString();
  const metricColumn = metric === 'orders' ? 'num_orders' : 'gmv_sek';

  // Convert to Polars DataFrame
  const df = pl.DataFrame({
    branch: rows.map(r => r.branch),
    ts: rows.map(r => r.ts.value),
    year: rows.map(r => r.year),
    metric_value: rows.map(r => metric === 'orders' ? r.num_orders : r.gmv_sek),
  });

  // Find the latest timestamp that matches our cutoff time
  // The cutoff time is the start of the previous complete interval
  const allTimestamps = df
    .select('ts')
    .unique()
    .sort('ts')
    .getColumn('ts')
    .toArray() as string[];

  // Find the timestamp that matches our cutoff
  const latestTs = allTimestamps.find(ts => {
    const tsDate = new Date(ts);
    return tsDate.getHours() === cutoffTime.getHours() && 
           tsDate.getMinutes() === cutoffTime.getMinutes();
  });

  if (!latestTs) {
    return null;
  }

  // Get unique branches
  const branches = df
    .select('branch')
    .unique()
    .getColumn('branch')
    .toArray() as string[];

  const branchSummaries: LatestIntervalBranch[] = branches.map(branch => {
    // Get this year's value for the latest interval
    const thisYearRow = df.filter(
      pl.col('branch').eq(pl.lit(branch))
        .and(pl.col('ts').eq(pl.lit(latestTs)))
        .and(pl.col('year').eq(pl.lit(currentYear)))
    );
    const gmvThisYear = thisYearRow.height > 0 
      ? Math.round(thisYearRow.getColumn('metric_value').get(0) as number)
      : 0;

    // Get last year's value for the latest interval
    const lastYearRow = df.filter(
      pl.col('branch').eq(pl.lit(branch))
        .and(pl.col('ts').eq(pl.lit(latestTs)))
        .and(pl.col('year').eq(pl.lit(lastYear)))
    );
    const gmvLastYear = lastYearRow.height > 0 
      ? Math.round(lastYearRow.getColumn('metric_value').get(0) as number)
      : 0;

    // Calculate cumulative this year (sum of all intervals up to and including latestTs)
    const cumulativeThisYearDf = df.filter(
      pl.col('branch').eq(pl.lit(branch))
        .and(pl.col('year').eq(pl.lit(currentYear)))
        .and(pl.col('ts').ltEq(pl.lit(latestTs)))
    );
    const cumulativeThisYear = cumulativeThisYearDf.height > 0
      ? Math.round(cumulativeThisYearDf.getColumn('metric_value').sum() as number)
      : 0;

    // Calculate cumulative last year up to this point (same time as latestTs)
    const cumulativeLastYearDf = df.filter(
      pl.col('branch').eq(pl.lit(branch))
        .and(pl.col('year').eq(pl.lit(lastYear)))
        .and(pl.col('ts').ltEq(pl.lit(latestTs)))
    );
    const cumulativeLastYear = cumulativeLastYearDf.height > 0
      ? Math.round(cumulativeLastYearDf.getColumn('metric_value').sum() as number)
      : 0;

    // Calculate cumulative last year full day (all intervals)
    const cumulativeLastYearFullDayDf = df.filter(
      pl.col('branch').eq(pl.lit(branch))
        .and(pl.col('year').eq(pl.lit(lastYear)))
    );
    const cumulativeLastYearFullDay = cumulativeLastYearFullDayDf.height > 0
      ? Math.round(cumulativeLastYearFullDayDf.getColumn('metric_value').sum() as number)
      : 0;

    return { 
      branch, 
      gmvThisYear, 
      gmvLastYear,
      cumulativeThisYear,
      cumulativeLastYear,
      cumulativeLastYearFullDay,
    };
  });

  return {
    time: formatTime(latestTs),
    branches: branchSummaries,
  };
}

// Generate mock data for testing when BigQuery is not available
function generateMockData(): { data: ReturnType<typeof transformData>; latestInterval: LatestIntervalData } {
  const currentYear = getCurrentYear();
  const lastYear = currentYear - 1;
  // Use cutoff time (previous complete interval) instead of current time
  const cutoffTime = getIntervalCutoffTime();
  const cutoffHour = cutoffTime.getHours();
  const cutoffMinute = cutoffTime.getMinutes();

  const branches = ['cdon', 'fyndiq'];
  const latestIntervalBranches: LatestIntervalBranch[] = [];

  // Different ranges based on metric type
  const isOrders = metric === 'orders';
  const baseMin = isOrders ? 50 : 50000;
  const baseRange = isOrders ? 150 : 150000;
  const thisYearMin = isOrders ? 60 : 60000;
  const thisYearRange = isOrders ? 180 : 180000;

  const data = branches.map(branch => {
    const barData = [];
    const thisYearLine: Array<{ x: string; y: number }> = [];
    const lastYearLine: Array<{ x: string; y: number }> = [];

    let thisYearCum = 0;
    let lastYearCum = 0;
    let lastYearFullDayCum = 0;
    let latestIntervalValueThisYear = 0;
    let latestIntervalValueLastYear = 0;
    let cumulativeAtLatestThisYear = 0;
    let cumulativeAtLatestLastYear = 0;

    // Different base values for each branch
    const multiplier = branch === 'fyndiq' ? 1.5 : 1;

    // Generate data for each 10-minute interval from 00:00 to 23:50
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 10) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        // Only show data up to the cutoff time (previous complete interval)
        const isPast = h < cutoffHour || (h === cutoffHour && m <= cutoffMinute);
        
        // Random value based on metric type
        const lastYearValue = Math.floor((Math.random() * baseRange + baseMin) * multiplier);
        const thisYearValue = isPast ? Math.floor((Math.random() * thisYearRange + thisYearMin) * multiplier) : 0;

        barData.push({
          time,
          thisYear: thisYearValue,
          lastYear: lastYearValue,
        });

        lastYearCum += lastYearValue;
        lastYearFullDayCum += lastYearValue;
        lastYearLine.push({ x: time, y: lastYearCum });

        if (isPast) {
          thisYearCum += thisYearValue;
          thisYearLine.push({ x: time, y: thisYearCum });
        }

        // Capture the latest interval data
        if (h === cutoffHour && m === cutoffMinute) {
          latestIntervalValueThisYear = thisYearValue;
          latestIntervalValueLastYear = lastYearValue;
          cumulativeAtLatestThisYear = thisYearCum;
          cumulativeAtLatestLastYear = lastYearCum;
        }
      }
    }

    latestIntervalBranches.push({
      branch,
      gmvThisYear: latestIntervalValueThisYear,
      gmvLastYear: latestIntervalValueLastYear,
      cumulativeThisYear: cumulativeAtLatestThisYear,
      cumulativeLastYear: cumulativeAtLatestLastYear,
      cumulativeLastYearFullDay: lastYearFullDayCum,
    });

    return {
      branch,
      barData,
      lineData: [
        { id: `${currentYear}`, data: thisYearLine },
        { id: `${lastYear}`, data: lastYearLine },
      ],
    };
  });

  const latestTimeStr = `${cutoffHour.toString().padStart(2, '0')}:${cutoffMinute.toString().padStart(2, '0')}`;

  return {
    data,
    latestInterval: {
      time: latestTimeStr,
      branches: latestIntervalBranches,
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const useMock = url.searchParams.get('mock') === 'true' || process.env.USE_MOCK_DATA === 'true';
  
  if (useMock) {
    const mockResult = generateMockData();
    return NextResponse.json({
      data: mockResult.data,
      latestInterval: mockResult.latestInterval,
      lastUpdated: new Date().toISOString(),
      metric,
    });
  }

  // Check if we have cached data for the current interval
  const currentIntervalKey = getIntervalCacheKey();
  if (cache && cache.intervalKey === currentIntervalKey) {
    console.log(`Returning cached data for interval: ${currentIntervalKey}`);
    return NextResponse.json({
      data: cache.data,
      latestInterval: cache.latestInterval,
      lastUpdated: cache.timestamp.toISOString(),
      metric,
      cached: true,
    });
  }

  try {
    console.log(`Fetching fresh data from BigQuery for interval: ${currentIntervalKey}`);
    const rows = await fetchFromBigQuery();
    const data = transformData(rows);
    const latestInterval = extractLatestIntervalSummary(rows);

    // Store in cache
    cache = {
      intervalKey: currentIntervalKey,
      data,
      latestInterval,
      timestamp: new Date(),
    };

    return NextResponse.json({
      data,
      latestInterval,
      lastUpdated: cache.timestamp.toISOString(),
      metric,
    });
  } catch (error) {
    console.error('Sales API error:', error);
    // Fall back to mock data in development when BigQuery fails
    if (process.env.NODE_ENV === 'development') {
      console.log('Falling back to mock data');
      const mockResult = generateMockData();
      return NextResponse.json({
        data: mockResult.data,
        latestInterval: mockResult.latestInterval,
        lastUpdated: new Date().toISOString(),
        metric,
        mock: true,
      });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        data: [],
        latestInterval: null,
        lastUpdated: new Date().toISOString(),
        metric,
      },
      { status: 500 }
    );
  }
}
