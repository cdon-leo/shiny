'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { fetchSalesData, BranchData, LatestIntervalData, MetricType } from '@/lib/data';

// View display duration in seconds
const VIEW_DISPLAY_SECONDS = 30;
const INCOMING_COUNTDOWN_SECONDS = 10;

// DEV TOGGLE: Set to a route path to force that view, or null for normal behavior
// e.g., '/incoming', '/interval', '/cumulative', or '/'
const DEV_FORCE_VIEW: string | null = null;

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface DashboardContextType {
  // Data
  data: BranchData[];
  latestInterval: LatestIntervalData | null;
  pendingLatestInterval: LatestIntervalData | null;
  metric: MetricType;
  loadState: LoadState;
  error: string | null;
  
  // Manual refresh
  triggerRefresh: () => void;
  
  // Incoming countdown (only relevant on /incoming route)
  incomingCountdown: number;
  
  // Key to force LaserFlow remount on navigation
  laserFlowKey: number;
  
  // View timing
  viewSecondsRemaining: number;
  
  // Next update countdown (seconds until :01:00)
  nextUpdateCountdown: number;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

// Helper: Sort branch data with CDON first
function sortBranchData(data: BranchData[]): BranchData[] {
  return [...data].sort((a, b) => {
    if (a.branch === 'cdon') return -1;
    if (b.branch === 'cdon') return 1;
    return a.branch.localeCompare(b.branch);
  });
}

// Helper: Calculate seconds until next :01:00, :11:00, etc.
function getSecondsUntilNextUpdate(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  const minuteInInterval = minutes % 10;
  let minutesUntilNext: number;
  
  if (minuteInInterval === 0) {
    minutesUntilNext = 1;
  } else if (minuteInInterval >= 1) {
    minutesUntilNext = 11 - minuteInInterval;
  } else {
    minutesUntilNext = 1 - minuteInInterval;
  }
  
  return minutesUntilNext * 60 - seconds;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Data state
  const [data, setData] = useState<BranchData[]>([]);
  const [latestInterval, setLatestInterval] = useState<LatestIntervalData | null>(null);
  const [metric, setMetric] = useState<MetricType>('gmv');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  
  // Pending data state (staged for reveal flow)
  const [pendingData, setPendingData] = useState<BranchData[] | null>(null);
  const [pendingLatestInterval, setPendingLatestInterval] = useState<LatestIntervalData | null>(null);
  
  // Countdown states (updated by local timers in components, but seeded from here)
  const [incomingCountdown, setIncomingCountdown] = useState(INCOMING_COUNTDOWN_SECONDS);
  const [viewSecondsRemaining, setViewSecondsRemaining] = useState(VIEW_DISPLAY_SECONDS);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState(getSecondsUntilNextUpdate);
  
  // Key to force LaserFlow complete remount on each navigation
  const [laserFlowKey, setLaserFlowKey] = useState(0);
  
  // Refs for tracking state without causing re-renders
  const hasPreloadedForInterval = useRef<string | null>(null);
  const isInitialLoad = useRef(true);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load data from API
  // staged: true = store to pending state (for preload before reveal flow)
  // staged: false = store directly to displayed state (for initial load)
  const loadData = useCallback(async (staged: boolean = false) => {
    try {
      setLoadState('loading');
      const response = await fetchSalesData();
      const sortedData = sortBranchData(response.data);
      
      if (staged) {
        // Store to pending state - will be committed after reveal flow
        setPendingData(sortedData);
        setPendingLatestInterval(response.latestInterval);
      } else {
        // Store directly to displayed state
        setData(sortedData);
        setLatestInterval(response.latestInterval);
      }
      
      setMetric(response.metric);
      setError(null);
      setLoadState('loaded');
      isInitialLoad.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoadState('error');
    }
  }, []);
  
  // Commit pending data to displayed state (after reveal flow completes)
  const commitPendingData = useCallback(() => {
    if (pendingData) {
      setData(pendingData);
      setPendingData(null);
    }
    if (pendingLatestInterval) {
      setLatestInterval(pendingLatestInterval);
      setPendingLatestInterval(null);
    }
  }, [pendingData, pendingLatestInterval]);
  
  // Manual refresh - replay the flow from /incoming
  const triggerRefresh = useCallback(() => {
    if (DEV_FORCE_VIEW !== null) return;
    
    setIncomingCountdown(INCOMING_COUNTDOWN_SECONDS);
    setLaserFlowKey(k => k + 1); // Force LaserFlow remount
    router.push('/incoming');
  }, [router]);
  
  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Main scheduler: checks clock every second for preload and display triggers
  useEffect(() => {
    if (DEV_FORCE_VIEW !== null) {
      // In dev mode, just navigate to forced view once
      if (pathname !== DEV_FORCE_VIEW) {
        router.push(DEV_FORCE_VIEW);
      }
      return;
    }
    
    const tick = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const minuteInInterval = minutes % 10;
      
      // Create interval key to track preloads (e.g., "13:20")
      const intervalStart = Math.floor(minutes / 10) * 10;
      const currentIntervalKey = `${now.getHours()}:${intervalStart}`;
      
      // Update next update countdown
      setNextUpdateCountdown(getSecondsUntilNextUpdate());
      
      // Preload trigger: at :00:30 (30 seconds after interval ends)
      // Use staged: true so data goes to pending state until reveal flow completes
      if (minuteInInterval === 0 && seconds === 30 && hasPreloadedForInterval.current !== currentIntervalKey) {
        hasPreloadedForInterval.current = currentIntervalKey;
        loadData(true);
      }
      
      // Display trigger: at :01:00 (1 minute after interval ends)
      // Only trigger if not initial load and currently on charts view
      if (minuteInInterval === 1 && seconds === 0 && !isInitialLoad.current && pathname === '/') {
        setIncomingCountdown(INCOMING_COUNTDOWN_SECONDS);
        setLaserFlowKey(k => k + 1); // Force LaserFlow remount
        router.push('/incoming');
      }
    };
    
    tick(); // Run immediately
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [loadData, pathname, router]);
  
  // Incoming countdown timer (only runs when on /incoming)
  useEffect(() => {
    if (DEV_FORCE_VIEW !== null) return;
    if (pathname !== '/incoming') return;
    
    if (incomingCountdown <= 0) {
      // Countdown finished, go to interval view
      setViewSecondsRemaining(VIEW_DISPLAY_SECONDS);
      router.push('/interval');
      return;
    }
    
    const timer = setTimeout(() => {
      setIncomingCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [pathname, incomingCountdown, router]);
  
  // View timer for /interval and /cumulative
  useEffect(() => {
    if (DEV_FORCE_VIEW !== null) return;
    if (pathname !== '/interval' && pathname !== '/cumulative') return;
    
    if (viewSecondsRemaining <= 0) {
      if (pathname === '/interval') {
        // Go to cumulative view
        setViewSecondsRemaining(VIEW_DISPLAY_SECONDS);
        router.push('/cumulative');
      } else if (pathname === '/cumulative') {
        // Commit pending data before going back to charts
        commitPendingData();
        router.push('/');
      }
      return;
    }
    
    viewTimerRef.current = setTimeout(() => {
      setViewSecondsRemaining(prev => prev - 1);
    }, 1000);
    
    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
    };
  }, [pathname, viewSecondsRemaining, router, commitPendingData]);
  
  // Reset view timer when entering interval/cumulative
  useEffect(() => {
    if (pathname === '/interval' || pathname === '/cumulative') {
      // Only reset if we're transitioning in (not already counting)
      // This is handled by the transition logic above
    }
  }, [pathname]);
  
  const value: DashboardContextType = {
    data,
    latestInterval,
    pendingLatestInterval,
    metric,
    loadState,
    error,
    triggerRefresh,
    incomingCountdown,
    viewSecondsRemaining,
    nextUpdateCountdown,
    laserFlowKey,
  };
  
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}

