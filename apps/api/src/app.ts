import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import fastifyEnv from '@fastify/env';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { envSchema, envJsonSchema, type Env } from './config.js';
import { healthRoute } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  // Validate process.env up-front so the logger can be constructed with a
  // known-good LOG_LEVEL. @fastify/env validates again post-registration
  // and decorates fastify.env for plugin/route access.
  const env = envSchema.parse(process.env);
  const isProduction = env.NODE_ENV === 'production';

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifyEnv, {
    confKey: 'env',
    schema: envJsonSchema,
    dotenv: true,
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: app.env.CORS_ORIGIN,
    credentials: true,
  });
  await app.register(sensible);

  await app.register(healthRoute, { prefix: '/api' });

  return app;
}
