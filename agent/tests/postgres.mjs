import assert from 'node:assert/strict';
import pg from 'pg';
import { eventually } from './environment.mjs';

const { Client } = pg;

export function database(config) {
  assert.match(config.schema, /^acceptance_[0-9a-f]{20}$/);
  const url = new URL(config.database);
  url.searchParams.delete('schema');

  async function connection(fn) {
    const client = new Client({
      connectionString: url.href,
      connectionTimeoutMillis: 4000,
      statement_timeout: 8000,
      query_timeout: 10000,
      options: '-c search_path=' + config.schema,
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  const query = (sql, args) => connection(async (client) => (await client.query(sql, args)).rows);

  async function inspect(listingId) {
    return connection(async (client) => {
      const { rows: [listing] } = await client.query(
        'SELECT state, moderation FROM listings WHERE id = $1', [listingId]);
      const { rows: reservations } = await client.query(
        'SELECT * FROM reservations WHERE "listingId" = $1 ORDER BY id', [listingId]);
      assert.ok(listing, 'Thiếu tin trong PostgreSQL');
      return { listing, reservations };
    });
  }

  async function queued(table, id, first, second, note = () => {}, ordered = true) {
    assert.ok(['users', 'listings'].includes(table), 'Bảng đặt khóa không hợp lệ');
    return connection(async (gate) => {
      await gate.query('BEGIN');
      const started = [];
      try {
        const { rows: [{ pid }] } = await gate.query('SELECT pg_backend_pid() AS pid');
        const { rowCount } = await gate.query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
        assert.equal(rowCount, 1, 'Thiếu hàng PostgreSQL để đồng bộ');
        const waitForBlocked = async (minimum) => eventually(async () => {
          const [{ waiting }] = await query(`
            WITH RECURSIVE blocked(pid) AS (
              SELECT $1::int
              UNION
              SELECT a.pid FROM pg_stat_activity a
              JOIN blocked b ON b.pid = ANY(pg_blocking_pids(a.pid))
              WHERE a.datname = current_database()
            )
            SELECT count(*)::int - 1 AS waiting FROM blocked
          `, [pid]);
          return waiting >= minimum;
        }, 3500, `Không quan sát được ${minimum} kết nối app chờ khóa ${table} trong PostgreSQL`);
        const start = (action) => {
          const promise = Promise.resolve().then(action);
          void promise.catch(() => {});
          started.push(promise);
        };
        start(first);
        if (ordered) await waitForBlocked(1);
        start(second);
        await waitForBlocked(2);
        note(`PostgreSQL ghi nhận hai kết nối app cùng chờ khóa ${table}${ordered ? ', theo thứ tự gửi đã chọn' : ''}`);
        await gate.query('COMMIT');
        return await Promise.all(started);
      } catch (error) {
        await gate.query('ROLLBACK');
        await Promise.allSettled(started);
        throw error;
      }
    });
  }

  return {
    query, inspect, queued,
    create: () => query(`CREATE SCHEMA "${config.schema}"`),
    drop: () => query(`DROP SCHEMA "${config.schema}" CASCADE`),
  };
}
