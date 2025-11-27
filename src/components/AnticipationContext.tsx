'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

type AnticipationState = 'idle' | 'showing';

interface AnticipationContextType {
  state: AnticipationState;
  countdownSeconds: number;
  show: () => void;
  hide: () => void;
  onHideRef: React.MutableRefObject<(() => void) | null>;
}

const AnticipationContext = createContext<AnticipationContextType | null>(null);

const COUNTDOWN_SECONDS = 10;

/**
 * Simplified anticipation state management.
 * Uses state machine pattern instead of callback-in-state anti-pattern.
 * 
 * Dashboard calls show() and sets onHideRef.current before showing.
 * SalesIncoming calls hide() when countdown completes.
 */
export function AnticipationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnticipationState>('idle');
  const onHideRef = useRef<(() => void) | null>(null);

  const show = useCallback(() => {
    setState('showing');
  }, []);

  const hide = useCallback(() => {
    setState('idle');
    // Execute the registered callback (set by Dashboard before show())
    if (onHideRef.current) {
      onHideRef.current();
      onHideRef.current = null;
    }
  }, []);

  return (
    <AnticipationContext.Provider value={{ 
      state, 
      countdownSeconds: COUNTDOWN_SECONDS, 
      show, 
      hide,
      onHideRef 
    }}>
      {children}
    </AnticipationContext.Provider>
  );
}

export function useAnticipation() {
  const context = useContext(AnticipationContext);
  if (!context) {
    throw new Error('useAnticipation must be used within AnticipationProvider');
  }
  return context;
}
