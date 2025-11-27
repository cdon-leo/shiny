'use client';

import { RotateCw } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { BarChart } from '@/components/BarChart';
import { LineChart } from '@/components/LineChart';
import ElectricBorder from '@/components/ElectricBorder';
import { BranchName } from '@/lib/colors';

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ChartsPage() {
  const { 
    data, 
    metric, 
    loadState, 
    error,
    triggerRefresh,
    nextUpdateCountdown,
  } = useDashboard();

  // Initial loading state
  if (loadState === 'loading' && data.length === 0) {
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
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-600 text-sm">{error}</p>
        <button 
          onClick={triggerRefresh}
          className="bg-foreground text-background px-4 py-2 text-sm font-medium rounded hover:opacity-85 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  const cdonData = data.find(d => d.branch === 'cdon');
  const fyndiqData = data.find(d => d.branch === 'fyndiq');

  // Dynamic chart labels based on metric
  const barChartTitle = metric === 'orders' ? 'Number of Orders (vs last year)' : 'GMV (SEK)';
  const lineChartTitle = metric === 'orders' ? 'Cumulative Sum of Orders (vs last year)' : 'Cumulative GMV (SEK)';

  return (
    <main className="h-screen px-6 py-4 flex flex-col overflow-hidden">
    <div className="flex flex-col h-full gap-4">
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
        <div className="flex items-center gap-2 justify-end">
          <span className="text-sm text-text-secondary">Next update in</span>
          <span className="text-base font-semibold tabular-nums min-w-12">{formatCountdown(nextUpdateCountdown)}</span>
        </div>
      </header>

      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* CDON Row */}
        {cdonData && (
          <ElectricBorder color="#00983D" speed={0.1} chaos={0.4} thickness={1} className="flex-1 min-h-0 p-4" style={{ borderRadius: '10px' }}>
            <div className="flex gap-4 h-full">
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <BarChart data={cdonData.barData} title={barChartTitle} branch={cdonData.branch as BranchName} />
              </div>
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="h-5 mb-1" />
                <LineChart data={cdonData.lineData} title={lineChartTitle} branch={cdonData.branch as BranchName} />
              </div>
            </div>
          </ElectricBorder>
        )}
        
        {/* Fyndiq Row */}
        {fyndiqData && (
          <ElectricBorder color="#FF5E79" speed={0.1} chaos={0.4} thickness={1} className="flex-1 min-h-0 p-4" style={{ borderRadius: '10px' }}>
            <div className="flex gap-4 h-full">
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <BarChart data={fyndiqData.barData} title={barChartTitle} branch={fyndiqData.branch as BranchName} />
              </div>
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="h-5 mb-1" />
                <LineChart data={fyndiqData.lineData} title={lineChartTitle} branch={fyndiqData.branch as BranchName} />
              </div>
            </div>
          </ElectricBorder>
        )}
      </div>
    </div>
    </main>
  );
}

