import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.email().meta({ example: 'admin@example.com' }),
    password: z.string().min(1).max(200).meta({ example: 'admin1234' }),
  })
  .meta({ id: 'LoginRequest' });

export type LoginInput = z.infer<typeof loginSchema>;

export const userSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    role: z.enum(['admin', 'viewer']),
  })
  .meta({ id: 'User' });

export const loginResponseSchema = z
  .object({
    data: z.object({
      token: z.string().meta({ description: 'JWT, send as `Authorization: Bearer <token>`' }),
      expiresIn: z.string().meta({ example: '1h' }),
      user: userSchema,
    }),
  })
  .meta({ id: 'LoginResponse' });

export const userEnvelopeSchema = z.object({ data: userSchema }).meta({ id: 'UserEnvelope' });
