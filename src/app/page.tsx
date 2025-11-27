'use client';

import { Dashboard } from '@/components/Dashboard';
import { AnticipationProvider } from '@/components/AnticipationContext';
import SalesIncoming from '@/components/SalesIncoming';

export default function Home() {
  return (
    <AnticipationProvider>
      <main className="h-screen px-6 py-4 flex flex-col overflow-hidden">
        <Dashboard />
      </main>
      {/* SalesIncoming rendered outside Dashboard's tree for stable LaserFlow */}
      <SalesIncoming />
    </AnticipationProvider>
  );
}
