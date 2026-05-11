import { type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';

type HealthResponse = {
  status: 'ok';
  timestamp: string;
};

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`health check failed: ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}

function App(): ReactElement {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  let statusLabel: string;
  if (isPending) {
    statusLabel = 'backend: loading…';
  } else if (error || !data) {
    statusLabel = 'backend: error';
  } else {
    statusLabel = 'backend: ok';
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Disbord — Phase 0</h1>
      <p
        className="rounded-md border border-border bg-card px-4 py-2 font-mono text-sm text-muted-foreground"
        data-testid="health-status"
      >
        {statusLabel}
      </p>
    </main>
  );
}

export default App;
