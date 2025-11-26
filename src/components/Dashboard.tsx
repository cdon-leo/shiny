'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchSalesData, BranchData, getSecondsUntilNextInterval } from '@/lib/data';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { BranchName } from '@/lib/colors';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export function Dashboard() {
  const [data, setData] = useState<BranchData[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(getSecondsUntilNextInterval());
  const isInitialLoad = useRef(true);

  const loadData = useCallback(async () => {
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
      setError(null);
      setLoadState('loaded');
      isInitialLoad.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoadState('error');
    }
  }, []);

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

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBranchName = (branch: string) => {
    return branch.toUpperCase();
  };

  // Loading overlay for refreshes (not initial load)
  if (loadState === 'loading' && !isInitialLoad.current) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-3 border-border border-t-foreground rounded-full animate-spin" />
          <h2 className="text-xl font-medium text-foreground tracking-tight">Latest sales arriving</h2>
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
          <h2 className="text-xl font-medium text-foreground tracking-tight">Loading dashboard...</h2>
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
          onClick={loadData} 
          className="bg-foreground text-background px-4 py-2 text-sm font-medium rounded hover:opacity-85 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  const cdonData = data.find(d => d.branch === 'cdon');
  const fyndiqData = data.find(d => d.branch === 'fyndiq');

  return (
    <div className="flex flex-col h-full gap-4">
      <header className="flex justify-end items-center shrink-0">
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
