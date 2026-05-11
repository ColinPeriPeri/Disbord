import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactElement, type ReactNode } from 'react';
import App from './App';

function renderApp(): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<App />, { wrapper });
}

describe('<App />', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', timestamp: new Date().toISOString() }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the Phase 0 heading without crashing', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /Disbord — Phase 0/i })).toBeInTheDocument();
  });

  it('reports backend: ok when /api/health succeeds', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('health-status')).toHaveTextContent('backend: ok');
    });
  });
});
