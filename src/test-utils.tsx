/**
 * Shared test rendering.
 *
 * Screens sit inside the safe-area and data providers in the real app, so tests mount
 * them the same way — otherwise `useSafeAreaInsets` throws and every screen test needs its
 * own scaffolding. Metrics are fixed rather than measured so layout assertions do not
 * depend on which simulator happens to be running.
 */
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { MaidanApi } from '@/data/api';
import { createMockApi } from '@/data/mock-api';
import { DataProvider, createQueryClient } from '@/data/provider';

/** iPhone-shaped insets: a notch at the top, a home indicator at the bottom. */
export const TEST_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

export interface RenderOptions {
  api?: MaidanApi;
}

export function Providers({ children, api }: { children: ReactNode; api?: MaidanApi }) {
  return (
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      {/* A fresh query client per render keeps one test's cache out of the next. */}
      <DataProvider api={api ?? createMockApi()} queryClient={createQueryClient()}>
        {children}
      </DataProvider>
    </SafeAreaProvider>
  );
}

export function renderScreen(ui: ReactElement, { api }: RenderOptions = {}) {
  return render(<Providers api={api}>{ui}</Providers>);
}
