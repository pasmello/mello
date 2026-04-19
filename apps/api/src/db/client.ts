import postgres from 'postgres';
import { env } from '../env.ts';

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: postgres.camel,
});

export type Sql = typeof sql;
