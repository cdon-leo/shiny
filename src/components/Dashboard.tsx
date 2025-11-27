'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchSalesData, BranchData, LatestIntervalData, getSecondsUntilNextInterval } from '@/lib/data';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { IntervalSalesView } from './sales-summary/IntervalSalesView';
import { CumulativeProgressView } from './sales-summary/CumulativeProgressView';
import { BranchName } from '@/lib/colors';
import { RotateCw } from 'lucide-react';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
type DisplayMode = 'interval' | 'cumulative' | 'charts';

// DEV TOGGLE: Set to 'interval', 'cumulative', or 'charts' to force that view
// Set to null for normal time-based behavior

const DEV_FORCE_VIEW: DisplayMode | null = 'cumulative';

const VIEW_DISPLAY_SECONDS = 20;

export function Dashboard() {
  const [data, setData] = useState<BranchData[]>([]);
  const [latestInterval, setLatestInterval] = useState<LatestIntervalData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(getSecondsUntilNextInterval());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('charts');
  const [viewCountdown, setViewCountdown] = useState(0);
  const isInitialLoad = useRef(true);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async (showSummary: boolean = false) => {
    try {
      setLoadState('loading');
      const response = await fetchSalesData();
      // Sort so cdon comes first, then fyndiq
      const sortedData = response.data.sort((a, b) => {
        if (a.branch === 'cdon') return -1;
        if (b.branch === 'cdon') return 1;
        return a.branch.localeCompare(b.branch);
      });
      setData(sortedData);
      setLatestInterval(response.latestInterval);
      setError(null);
      setLoadState('loaded');
      
      // After loading, show interval view first (but not on initial load, unless manually triggered)
      const shouldShowSummary = showSummary || (!isInitialLoad.current && response.latestInterval);
      if (shouldShowSummary && response.latestInterval) {
        setDisplayMode('interval');
        setViewCountdown(VIEW_DISPLAY_SECONDS);
      }
      
      isInitialLoad.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoadState('error');
    }
  }, []);

  const handleManualRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Countdown timer and interval-based refresh
  useEffect(() => {
    const tick = () => {
      const secondsLeft = getSecondsUntilNextInterval();
      setCountdown(secondsLeft);
      
      // When countdown reaches 0, load new data
      if (secondsLeft <= 1) {
        loadData();
      }
    };

    // Run immediately to sync
    tick();
    
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // View display countdown timer - handles transitions between views
  // Skip all transitions when DEV_FORCE_VIEW is set
  useEffect(() => {
    if (DEV_FORCE_VIEW !== null) {
      return; // Dev mode: skip all view transitions
    }
    
    if ((displayMode === 'interval' || displayMode === 'cumulative') && viewCountdown > 0) {
      viewTimerRef.current = setTimeout(() => {
        setViewCountdown(prev => prev - 1);
      }, 1000);
      
      return () => {
        if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
        }
      };
    } else if (displayMode === 'interval' && viewCountdown <= 0) {
      // Switch from interval to cumulative view
      setDisplayMode('cumulative');
      setViewCountdown(VIEW_DISPLAY_SECONDS);
    } else if (displayMode === 'cumulative' && viewCountdown <= 0) {
      // Switch back to charts when cumulative countdown is done
      setDisplayMode('charts');
    }
  }, [displayMode, viewCountdown]);

  // Effective display mode (dev toggle overrides normal behavior)
  const effectiveDisplayMode = DEV_FORCE_VIEW ?? displayMode;

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getViewLabel = () => {
    if (effectiveDisplayMode === 'interval') {
      return 'Progress view in';
    }
    return 'Showing charts in';
  };

  // Loading overlay for refreshes (not initial load)
  if (loadState === 'loading' && !isInitialLoad.current) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-3 border-border border-t-foreground rounded-full animate-spin" />
          <h2 className="text-xl text-foreground tracking-tight">Latest sales arriving</h2>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (loadState === 'loading' && isInitialLoad.current) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-3 border-border border-t-foreground rounded-full animate-spin" />
          <h2 className="text-xl text-foreground tracking-tight">Loading dashboard...</h2>
        </div>
      </div>
    );
  }

  // Error state
  if (loadState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600 text-sm">{error}</p>
        <button 
          onClick={() => loadData()} 
          className="bg-foreground text-background px-4 py-2 text-sm font-medium rounded hover:opacity-85 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  const cdonData = data.find(d => d.branch === 'cdon');
  const fyndiqData = data.find(d => d.branch === 'fyndiq');

  // Show interval sales view (first summary screen)
  if (effectiveDisplayMode === 'interval' && latestInterval) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex justify-between items-center shrink-0">
          <button
            onClick={handleManualRefresh}
            className="text-xs text-text-secondary hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-border/50"
            title="Refresh data"
          >
            <div className="flex items-center gap-2">
              <RotateCw className="w-3 h-3" /> Refresh
            </div>
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">{getViewLabel()}</span>
              <span className="text-sm font-semibold tabular-nums min-w-8">{viewCountdown}s</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Next update in</span>
              <span className="text-sm font-semibold tabular-nums min-w-12">{formatCountdown(countdown)}</span>
            </div>
          </div>
        </header>
        <div className="flex-1">
          <IntervalSalesView data={latestInterval} />
        </div>
      </div>
    );
  }

  // Show cumulative progress view (second summary screen)
  if (effectiveDisplayMode === 'cumulative' && latestInterval) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex justify-between items-center shrink-0">
          <button
            onClick={handleManualRefresh}
            className="text-xs text-text-secondary hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-border/50"
            title="Refresh data"
          >
            <div className="flex items-center gap-2">
              <RotateCw className="w-3 h-3" /> Refresh
            </div>
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">{getViewLabel()}</span>
              <span className="text-sm font-semibold tabular-nums min-w-8">{viewCountdown}s</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Next update in</span>
              <span className="text-sm font-semibold tabular-nums min-w-12">{formatCountdown(countdown)}</span>
            </div>
          </div>
        </header>
        <div className="flex-1">
          <CumulativeProgressView data={latestInterval} />
        </div>
      </div>
    );
  }

  // Show charts dashboard
  return (
    <div className="flex flex-col h-full gap-4">
      <header className="flex justify-between items-center shrink-0">
        <button
          onClick={handleManualRefresh}
          className="text-xs text-text-secondary hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-border/50"
          title="Refresh data"
        >
          <div className="flex items-center gap-2">
            <RotateCw className="w-3 h-3" /> Refresh
          </div>
        </button>
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-text-secondary">Next update in</span>
          <span className="text-sm font-semibold tabular-nums min-w-12">{formatCountdown(countdown)}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 grid-rows-2 gap-4 flex-1 min-h-0">
        {/* CDON Row */}
        {cdonData && (
          <>
            <div className="flex flex-col min-h-0">
              <BarChart data={cdonData.barData} title="GMV (SEK)" branch={cdonData.branch as BranchName} />
            </div>
            <div className="flex flex-col min-h-0">
              <div className="h-5 mb-1" />
              <LineChart data={cdonData.lineData} title="Cumulative GMV (SEK)" branch={cdonData.branch as BranchName} />
            </div>
          </>
        )}
        
        {/* Fyndiq Row */}
        {fyndiqData && (
          <>
            <div className="flex flex-col min-h-0">
              <BarChart data={fyndiqData.barData} title="GMV (SEK)" branch={fyndiqData.branch as BranchName} />
            </div>
            <div className="flex flex-col min-h-0">
              <div className="h-5 mb-1" />
              <LineChart data={fyndiqData.lineData} title="Cumulative GMV (SEK)" branch={fyndiqData.branch as BranchName} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
