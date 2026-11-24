import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

test('yêu cầu giữ đồng thời có một lịch thắng và từ chối người ngoài', async (t) => {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) return t.skip('Cần TEST_DATABASE_URL của PostgreSQL thử nghiệm.');
  const database = new URL(testUrl);
  assert.match(database.pathname, /\/[^/]*test[^/]*$/i, 'Chỉ ghi vào cơ sở dữ liệu thử nghiệm.');
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET ??= randomUUID();
  const { createApp } = await import('../src/main');
  const { db } = await import('../src/common/db');
  const app = await createApp();
  await app.listen(0, '127.0.0.1');
  t.after(async () => {
    await app.close();
    await db.$disconnect();
  });
  const base = `${await app.getUrl()}/api/v1`;

  async function login(name: string) {
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${name}@student.example.test`, password: 'UniSwapDemo123!' }),
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie')?.split(';')[0];
  }

  const [seller, buyer, rival] = await Promise.all([login('minh'), login('lan'), login('an')]);
  const accounts = await db.user.findMany({
    where: { email: { in: ['minh@student.example.test', 'lan@student.example.test', 'an@student.example.test'] } },
  });
  const sellerId = accounts.find((user) => user.email.startsWith('minh@'))?.id;
  const buyerId = accounts.find((user) => user.email.startsWith('lan@'))?.id;
  const [school, category] = await Promise.all([db.school.findFirstOrThrow(), db.category.findFirstOrThrow()]);
  assert.ok(sellerId && buyerId && seller && buyer && rival);
  const listing = await db.listing.create({
    data: {
      sellerId, schoolId: school.id, categoryId: category.id, title: randomUUID(), description: 'Món thử nghiệm',
      price: 10000, area: 'KTX A', condition: 'GOOD',
    },
  });
  t.after(async () => {
    await db.$transaction([
      db.notification.deleteMany({ where: { resourceId: { in: (await db.reservation.findMany({
        where: { listingId: listing.id }, select: { id: true },
      })).map(({ id }) => id) } } }),
      db.conversation.deleteMany({ where: { listingId: listing.id } }),
      db.reservation.deleteMany({ where: { listingId: listing.id } }),
      db.listing.delete({ where: { id: listing.id } }),
    ]);
    await db.$disconnect();
  });

  function request(path: string, method: string, cookie: string, payload?: object) {
    return fetch(`${base}${path}`, {
      method, headers: { cookie, 'content-type': 'application/json' },
      body: payload && JSON.stringify(payload),
    });
  }

  const createFor = (cookie: string) => request('/reservations', 'POST', cookie, { listingId: listing.id });
  const duplicated = await Promise.all([createFor(buyer), createFor(buyer)]);
  assert.deepEqual(duplicated.map(({ status }) => status), [200, 200]);
  const [first, second] = await Promise.all(duplicated.map((response) => response.json() as Promise<{ id: string }>));
  assert.equal(first.id, second.id);
  const outsider = await request(`/reservations/${first.id}`, 'GET', rival);
  assert.equal(outsider.status, 404);
  const competitor = await createFor(rival);
  assert.equal(competitor.status, 200);
  const { id: competingId } = await competitor.json() as { id: string };

  const appointment = {
    action: 'ACCEPT', finalPrice: 8000, meetingAt: new Date(Date.now() + 3600000).toISOString(),
    meetingPlace: 'Sảnh A', paymentMethod: 'COD',
  };
  const invalidAppointment = await request(`/reservations/${first.id}`, 'PATCH', seller, {
    ...appointment, meetingAt: '2099-12-31T23:59:60Z',
  });
  assert.equal(invalidAppointment.status, 422);
  assert.equal((await invalidAppointment.json() as { code: string }).code, 'INVALID_VALUE');
  const pending = await db.reservation.findMany({ where: { listingId: listing.id } });
  assert.deepEqual(pending.map(({ state }) => state), ['PENDING', 'PENDING']);
  assert.equal((await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).state, 'AVAILABLE');

  const results = await Promise.all([first.id, competingId].map((id) =>
    request(`/reservations/${id}`, 'PATCH', seller, appointment),
  ));
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
  const conflict = results.find(({ status }) => status === 409);
  assert.equal((await conflict?.json() as { code: string }).code, 'STATE_CONFLICT');
  const [confirmedListing, reservations] = await Promise.all([
    db.listing.findUniqueOrThrow({ where: { id: listing.id } }),
    db.reservation.findMany({ where: { listingId: listing.id } }),
  ]);
  assert.equal(confirmedListing.state, 'RESERVED');
  assert.deepEqual(reservations.map(({ state }) => state).sort(), ['ACCEPTED', 'REJECTED']);

  await t.test('chỉ người mua đã được giữ món mở được hội thoại mới trên tin RESERVED', async () => {
    const accepted = reservations.find(({ state }) => state === 'ACCEPTED');
    assert.ok(accepted);
    const [winner, loser] = accepted.buyerId === buyerId ? [buyer, rival] : [rival, buyer];
    const open = (cookie: string) => request('/conversations', 'POST', cookie, { listingId: listing.id });
    assert.equal(await db.conversation.count({ where: { listingId: listing.id } }), 0);

    const blocked = await open(loser);
    assert.equal(blocked.status, 409);
    assert.equal((await blocked.json() as { code: string }).code, 'STATE_CONFLICT');

    const created = await open(winner);
    assert.equal(created.status, 200);
    const conversation = await created.json() as { id: string; listingId: string; buyerId: string; sellerId: string };
    assert.equal(conversation.buyerId, accepted.buyerId);
    assert.equal(conversation.sellerId, sellerId);
    assert.equal(conversation.listingId, listing.id);
    const reopened = await open(winner);
    assert.equal(reopened.status, 200);
    assert.equal((await reopened.json() as { id: string }).id, conversation.id);
    assert.equal(await db.conversation.count({ where: { listingId: listing.id } }), 1);
  });
});
