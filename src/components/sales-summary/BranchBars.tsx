'use client';

import { motion } from 'motion/react';
import { ReactNode } from 'react';
import { AnimatedBar } from './AnimatedBar';
import { formatGmv, formatPercentChange, formatAbsoluteChange, calculatePercentChange, BarConfig } from './helpers';

export type { BarConfig };

export interface ChangeIndicator {
  /** Index of the bar this indicator appears above (the "to" bar) */
  afterBarIndex: number;
  /** Value we're comparing from */
  fromValue: number;
  /** Value we're comparing to */
  toValue: number;
  /** Whether to show absolute change */
  showAbsolute?: boolean;
  /** Optional label for context (e.g., "vs so far") */
  label?: string;
}

export interface BranchBarsProps {
  /** Branch name to display as title */
  branchName: string;
  /** Optional logo to display instead of branch name */
  logo?: ReactNode;
  /** Array of bar configurations */
  bars: BarConfig[];
  /** Change indicators to show between bars */
  changeIndicators?: ChangeIndicator[];
  /** Base delay for animation (only for thisYear bars) */
  baseDelay?: number;
  /** Default bar color for last year bars */
  barColor?: string;
  /** Color for this year's bars (uses branch primary color) */
  thisYearColor?: string;
  /** Bar width in pixels */
  barWidth?: number;
}

export function BranchBars({
  branchName,
  logo,
  bars,
  changeIndicators = [],
  baseDelay = 0,
  barColor = '#171717',
  thisYearColor,
  barWidth = 80,
}: BranchBarsProps) {
  // Find the delay for the animated (thisYear) bar
  const thisYearIndex = bars.findIndex(b => b.isThisYear);
  const animatedBarDelay = baseDelay + 0.2;

  return (
    <div className="flex flex-col items-center h-full">
      {/* Branch title/logo */}
      <motion.div
        className="mb-2 flex items-center justify-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: baseDelay }}
      >
        {logo ?? (
          <h2 className="text-2xl font-bold text-foreground">
            {branchName.charAt(0).toUpperCase() + branchName.slice(1)}
          </h2>
        )}
      </motion.div>

      {/* Chart container with fixed structure */}
      <div className="flex flex-col h-[75vh]">
        {/* Fixed height indicator row */}
        <div className="h-20 flex items-end gap-4">
          {bars.map((bar, index) => {
            const indicators = changeIndicators.filter(c => c.afterBarIndex === index);
            const showDelay = bar.isThisYear ? animatedBarDelay + 2.5 : 0;

            return (
              <div key={`ind-${bar.id}`} className="flex flex-col items-center justify-end" style={{ width: barWidth }}>
                {indicators.length > 0 && (
                  <motion.div
                    className="flex items-center gap-16"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: showDelay }}
                  >
                    {indicators.map((indicator, i) => {
                      const percentChange = calculatePercentChange(indicator.fromValue, indicator.toValue);
                      const isPositive = percentChange >= 0;

                      return (
                        <div key={i} className="flex flex-col items-center">
                          {indicator.showAbsolute && (
                            <span className="text-sm text-text-secondary whitespace-nowrap">
                              {formatAbsoluteChange(indicator.fromValue, indicator.toValue)}
                            </span>
                          )}
                          <span
                            className={`font-medium text-lg whitespace-nowrap   ${
                              isPositive ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {formatPercentChange(percentChange)}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bar area - all bars share the same height reference */}
        <div className="flex-1 flex items-end gap-6">
          {bars.map((bar) => {
            const color = bar.isThisYear && thisYearColor ? thisYearColor : barColor;

            return (
              <AnimatedBar
                key={bar.id}
                displayValue={formatGmv(bar.value)}
                heightPercent={bar.heightPercent}
                delay={bar.isThisYear ? animatedBarDelay : 0}
                animate={bar.isThisYear ?? false}
                color={color}
                width={barWidth}
              />
            );
          })}
        </div>

        {/* Labels row */}
        <div className="h-12 flex items-start gap-6 mt-2">
          {bars.map((bar) => (
            <motion.span
              key={`label-${bar.id}`}
              className="text-sm text-text-secondary whitespace-pre-line text-center leading-tight"
              style={{ width: barWidth }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: bar.isThisYear ? animatedBarDelay + 0.5 : 0 }}
            >
              {bar.label}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
