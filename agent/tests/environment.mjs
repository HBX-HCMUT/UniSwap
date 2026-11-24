import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { finished as streamFinished } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';

const loopback = '127.0.0.1';

function checkedUrl(raw, label, protocols, ports, pathnames, allowCredentials = false) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Thiếu hoặc sai định dạng ${label}`);
  }
  assert.ok(protocols.includes(url.protocol) && url.hostname === loopback
    && ports.includes(url.port) && pathnames.includes(url.pathname) && !url.hash
    && (allowCredentials || (!url.username && !url.password)), `${label} nằm ngoài môi trường nghiệm thu`);
  return url;
}

export function settings() {
  const database = checkedUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL',
    ['postgresql:', 'postgres:'], ['55433', '5432'], ['/uniswap_test'], true);
  for (const [key, value] of database.searchParams) {
    assert.ok(key === 'schema' && value === 'public' && database.searchParams.getAll(key).length === 1,
      'TEST_DATABASE_URL có tham số ngoài cấu hình DB test');
  }
  const smtp = checkedUrl(process.env.SMTP_URL, 'SMTP_URL', ['smtp:'], ['51025', '1025'], ['', '/']);
  const mailpit = checkedUrl(process.env.MAILPIT_API_URL, 'MAILPIT_API_URL', ['http:'],
    ['58025', '8025'], ['/']);
  assert.ok(!smtp.search && !mailpit.search, 'SMTP và Mailpit test chỉ nhận URL gốc');
  const schema = 'acceptance_' + randomBytes(10).toString('hex');
  database.searchParams.set('schema', schema);
  return { database: database.href, schema, smtp: smtp.href, mailpit: mailpit.origin };
}

function waitForExit(child) {
  return new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolveExit({ code, signal }));
  });
}

async function temporaryPort() {
  const server = createServer();
  await new Promise((listen, reject) => {
    server.once('error', reject);
    server.listen(0, loopback, listen);
  });
  const { port } = server.address();
  await new Promise((close, reject) => server.close((error) => error ? reject(error) : close()));
  return port;
}

export async function eventually(fn, timeoutMs, message) {
  const end = Date.now() + timeoutMs;
  do {
    const result = await fn();
    if (result) return result;
    await delay(25);
  } while (Date.now() < end);
  throw new Error(message);
}

export async function setup(config, issuer) {
  const evidence = resolve(process.env.ACCEPTANCE_EVIDENCE_DIR || '.agent-run/evidence/KT');
  await mkdir(evidence, { recursive: true });
  let apiPort = await temporaryPort();
  let webPort = await temporaryPort();
  while (webPort === apiPort) webPort = await temporaryPort();
  const workspace = await mkdtemp(join(tmpdir(), 'uniswap-acceptance-'));
  const apiOrigin = `http://${loopback}:${apiPort}`;
  const webOrigin = `http://${loopback}:${webPort}`;
  const env = {
    ...process.env,
    CI: 'true',
    DATABASE_URL: config.database,
    TEST_DATABASE_URL: config.database,
    SMTP_URL: config.smtp,
    MAILPIT_API_URL: config.mailpit,
    STUDENT_EMAIL_DOMAINS: 'student.example.test',
    MODERATION_KEYWORDS: 'hangcam-mau',
    JWT_SECRET: randomBytes(32).toString('hex'),
    API_ORIGIN: apiOrigin,
    APP_ORIGIN: webOrigin,
    API_PORT: String(apiPort),
    API_HOST: loopback,
    NODE_ENV: 'test',
    SMTP_FROM: 'UniSwap <no-reply@uniswap.example.test>',
    PORT: String(webPort),
    HOSTNAME: loopback,
    UPLOAD_DIR: join(workspace, 'uploads'),
    GOOGLE_OAUTH_ISSUER: issuer,
    GOOGLE_CLIENT_ID: 'uniswap-acceptance',
    GOOGLE_CLIENT_SECRET: 'uniswap-acceptance',
    GOOGLE_REDIRECT_URI: apiOrigin + '/api/v1/auth/google/callback',
    GOOGLE_CALLBACK_URL: apiOrigin + '/api/v1/auth/google/callback',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const children = new Set();
  const writtenLogs = new Set();
  let services = [];

  function command(file, args, logName, overrides = {}) {
    const logPath = join(evidence, logName);
    const log = createWriteStream(logPath, { flags: writtenLogs.has(logName) ? 'a' : 'w', mode: 0o600 });
    writtenLogs.add(logName);
    const child = spawn(file, args, {
      env: { ...env, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    children.add(child);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const flushed = streamFinished(log);
    void flushed.catch(() => {});
    const finished = waitForExit(child).finally(async () => {
      children.delete(child);
      log.end();
      await flushed;
    });
    // A server may fail before a readiness probe begins.
    void finished.catch(() => {});
    return { child, finished, logName, logPath };
  }

  async function npm(script, overrides = {}) {
    console.log(`npm run ${script}`);
    const { finished, logName, logPath } = command('npm', ['run', script],
      `npm-${script.replaceAll(':', '-')}.log`, overrides);
    const { code, signal } = await finished;
    assert.equal(code, 0, `npm run ${script} lỗi (${code ?? signal}), xem ${logName}`);
    return logPath;
  }

  async function stop(child) {
    if (!children.has(child)) return;
    for (const signal of ['SIGTERM', 'SIGKILL']) {
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
      for (let i = 0; i < 20 && children.has(child); i++) await delay(50);
      if (!children.has(child)) return;
    }
    throw new Error('Tiến trình nghiệm thu chưa dừng');
  }

  async function stopApplications() {
    await Promise.all(services.map(({ child }) => stop(child)));
    services = [];
  }

  async function startApplications() {
    services = [
      command('node', ['backend/dist/main.js'], 'backend.log', { NODE_ENV: 'test' }),
      command('npm', ['run', 'start', '-w', 'frontend', '--', '-H', loopback], 'frontend.log',
        { NODE_ENV: 'production' }),
    ];
    await Promise.all(services.map(async ({ child, logName }, index) => {
      const url = index === 0 ? apiOrigin + '/api/v1/health' : webOrigin;
      await eventually(async () => {
        assert.ok(children.has(child), `Ứng dụng đã dừng, xem ${logName}`);
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
          await response.arrayBuffer();
          return response.ok;
        } catch {
          return false;
        }
      }, 30000, `Quá thời gian chờ ứng dụng tại ${url}, xem ${logName}`);
    }));
  }

  return {
    evidence, env, apiOrigin, webOrigin, npm, startApplications, stopApplications,
    async dispose() {
      await Promise.all([...children].map(stop));
      await rm(workspace, { recursive: true, force: true });
    },
  };
}
