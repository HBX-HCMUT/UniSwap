import assert from 'node:assert/strict';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { settings, setup } from './environment.mjs';
import { startGoogleFixture } from './google-fixture.mjs';
import { database } from './postgres.mjs';
import { apiFixture } from './http.mjs';
import { fixtures, restartCase, searchPerformance, standardCases } from './api-cases.mjs';
import { reservationCases } from './reservation-cases.mjs';
import { browserCases } from './browser-cases.mjs';

const requiredBrowser = ['KT01', 'KT02', 'KT03', 'KT04', 'KT05', 'KT06', 'KT06b', 'KT06d', 'KT07',
  'KT08', 'KT09', 'KT10', 'KT12'];

function evidence(app, requiredCases) {
  const results = new Map(requiredCases.map((id) => [id, []]));
  const filename = (id) => join(app.evidence, id + '.log');

  return {
    async prepare() {
      await Promise.all(requiredCases.map((id) => writeFile(filename(id), id + ' · Nghiệm thu UniSwap\n')));
    },
    async test(id, description, execute) {
      assert.ok(results.has(id), 'Mã kiểm thử ngoài đặc tả: ' + id);
      console.log(id + ' ' + description);
      const notes = [];
      const started = new Date().toISOString();
      const time = performance.now();
      let passed = true;
      try {
        await execute((message) => notes.push(message));
        assert.ok(notes.length, 'Ca kiểm thử thiếu nội dung xác nhận');
      } catch (error) {
        passed = false;
        notes.push(error.stack || String(error));
        console.error(id + ' ' + error.message);
      }
      const status = passed ? 'PASS' : 'FAIL';
      results.get(id).push({ status, browser: description.startsWith('Trình duyệt') });
      await appendFile(filename(id), `\n${status} · ${description}\n${started} · ${Math.round(performance.now() - time)} ms\n${notes.join('\n')}\n`);
    },
    async finish() {
      const failed = [];
      for (const [id, rows] of results) {
        const hasApi = rows.some(({ browser }) => !browser);
        const hasBrowser = rows.some(({ browser }) => browser);
        const missing = !hasApi || (requiredBrowser.includes(id) && !hasBrowser);
        const passed = !missing && rows.length > 0 && rows.every(({ status }) => status === 'PASS');
        if (!passed) failed.push(id);
        await appendFile(filename(id), `\nKết quả ${id} · ${passed ? 'PASS' : 'FAIL'}${missing ? ' (thiếu phép thử)' : ''}\n`);
      }
      assert.deepEqual(failed, [], 'Các ca nghiệm thu lỗi hoặc thiếu');
    },
  };
}

async function verifyOperations(operations, app) {
  const openapi = (await readFile('docs/openapi.yaml', 'utf8')).split('\n');
  const coverage = [];
  let path;
  for (const line of openapi) {
    const newPath = line.match(/^  (\/[^:]+):$/);
    if (newPath) path = newPath[1];
    const newMethod = line.match(/^    (get|post|patch|put|delete):$/);
    if (!newMethod) continue;
    assert.ok(path);
    const method = newMethod[1].toUpperCase();
    const pattern = new RegExp('^' + method + ' ' + path.replace(/\{[^}]+\}/g, '[^/]+') + '$');
    coverage.push([method + ' ' + path, [...operations].some((operation) => pattern.test(operation))]);
  }
  assert.ok(coverage.length > 0);
  await writeFile(join(app.evidence, 'openapi.log'),
    coverage.map(([operation, observed]) => `${observed ? 'Đã gọi' : 'Chưa gọi'} · ${operation}`).join('\n') + '\n');
  assert.deepEqual(coverage.filter(([, observed]) => !observed).map(([operation]) => operation), [],
    'Có operation OpenAPI chưa được kiểm bằng HTTP');
}

const seedSnapshot = async (db) => db.query(`SELECT
  (SELECT array_agg(id ORDER BY id) FROM schools) AS schools,
  (SELECT array_agg(id ORDER BY id) FROM categories) AS categories,
  (SELECT array_agg(id ORDER BY id) FROM users) AS users,
  (SELECT count(*)::int FROM listings) AS listings`);

async function run() {
  assert.equal(process.argv.length, 2, 'Dùng bash agent/acceptance.sh');
  const config = settings();
  const google = await startGoogleFixture();
  let app;
  let db;
  let ownsSchema = false;
  let closing;
  const cleanup = () => closing ??= (async () => {
    try {
      await app?.dispose();
    } finally {
      try {
        if (ownsSchema) await db.drop();
      } finally {
        await google.close();
      }
    }
  })();
  const terminate = () => {
    cleanup().then(() => process.exit(130), (error) => {
      console.error('Lỗi khi dừng nghiệm thu:', error.message);
      process.exit(1);
    });
  };
  process.on('SIGINT', terminate);
  process.on('SIGTERM', terminate);
  try {
    app = await setup(config, google.issuer);
    db = database(config);
    const acceptanceDoc = await readFile('docs/nghiem-thu.md', 'utf8');
    const requiredCases = [...acceptanceDoc.matchAll(/^\| (KT\d{2}[a-z]?) · /gm)].map((m) => m[1]);
    assert.ok(requiredCases.length);
    assert.equal(new Set(requiredCases).size, requiredCases.length);
    const log = evidence(app, requiredCases);
    await log.prepare();
    console.log('Thư mục minh chứng: ' + app.evidence);
    await db.create();
    ownsSchema = true;
    console.log('Schema PostgreSQL riêng: ' + config.schema);
    await app.npm('db:generate');
    await app.npm('db:migrate');
    await app.npm('db:seed');
    const before = await seedSnapshot(db);
    await app.npm('db:seed');
    assert.deepEqual(await seedSnapshot(db), before, 'Seed chạy lại không đổi ID/tổng tin');
    const measurements = {};
    await app.npm('lint');
    await app.npm('typecheck');
    const testLog = await app.npm('test');
    const testSummary = await readFile(testLog, 'utf8');
    assert.match(testSummary, /^(?:ℹ|#) pass [1-9][0-9]*$/m, 'Không có test workspace đã chạy và đạt');
    for (const status of ['fail', 'cancelled', 'skipped', 'todo']) {
      assert.match(testSummary, new RegExp(`^(?:ℹ|#) ${status} 0$`, 'm'), `Test workspace có trạng thái ${status}`);
    }
    await app.npm('build', { NODE_ENV: 'production' });
    await app.startApplications();
    const operations = new Set();
    const f = await fixtures(apiFixture(app, operations));
    await searchPerformance(log.test, f, db, before[0].listings);
    await standardCases(log.test, f, db, google, app, config, measurements);
    await reservationCases(log.test, f, db, config, app);
    await restartCase(log.test, f, db, app, measurements);
    let browserError;
    try {
      await browserCases(log.test, f, db, config, app, google);
    } catch (error) {
      browserError = error;
      console.error('Không thể hoàn thành Chromium:', error.stack || error.message);
    }
    const checks = await Promise.allSettled([log.finish(), verifyOperations(operations, app)]);
    for (const check of checks) if (check.status === 'rejected') console.error(check.reason.message);
    assert.ok(!browserError && checks.every(({ status }) => status === 'fulfilled'), 'Bộ nghiệm thu chưa đạt, xem log theo mã KT và openapi.log');
    console.log(`Nghiệm thu đạt ${requiredCases.length}/${requiredCases.length} mã KT.`);
  } finally {
    process.off('SIGINT', terminate);
    process.off('SIGTERM', terminate);
    await cleanup();
  }
}
run().catch((error) => {
  console.error('Nghiệm thu lỗi:', error.stack || error.message);
  process.exitCode = 1;
});
