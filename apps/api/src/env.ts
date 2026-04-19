import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  CDN_BASE_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  PASMELLO_SAAS_VERIFY_URL: z.url().optional(),
  ADMIN_LOGINS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof schema>;

// Treat blank env vars as unset so that optional URL fields (e.g.
// PASMELLO_SAAS_VERIFY_URL) don't fail url-format validation when left
// empty in .env.
const rawEnv: Record<string, string | undefined> = {};
for (const [k, v] of Object.entries(process.env)) {
  rawEnv[k] = v === '' ? undefined : v;
}

export const env: Env = schema.parse(rawEnv);
