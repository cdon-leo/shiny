'use client';

import { ResponsiveLine } from '@nivo/line';
import { getBranchColors, getSecondaryColor, BranchName } from '@/lib/colors';

export interface LineChartDataPoint {
  x: string;
  y: number;
}

export interface LineChartSeries {
  id: string;
  data: LineChartDataPoint[];
}

export interface ComparisonStats {
  cumulativeThisYear: number;
  cumulativeLastYear: number;
  cumulativeLastYearFullDay: number;
}

interface LineChartProps {
  data: LineChartSeries[];
  title: string;
  branch: BranchName;
  comparisonStats?: ComparisonStats;
}

const currentYear = new Date().getFullYear();

// Format number with thousand separators
function formatNumber(num: number): string {
  return new Intl.NumberFormat('sv-SE').format(Math.round(num));
}

// Format percentage with sign
function formatPercent(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

export function LineChart({ data, title, branch, comparisonStats }: LineChartProps) {
  const branchColors = getBranchColors(branch);
  const secondaryColor = getSecondaryColor();
  
  // Assign colors based on year
  const getColor = (series: LineChartSeries) => {
    return series.id === `${currentYear}` ? branchColors.primary : secondaryColor;
  };

  // Get all x values from the longest series and filter to every 3rd (half-hour intervals)
  const allXValues = data.reduce((acc, series) => {
    series.data.forEach(d => {
      if (!acc.includes(d.x)) acc.push(d.x);
    });
    return acc;
  }, [] as string[]);
  const tickValues = allXValues.filter((_, index) => index % 3 === 0);

  // Calculate comparison values
  const vsSameTimeDiff = comparisonStats 
    ? comparisonStats.cumulativeThisYear - comparisonStats.cumulativeLastYear 
    : null;
  const vsSameTimePct = comparisonStats && comparisonStats.cumulativeLastYear > 0
    ? ((comparisonStats.cumulativeThisYear - comparisonStats.cumulativeLastYear) / comparisonStats.cumulativeLastYear) * 100
    : null;
  const vsFullDayDiff = comparisonStats
    ? comparisonStats.cumulativeThisYear - comparisonStats.cumulativeLastYearFullDay
    : null;
  const vsFullDayPct = comparisonStats && comparisonStats.cumulativeLastYearFullDay > 0
    ? ((comparisonStats.cumulativeThisYear - comparisonStats.cumulativeLastYearFullDay) / comparisonStats.cumulativeLastYearFullDay) * 100
    : null;

  // Get last year's full day total for the reference line
  const lastYearFullDayTotal = comparisonStats?.cumulativeLastYearFullDay ?? null;

  return (
    <div className="flex flex-col gap-1 flex-1 min-h-0">
      <h3 className="text-[1.5rem] font-medium text-text-secondary uppercase tracking-wide m-0">
        {title}
      </h3>
      <div className="flex-1 min-h-0 w-full relative">
        {/* Comparison stats overlay */}
        {comparisonStats && (
          <div className="absolute top-6 left-25 z-10 flex flex-col gap-3 pointer-events-none">
            {/* vs Same Time Last Year */}
            <div className="bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 border border-border/50">
              <div className="uppercase tracking-wider text-text-secondary mb-1">
                vs Same Time LY
              </div>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: vsSameTimeDiff !== null && vsSameTimeDiff >= 0 ? branchColors.primary : '#ef4444' }}
                >
                  {vsSameTimeDiff !== null ? (vsSameTimeDiff >= 0 ? '+' : '') + formatNumber(vsSameTimeDiff) : '—'}
                </span>
                <span 
                  className="text-lg font-medium tabular-nums"
                  style={{ color: vsSameTimePct !== null && vsSameTimePct >= 0 ? branchColors.primary : '#ef4444' }}
                >
                  {vsSameTimePct !== null ? formatPercent(vsSameTimePct) : ''}
                </span>
              </div>
            </div>
            {/* vs Full Day Last Year */}
            <div className="bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 border border-border/50">
              <div className="uppercase tracking-wider text-text-secondary mb-1">
                vs Full Day LY
              </div>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: vsFullDayDiff !== null && vsFullDayDiff >= 0 ? branchColors.primary : '#ef4444' }}
                >
                  {vsFullDayDiff !== null ? (vsFullDayDiff >= 0 ? '+' : '') + formatNumber(vsFullDayDiff) : '—'}
                </span>
                <span 
                  className="text-lg font-medium tabular-nums"
                  style={{ color: vsFullDayPct !== null && vsFullDayPct >= 0 ? branchColors.primary : '#ef4444' }}
                >
                  {vsFullDayPct !== null ? formatPercent(vsFullDayPct) : ''}
                </span>
              </div>
            </div>
          </div>
        )}
        <ResponsiveLine
          data={data}
          margin={{ top: 20, right: 20, bottom: 50, left: 70 }}
          xScale={{ type: 'point' }}
          yScale={{
            type: 'linear',
            min: 0,
            max: 'auto',
            stacked: false,
          }}
          yFormat=" >,.0f"
          markers={lastYearFullDayTotal ? [
            {
              axis: 'y',
              value: lastYearFullDayTotal,
              lineStyle: { 
                stroke: secondaryColor, 
                strokeWidth: 2, 
                strokeDasharray: '8 6',
                opacity: 0.7,
              },
              legend: 'LY Full Day',
              legendPosition: 'top-right',
              textStyle: {
                fill: secondaryColor,
                fontSize: 10,
                fontWeight: 500,
              },
            },
          ] : []}
          colors={({ id }) => {
            return id === `${currentYear}` ? branchColors.primary : secondaryColor;
          }}
          lineWidth={3}
          pointSize={0}
          enableArea={false}
          enableGridX={false}
          enableGridY={true}
          gridYValues={5}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: -45,
            tickValues,
            legendPosition: 'middle',
            legendOffset: 40,
            truncateTickAt: 0,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: 0,
            format: '>,.0f',
            legendPosition: 'middle',
            legendOffset: -60,
          }}
          legends={[
            {
              anchor: 'top-right',
              direction: 'row',
              translateX: 0,
              translateY: -20,
              itemWidth: 70,
              itemHeight: 20,
              itemDirection: 'left-to-right',
              symbolSize: 12,
              symbolShape: 'circle',
              data: data.map(series => ({
                id: series.id,
                label: series.id,
                color: getColor(series),
              })),
            },
          ]}
          theme={{
            axis: {
              ticks: {
                text: {
                  fontSize: 11,
                  fill: '#6b7280',
                },
              },
            },
            grid: {
              line: {
                stroke: 'rgba(255, 255, 255, 0.05)',
                strokeWidth: 1,
              },
            },
            legends: {
              text: {
                fontSize: 11,
                fill: '#6b7280',
              },
            },
            crosshair: {
              line: {
                stroke: '#6b7280',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              },
            },
          }}
          useMesh={true}
          enableCrosshair={true}
          crosshairType="x"
          role="img"
          ariaLabel={title}
        />
      </div>
    </div>
  );
}
