import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function getPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.MYSQL_HOST
    const user = process.env.MYSQL_USER
    const database = process.env.MYSQL_DATABASE
    if (!host || !user || !database) {
      throw new Error('Missing env vars: MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE')
    }
    pool = mysql.createPool({
      host,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user,
      password: process.env.MYSQL_PASSWORD ?? '',
      database,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: '+00:00',
    })
  }
  return pool
}

/** Run a SELECT — returns typed rows */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Vals = any[]

export async function query<T>(sql: string, values?: Vals): Promise<T[]> {
  const [rows] = await getPool().execute(sql, values ?? [])
  return rows as T[]
}

/** Run INSERT / UPDATE / DELETE — returns result header */
export async function execute(sql: string, values?: Vals): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, values ?? [])
  return result as mysql.ResultSetHeader
}
