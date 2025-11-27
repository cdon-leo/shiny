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

interface LineChartProps {
  data: LineChartSeries[];
  title: string;
  branch: BranchName;
}

const currentYear = new Date().getFullYear();

export function LineChart({ data, title, branch }: LineChartProps) {
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

  return (
    <div className="flex flex-col gap-1 flex-1 min-h-0">
      <h3 className="text-[1.5rem] font-medium text-text-secondary uppercase tracking-wide m-0">
        {title}
      </h3>
      <div className="flex-1 min-h-0 w-full">
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
