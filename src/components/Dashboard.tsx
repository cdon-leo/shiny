'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchSalesData, BranchData, LatestIntervalData, SalesResponse, getSecondsUntilDisplay } from '@/lib/data';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { IntervalSalesView } from './sales-summary/IntervalSalesView';
import { CumulativeProgressView } from './sales-summary/CumulativeProgressView';
import { BranchName } from '@/lib/colors';
import { RotateCw } from 'lucide-react';
import ElectricBorder from './ElectricBorder';
import { useAnticipation } from './AnticipationContext';

type LoadState = 'idle' | 'loading' | 'preloading' | 'loaded' | 'error';
type DisplayMode = 'interval' | 'cumulative' | 'charts';

// DEV TOGGLE: Set to 'interval', 'cumulative', or 'charts' to force that view
// Set to null for normal time-based behavior

const DEV_FORCE_VIEW: DisplayMode | null = null;

const VIEW_DISPLAY_SECONDS = 25;

export function Dashboard() {
  const [data, setData] = useState<BranchData[]>([]);
  const [latestInterval, setLatestInterval] = useState<LatestIntervalData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(getSecondsUntilDisplay());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('charts');
  const [viewCountdown, setViewCountdown] = useState(0);
  
  // Preloaded data - fetched silently 30s after interval, shown after anticipation
  const [preloadedData, setPreloadedData] = useState<SalesResponse | null>(null);
  
  // Context for showing anticipation overlay
  const { show: showAnticipation, state: anticipationState, onHideRef } = useAnticipation();
  const isAnticipationShowing = anticipationState === 'showing';
  
  const isInitialLoad = useRef(true);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasPreloadedForInterval = useRef<string | null>(null); // Track which interval we've preloaded
  const displayModeRef = useRef<DisplayMode>(displayMode); // Ref for timer to check without re-creating

  // Sort data helper
  const sortData = (responseData: BranchData[]) => {
    return [...responseData].sort((a, b) => {
      if (a.branch === 'cdon') return -1;
      if (b.branch === 'cdon') return 1;
      return a.branch.localeCompare(b.branch);
    });
  };

  // Initial load - just get data to show charts
  const loadData = useCallback(async () => {
    try {
      setLoadState('loading');
      const response = await fetchSalesData();
      const sortedData = sortData(response.data);
      setData(sortedData);
      setLatestInterval(response.latestInterval);
      setError(null);
      setLoadState('loaded');
      isInitialLoad.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoadState('error');
    }
  }, []);

  // Silent preload - fetches data 30s after interval ends, stores for later display
  const preloadData = useCallback(async () => {
    try {
      setLoadState('preloading');
      const response = await fetchSalesData();
      // Store preloaded data with sorted branch data
      setPreloadedData({
        ...response,
        data: sortData(response.data),
      });
      setLoadState('loaded');
      console.log('Data preloaded for interval:', response.latestInterval?.time);
    } catch (err) {
      console.error('Preload failed:', err);
      // Don't set error state for preload failures - we'll try again at display time
      setLoadState('loaded');
    }
  }, []);

  // Transfer preloaded data to active data and start the view sequence
  const activatePreloadedData = useCallback(() => {
    if (preloadedData) {
      setData(preloadedData.data);
      setLatestInterval(preloadedData.latestInterval);
    }
    // Start the interval view sequence
    displayModeRef.current = 'interval';
    setDisplayMode('interval');
    setViewCountdown(VIEW_DISPLAY_SECONDS);
  }, [preloadedData]);

  // Start anticipation phase - shows SalesIncoming overlay via context
  const startAnticipation = useCallback(() => {
    // Register callback before showing (cleaner than callback-in-state)
    onHideRef.current = activatePreloadedData;
    showAnticipation();
  }, [showAnticipation, activatePreloadedData, onHideRef]);

  // Manual refresh - replay UI flow without refetching
  const handleManualRefresh = useCallback(() => {
    // Use existing data - just replay the anticipation + views flow
    startAnticipation();
  }, [startAnticipation]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dual timer system: preload at :30, display at :01
  // Uses refs for displayMode check to avoid re-creating timer on mode changes
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const minuteInInterval = minutes % 10;
      
      // Create interval key to track preloads (e.g., "13:20")
      const intervalStart = Math.floor(minutes / 10) * 10;
      const currentIntervalKey = `${now.getHours()}:${intervalStart}`;
      
      // Update countdown display
      const secondsUntilDisplay = getSecondsUntilDisplay();
      setCountdown(secondsUntilDisplay);
      
      // Preload trigger: at :00:30 (30 seconds after interval ends)
      // This happens at 13:20:30 for the 13:10-13:20 interval
      if (minuteInInterval === 0 && seconds === 30 && hasPreloadedForInterval.current !== currentIntervalKey) {
        hasPreloadedForInterval.current = currentIntervalKey;
        preloadData();
      }
      
      // Display trigger: at :01:00 (1 minute after interval ends)
      // Only trigger if we're not in initial load, not showing anticipation, and in charts mode
      if (minuteInInterval === 1 && seconds === 0 && !isInitialLoad.current && displayModeRef.current === 'charts') {
        startAnticipation();
      }
    };

    // Run immediately to sync
    tick();
    
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [preloadData, startAnticipation]);

  // View display countdown timer - handles transitions between interval/cumulative/charts
  // Skip all transitions when DEV_FORCE_VIEW is set or anticipation is showing
  useEffect(() => {
    if (DEV_FORCE_VIEW !== null || isAnticipationShowing) {
      return; // Dev mode or anticipation: skip view transitions
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
      displayModeRef.current = 'cumulative';
      setDisplayMode('cumulative');
      setViewCountdown(VIEW_DISPLAY_SECONDS);
    } else if (displayMode === 'cumulative' && viewCountdown <= 0) {
      // Switch back to charts when cumulative countdown is done
      displayModeRef.current = 'charts';
      setDisplayMode('charts');
    }
  }, [displayMode, viewCountdown, isAnticipationShowing]);

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

      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* CDON Row */}
        {cdonData && (
          <ElectricBorder color="#00983D" speed={0.8} chaos={0.4} thickness={1} className="flex-1 min-h-0 p-4" style={{ borderRadius: '10px' }}>
            <div className="flex gap-4 h-full">
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <BarChart data={cdonData.barData} title="GMV (SEK)" branch={cdonData.branch as BranchName} />
              </div>
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="h-5 mb-1" />
                <LineChart data={cdonData.lineData} title="Cumulative GMV (SEK)" branch={cdonData.branch as BranchName} />
              </div>
            </div>
          </ElectricBorder>
        )}
        
        {/* Fyndiq Row */}
        {fyndiqData && (
          <ElectricBorder color="#FF5E79" speed={0.8} chaos={0.4} thickness={1} className="flex-1 min-h-0 p-4" style={{ borderRadius: '10px' }}>
            <div className="flex gap-4 h-full">
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <BarChart data={fyndiqData.barData} title="GMV (SEK)" branch={fyndiqData.branch as BranchName} />
              </div>
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="h-5 mb-1" />
                <LineChart data={fyndiqData.lineData} title="Cumulative GMV (SEK)" branch={fyndiqData.branch as BranchName} />
              </div>
            </div>
          </ElectricBorder>
        )}
      </div>
    </div>
  );
}
