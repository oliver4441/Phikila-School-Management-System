import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

export type Sql = NeonQueryFunction<false, false>

export function createSql(env: { DATABASE_URL: string }): Sql {
  return neon(env.DATABASE_URL)
}
