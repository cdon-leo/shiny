'use client';

import { DashboardProvider } from '@/context/DashboardContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Don't wrap in main here - let each page handle its own layout
  // This allows the incoming page to render fullscreen without overflow constraints
  return (
    <DashboardProvider>
      {children}
    </DashboardProvider>
  );
}

