import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const healthRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Liveness probe — confirms the API is up and responding.',
        tags: ['system'],
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async (): Promise<HealthResponse> => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  );
};
