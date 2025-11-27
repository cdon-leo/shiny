'use client';

import { ResponsiveBar } from '@nivo/bar';
import { getChartColors, BranchName } from '@/lib/colors';

export interface BarChartDataPoint {
  [key: string]: string | number;
  time: string;
  thisYear: number;
  lastYear: number;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  title: string;
  branch: BranchName;
  thisYearLabel?: string;
  lastYearLabel?: string;
}

const currentYear = new Date().getFullYear();

export function BarChart({ 
  data, 
  title, 
  branch,
  thisYearLabel = `${currentYear}`,
  lastYearLabel = `${currentYear - 1}`,
}: BarChartProps) {
  const [primaryColor, secondaryColor] = getChartColors(branch);
  
  // Filter to show only every 3rd tick (half-hour intervals: :00 and :30)
  const tickValues = data
    .map(d => d.time)
    .filter((_, index) => index % 3 === 0);

  return (
    <div className="flex flex-col gap-1 flex-1 min-h-0">
      <h3 className="text-[1.5rem] font-medium text-text-secondary uppercase tracking-wide m-0">
        {title}
      </h3>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveBar
          data={data}
          keys={['thisYear', 'lastYear']}
          indexBy="time"
          groupMode="grouped"
          margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
          padding={0.1}
          innerPadding={0}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={[primaryColor, secondaryColor]}
          borderWidth={0}
          borderRadius={2}
          enableLabel={false}
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
            legendPosition: 'middle',
            legendOffset: -50,
          }}
          legends={[
            {
              dataFrom: 'keys',
              anchor: 'top-right',
              direction: 'row',
              translateX: 0,
              translateY: -20,
              itemWidth: 70,
              itemHeight: 20,
              itemDirection: 'left-to-right',
              symbolSize: 12,
              symbolShape: 'square',
              data: [
                { id: 'thisYear', label: thisYearLabel, color: primaryColor },
                { id: 'lastYear', label: lastYearLabel, color: secondaryColor },
              ],
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
          }}
          role="img"
          ariaLabel={title}
        />
      </div>
    </div>
  );
}
