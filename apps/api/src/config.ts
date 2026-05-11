import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const NODE_ENVS = ['development', 'production', 'test'] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

// @fastify/env validates with Ajv (JSON Schema). Until we adopt a generator
// like zod-to-json-schema, this mirror is hand-maintained — keep it in sync
// with envSchema above. Both produce the same defaults.
export const envJsonSchema = {
  type: 'object',
  required: [],
  properties: {
    NODE_ENV: {
      type: 'string',
      enum: [...NODE_ENVS],
      default: 'development',
    },
    PORT: { type: 'number', default: 3001 },
    HOST: { type: 'string', default: '0.0.0.0' },
    LOG_LEVEL: {
      type: 'string',
      enum: [...LOG_LEVELS],
      default: 'info',
    },
    CORS_ORIGIN: { type: 'string', default: 'http://localhost:5173' },
  },
} as const;
