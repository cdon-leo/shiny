'use client';

import { motion } from 'motion/react';
import { ReactNode } from 'react';
import { MetricType } from '@/lib/data';
import { AnimatedBar } from './AnimatedBar';
import { formatMetric, formatPercentChange, formatAbsoluteChange, calculatePercentChange, BarConfig, ANIMATION_TIMING } from './helpers';

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
  /** Delay for logo animation */
  logoDelay?: number;
  /** Delay for last year bars and labels */
  lastYearDelay?: number;
  /** Delay for this year bar animation */
  thisYearDelay?: number;
  /** Delay for metrics/change indicators */
  metricsDelay?: number;
  /** Whether to show metrics above the bar instead of at top of chart */
  showMetricsAboveBar?: boolean;
  /** Default bar color for last year bars */
  barColor?: string;
  /** Color for this year's bars (uses branch primary color) */
  thisYearColor?: string;
  /** Color for this year's text */
  thisYearTextColor?: string;
  /** Bar width in pixels */
  barWidth?: number;
  /** Metric type for formatting values */
  metric?: MetricType;
}

export function BranchBars({
  branchName,
  logo,
  bars,
  changeIndicators = [],
  logoDelay = 0,
  lastYearDelay = 0,
  thisYearDelay = 0,
  metricsDelay = 0,
  showMetricsAboveBar = false,
  barColor = 'oklch(37.1% 0 0)',
  thisYearColor,
  barWidth = 110,
  thisYearTextColor,
  metric = 'gmv',
}: BranchBarsProps) {
  const { QUICK_APPEAR } = ANIMATION_TIMING;

  // Find the this year bar to get its height for positioning metrics above it
  const thisYearBar = bars.find(b => b.isThisYear);

  return (
    <div className="flex flex-col items-center h-full">
      {/* Branch title/logo */}
      <motion.div
        className="mb-2 flex items-center justify-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: logoDelay }}
      >
        {logo ?? (
          <h2 className="text-2xl font-bold text-foreground">
            {branchName.charAt(0).toUpperCase() + branchName.slice(1)}
          </h2>
        )}
      </motion.div>

      {/* Chart container with fixed structure */}
      <div className="flex flex-col mt-1 h-[75vh]">
        {/* Fixed height indicator row - only show if not showMetricsAboveBar */}
        {!showMetricsAboveBar && (
          <div className="h-20 flex items-end gap-4">
            {bars.map((bar, index) => {
              const indicators = changeIndicators.filter(c => c.afterBarIndex === index);

              return (
                <div key={`ind-${bar.id}`} className="flex flex-col items-center justify-end" style={{ width: barWidth }}>
                  {indicators.length > 0 && (
                    <motion.div
                      className="flex items-center gap-16"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: QUICK_APPEAR, delay: metricsDelay }}
                    >
                      {indicators.map((indicator, i) => {
                        const percentChange = calculatePercentChange(indicator.fromValue, indicator.toValue);
                        const isPositive = percentChange >= 0;

                        return (
                          <div key={i} className="flex flex-col items-center">
                            {indicator.showAbsolute && (
                              <span className="text-xl text-text-secondary whitespace-nowrap">
                                {formatAbsoluteChange(indicator.fromValue, indicator.toValue, metric)}
                              </span>
                            )}
                            <div className={`rounded-full w-22 py-1 flex items-center justify-center ${isPositive ? 'bg-green-600/20' : 'bg-red-700/20'}`}>
                            <span
                              className={`font-bold text-2xl whitespace-nowrap ${
                                isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatPercentChange(percentChange)}
                            </span>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bar area - all bars share the same height reference */}
        <div className="flex-1 flex items-end gap-6 relative">
          {bars.map((bar, index) => {
            const color = bar.isThisYear && thisYearColor ? thisYearColor : barColor;
            const indicators = changeIndicators.filter(c => c.afterBarIndex === index);

            return (
              <div key={bar.id} className="relative h-full flex items-end">
                <AnimatedBar
                  displayValue={formatMetric(bar.value, metric)}
                  heightPercent={bar.heightPercent}
                  delay={bar.isThisYear ? thisYearDelay : lastYearDelay}
                  animationMode={bar.isThisYear ? 'expand' : 'fadeIn'}
                  color={color}
                  textColor={bar.isThisYear && thisYearTextColor ? thisYearTextColor : 'white'}
                  width={barWidth}
                />
                {/* Show metrics above bar if showMetricsAboveBar is enabled */}
                {showMetricsAboveBar && bar.isThisYear && indicators.length > 0 && (
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ bottom: `calc(${bar.heightPercent}% + 16px)` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: QUICK_APPEAR, delay: metricsDelay }}
                  >
                    {indicators.map((indicator, i) => {
                      const percentChange = calculatePercentChange(indicator.fromValue, indicator.toValue);
                      const isPositive = percentChange >= 0;

                      return (
                        <div key={i} className="flex flex-col items-center">
                          {indicator.showAbsolute && (
                            <span className="text-xl font-medium text-text-secondary whitespace-nowrap mb-2">
                              {formatAbsoluteChange(indicator.fromValue, indicator.toValue, metric)}
                            </span>
                          )}
                          <div className={`rounded-full w-22 py-1 flex items-center justify-center ${isPositive ? 'bg-green-600/20' : 'bg-red-700/20'}`}>
                          <span
                            className={`font-bold text-xl whitespace-nowrap ${
                              isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatPercentChange(percentChange)}
                          </span>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
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
              transition={{ duration: QUICK_APPEAR, delay: bar.isThisYear ? thisYearDelay + 0.5 : lastYearDelay }}
            >
              {bar.label}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
