'use client';

import { RotateCw } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { CumulativeProgressView } from '@/components/sales-summary/CumulativeProgressView';

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CumulativePage() {
  const { 
    latestInterval, 
    pendingLatestInterval,
    metric,
    triggerRefresh,
    viewSecondsRemaining,
    nextUpdateCountdown,
  } = useDashboard();

  // Use pending data if available (new data being revealed), otherwise fall back to current
  const displayData = pendingLatestInterval ?? latestInterval;

  // If no interval data, show loading
  if (!displayData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading cumulative data...</div>
      </div>
    );
  }

  return (
    <main className="h-screen px-6 py-4 flex flex-col overflow-hidden">
    <div className="flex flex-col h-full">
      <header className="flex justify-between items-center shrink-0">
        <button
          onClick={triggerRefresh}
          className="text-xs text-text-secondary hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-border/50"
          title="Refresh data"
        >
          <div className="flex items-center gap-2">
            <RotateCw className="w-3 h-3" /> Refresh
          </div>
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Showing charts in</span>
            <span className="text-sm font-semibold tabular-nums min-w-8">{viewSecondsRemaining}s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Next update in</span>
            <span className="text-sm font-semibold tabular-nums min-w-12">{formatCountdown(nextUpdateCountdown)}</span>
          </div>
        </div>
      </header>
      <div className="flex-1">
        <CumulativeProgressView data={displayData} metric={metric} />
      </div>
    </div>
    </main>
  );
}

