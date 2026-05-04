import { SQL } from 'bun'

export interface DbResult<Row = Record<string, unknown>> {
  rows: Row[]
  rowCount: number
}

/**
 * Opaque wrapper produced by `db.array(...)`. Pass it into a tagged template
 * slot to bind a Postgres array value. Bun.sql does NOT auto-convert plain
 * JS arrays into PG arrays — `${jsArray}` would either throw or be sent as
 * a single text value, causing `malformed array literal` errors.
 *
 * Example:
 *   const ids = db.array(pageIds, 'text')
 *   await db`delete from pages where not (id = any(${ids}))`
 */
export type DbArrayParameter = ReturnType<SQL['array']>

/**
 * The shared DB client interface. Used by repositories and handlers.
 * Tagged-template callable returning DbResult, plus:
 *   - `.array(values, typeName)` — bind a JS array as a Postgres array
 *   - `.unsafe(...)` — execute raw SQL strings (e.g. stored migration blocks)
 *   - `.transaction(fn)` — fixes the cross-connection transaction bug from
 *     the old pg-Pool API by holding all queries on one connection
 */
export interface DbClient {
  <Row = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<DbResult<Row>>
  array(values: unknown[], typeName: string): DbArrayParameter
  unsafe<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<DbResult<Row>>
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>
}

export function createDbClient(connectionString: string): DbClient {
  const sql = new SQL(connectionString)
  return wrapSql(sql)
}

function wrapSql(sql: SQL): DbClient {
  const fn = (async <Row>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const rows = await sql<Row[]>(strings, ...values)
    return { rows, rowCount: rows.length }
  }) as DbClient

  fn.array = (values: unknown[], typeName: string): DbArrayParameter => {
    return sql.array(values, typeName)
  }

  fn.unsafe = async <Row = Record<string, unknown>>(rawSql: string, params?: unknown[]): Promise<DbResult<Row>> => {
    const rows = params !== undefined
      ? await sql.unsafe<Row[]>(rawSql, params as unknown[])
      : await sql.unsafe<Row[]>(rawSql)
    return { rows, rowCount: rows.length }
  }

  fn.transaction = async <T>(cb: (tx: DbClient) => Promise<T>): Promise<T> => {
    return await sql.begin(async (txSql) => cb(wrapSql(txSql as unknown as SQL)))
  }
  return fn
}
