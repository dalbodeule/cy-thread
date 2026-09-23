/// <reference path="../../worker-configuration.d.ts" />
import { drizzle } from 'drizzle-orm/d1';
import schema from '~~/server/db/schema';

export default function useDrizzle(database: D1Database) {
  return drizzle(database, { schema });
}
