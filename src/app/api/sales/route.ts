import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as pl from 'nodejs-polars';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Get the cutoff time - the start of the most recently completed 10-minute interval.
 * E.g., at 18:41, returns a Date for 18:30:00
 */
function getIntervalCutoffTime(): Date {
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

    // Create bar chart data (GMV by time bucket)
    const barData = allTimestamps.map(ts => {
      const tsDate = new Date(ts);
      
      // Get this year's GMV (only if before cutoff time - the previous complete interval)
      let thisYearGmv = 0;
      if (tsDate <= cutoffTime) {
        const thisYearRow = filtered.filter(
          pl.col('ts').eq(pl.lit(ts)).and(pl.col('year').eq(pl.lit(currentYear)))
        );
        if (thisYearRow.height > 0) {
          thisYearGmv = thisYearRow.getColumn('gmv_sek').get(0) as number;
        }
      }

      // Get last year's GMV (always show)
      let lastYearGmv = 0;
      const lastYearRow = filtered.filter(
        pl.col('ts').eq(pl.lit(ts)).and(pl.col('year').eq(pl.lit(lastYear)))
      );
      if (lastYearRow.height > 0) {
        lastYearGmv = lastYearRow.getColumn('gmv_sek').get(0) as number;
      }

      return {
        time: formatTime(ts),
        thisYear: Math.round(thisYearGmv),
        lastYear: Math.round(lastYearGmv),
      };
    });

    // Create line chart data (cumulative GMV)
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
        lastYearCumulative += lastYearRow.getColumn('gmv_sek').get(0) as number;
      }
      lastYearLine.push({ x: timeLabel, y: Math.round(lastYearCumulative) });

      // This year cumulative (only up to cutoff time - the previous complete interval)
      if (tsDate <= cutoffTime) {
        const thisYearRow = filtered.filter(
          pl.col('ts').eq(pl.lit(ts)).and(pl.col('year').eq(pl.lit(currentYear)))
        );
        if (thisYearRow.height > 0) {
          thisYearCumulative += thisYearRow.getColumn('gmv_sek').get(0) as number;
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

// Generate mock data for testing when BigQuery is not available
function generateMockData() {
  const currentYear = getCurrentYear();
  const lastYear = currentYear - 1;
  // Use cutoff time (previous complete interval) instead of current time
  const cutoffTime = getIntervalCutoffTime();
  const cutoffHour = cutoffTime.getHours();
  const cutoffMinute = cutoffTime.getMinutes();

  const branches = ['cdon', 'fyndiq'];

  return branches.map(branch => {
    const barData = [];
    const thisYearLine: Array<{ x: string; y: number }> = [];
    const lastYearLine: Array<{ x: string; y: number }> = [];

    let thisYearCum = 0;
    let lastYearCum = 0;

    // Different base values for each branch
    const multiplier = branch === 'fyndiq' ? 1.5 : 1;

    // Generate data for each 10-minute interval from 00:00 to 23:50
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 10) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        // Only show data up to the cutoff time (previous complete interval)
        const isPast = h < cutoffHour || (h === cutoffHour && m <= cutoffMinute);
        
        // Random GMV between 50000 and 200000 SEK per interval
        const lastYearGmv = Math.floor((Math.random() * 150000 + 50000) * multiplier);
        const thisYearGmv = isPast ? Math.floor((Math.random() * 180000 + 60000) * multiplier) : 0;

        barData.push({
          time,
          thisYear: thisYearGmv,
          lastYear: lastYearGmv,
        });

        lastYearCum += lastYearGmv;
        lastYearLine.push({ x: time, y: lastYearCum });

        if (isPast) {
          thisYearCum += thisYearGmv;
          thisYearLine.push({ x: time, y: thisYearCum });
        }
      }
    }

    return {
      branch,
      barData,
      lineData: [
        { id: `${currentYear}`, data: thisYearLine },
        { id: `${lastYear}`, data: lastYearLine },
      ],
    };
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const useMock = url.searchParams.get('mock') === 'true' || process.env.USE_MOCK_DATA === 'true';
  
  if (useMock) {
    return NextResponse.json({
      data: generateMockData(),
      lastUpdated: new Date().toISOString(),
    });
  }

  try {
    const rows = await fetchFromBigQuery();
    const data = transformData(rows);

    return NextResponse.json({
      data,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sales API error:', error);
    // Fall back to mock data in development when BigQuery fails
    if (process.env.NODE_ENV === 'development') {
      console.log('Falling back to mock data');
      return NextResponse.json({
        data: generateMockData(),
        lastUpdated: new Date().toISOString(),
        mock: true,
      });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        data: [],
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
