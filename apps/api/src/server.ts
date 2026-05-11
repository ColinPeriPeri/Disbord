import { buildApp } from './app.js';

async function start(): Promise<void> {
  const app = await buildApp();

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, 'shutdown signal received');
    app
      .close()
      .then(() => {
        process.exit(0);
      })
      .catch((err: unknown) => {
        app.log.error({ err }, 'error during shutdown');
        process.exit(1);
      });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  try {
    await app.listen({ port: app.env.PORT, host: app.env.HOST });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void start();
