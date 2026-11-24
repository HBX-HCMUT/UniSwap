import assert from 'node:assert/strict';
import { assetPath, assertMeeting, moderatedTitle } from './api-cases.mjs';
import { randomUUID } from 'node:crypto';
import { assertImage, meeting, password, signIn, verificationLink } from './http.mjs';

const conflict = 'STATE_CONFLICT';
const cancel = { action: 'CANCEL' };
const complete = { action: 'COMPLETE' };
const reject = { action: 'REJECT' };

function assertStored(snapshot, listingState, reservations) {
  assert.equal(snapshot.listing.state, listingState);
  assert.equal(snapshot.reservations.length, reservations.length);
  for (const [id, state] of reservations) {
    assert.equal(snapshot.reservations.find((row) => row.id === id)?.state, state);
  }
}

export async function reservationCases(t, f, db, config, app) {
  const { anon, minh, lan, an, admin } = f;

  await t('KT05', 'API và PostgreSQL · hai POST và hai ACCEPT đồng thời', async (note) => {
    const listing = await f.createListing({ title: 'Giáo trình giữ trùng KT05' });
    const otherLan = await f.login('lan');
    const [first, repeat] = await db.queued('listings', listing.id,
      () => f.reserve(listing), () => f.reserve(listing, otherLan), note, false);
    assert.equal(first.id, repeat.id);
    assertStored(await db.inspect(listing.id), 'AVAILABLE', [[first.id, 'PENDING']]);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM conversations WHERE "listingId" = $1', [listing.id]))[0].count, 0);
    const contested = await f.createListing({ title: 'Giáo trình hai người giữ KT05' });
    const [lanRequest, anRequest] = await Promise.all([f.reserve(contested), f.reserve(contested, an)]);
    assert.notEqual(lanRequest.id, anRequest.id);
    assertStored(await db.inspect(contested.id), 'AVAILABLE', [[lanRequest.id, 'PENDING'], [anRequest.id, 'PENDING']]);
    const otherMinh = await f.login('minh');
    const jobs = [
      () => f.change(lanRequest, minh, meeting(), [200, 409]),
      () => f.change(anRequest, otherMinh, meeting(), [200, 409]),
    ];
    const results = await db.queued('listings', contested.id, ...jobs, note, false);
    const [winning] = results.filter(({ state }) => state === 'ACCEPTED');
    assert.equal(results.filter(({ state }) => state === 'ACCEPTED').length, 1);
    assert.deepEqual(results.filter(({ code }) => code).map(({ code }) => code), [conflict]);
    assertStored(await db.inspect(contested.id), 'RESERVED',
      [lanRequest, anRequest].map(({ id }) => [id, id === winning.id ? 'ACCEPTED' : 'REJECTED']));
    note('Hai POST cùng người khi chưa chat cùng 200/ID, DB chỉ một PENDING; hai người có hai PENDING; hai phiên Minh chốt cho đúng một 200 và một 409 STATE_CONFLICT; đọc mới thấy RESERVED, ACCEPTED và REJECTED.');
  });

  await t('KT05a', 'API và PostgreSQL · POST khác người đua ACCEPT theo hai thứ tự', async (note) => {
    for (const acceptFirst of [false, true]) {
      const listing = await f.createListing({ title: 'Giáo trình POST đua ACCEPT KT05a' });
      const target = await f.reserve(listing);
      const accept = () => f.change(target, minh, meeting());
      const submit = () => f.reserve(listing, an, acceptFirst ? 409 : 200, acceptFirst ? conflict : undefined);
      const [first, second] = await db.queued('users', minh.user.id,
        ...(acceptFirst ? [accept, submit] : [submit, accept]), note);
      const [accepted, submitted] = acceptFirst ? [first, second] : [second, first];
      assert.equal(accepted.state, 'ACCEPTED');
      const expected = [[target.id, 'ACCEPTED']];
      if (!acceptFirst) expected.push([submitted.id, 'REJECTED']);
      assertStored(await db.inspect(listing.id), 'RESERVED', expected);
      note(acceptFirst ? 'ACCEPT lấy khóa trước, POST An nhận 409 và không có hàng.'
        : 'POST An lấy khóa trước và trả 200, sau commit ACCEPT hàng An là REJECTED.');
    }
  });

  await t('KT05b', 'API và PostgreSQL · đóng tin hủy PENDING và hai thứ tự HIDE/ACCEPT', async (note) => {
    for (const action of ['HIDE', 'MARK_SOLD', 'EDIT']) {
      const body = await f.listingBody(minh, { title: 'Giáo trình đóng tin KT05b ' + action });
      const listing = (await minh.request('/listings', 201, { method: 'POST', body })).data;
      const pending = [await f.reserve(listing), await f.reserve(listing, an)];
      let expected = 'AVAILABLE';
      if (action === 'EDIT') {
        const edit = await minh.request('/listings/' + listing.id, 200, { method: 'PUT', body: { ...body, title: moderatedTitle } });
        assert.equal(edit.data.moderation, 'PENDING');
      } else {
        expected = action === 'HIDE' ? 'HIDDEN' : 'SOLD';
        assert.equal((await f.listingState(listing, action)).state, expected);
      }
      assertStored(await db.inspect(listing.id), expected, pending.map(({ id }) => [id, 'CANCELLED']));
      if (action === 'MARK_SOLD') {
        await f.review(pending[0], lan, 5, 409);
        assert.equal((await db.query('SELECT count(*)::int AS count FROM reviews WHERE "reservationId" = $1', [pending[0].id]))[0].count, 0);
      }
      note(action + ' hủy cả hai yêu cầu PENDING của tin riêng.');
    }
    for (const acceptFirst of [true, false]) {
      const listing = await f.createListing({ title: 'Giáo trình HIDE đua ACCEPT KT05b' });
      const target = await f.reserve(listing);
      const secondMinh = await f.login('minh');
      const accept = () => f.change(target, secondMinh, meeting(), acceptFirst ? 200 : 409,
        acceptFirst ? undefined : conflict);
      const hide = () => f.listingState(listing, 'HIDE', acceptFirst ? 409 : 200, acceptFirst ? conflict : undefined);
      await db.queued('users', minh.user.id, ...(acceptFirst ? [accept, hide] : [hide, accept]), note);
      assertStored(await db.inspect(listing.id), acceptFirst ? 'RESERVED' : 'HIDDEN',
        [[target.id, acceptFirst ? 'ACCEPTED' : 'CANCELLED']]);
      note(acceptFirst ? 'ACCEPT thắng, HIDE 409, lịch còn hiệu lực.' : 'HIDE thắng, ACCEPT 409, lịch CANCELLED.');
    }
  });

  await t('KT06a', 'API và PostgreSQL · đầu vào lịch/QR lỗi giữ nguyên trạng thái', async (note) => {
    const qr = await f.upload(minh, 'PAYMENT_QR');
    const otherQr = await f.upload(an, 'PAYMENT_QR');
    const photo = await f.upload(minh);
    const errors = [
      ['giờ hẹn quá khứ', () => meeting(-20), 422],
      ['QR thiếu ID', () => ({ ...meeting(), paymentMethod: 'QR_MANUAL' }), 400],
      ['mục đích ảnh sai', () => ({ ...meeting(), paymentMethod: 'QR_MANUAL', qrAssetId: photo.id }), 422],
      ['ảnh sai chủ', () => ({ ...meeting(), paymentMethod: 'QR_MANUAL', qrAssetId: otherQr.id }), [403, 404, 422]],
    ];
    for (const [label, invalid, status] of errors) {
      const listing = await f.createListing({ title: 'Giáo trình kiểm dữ liệu QR KT06a' });
      const target = await f.reserve(listing);
      const other = await f.reserve(listing, an);
      const previous = await db.inspect(listing.id);
      assert.equal(previous.listing.moderation, 'APPROVED');
      assertStored(previous, 'AVAILABLE', [[target.id, 'PENDING'], [other.id, 'PENDING']]);
      await f.change(target, minh, invalid(), status);
      assert.deepEqual(await db.inspect(listing.id), previous);
      const valid = { ...meeting(), paymentMethod: 'QR_MANUAL', qrAssetId: qr.id };
      const accepted = await f.change(target, minh, valid);
      assertMeeting(accepted, valid, 'ACCEPTED');
      await f.change(target, lan, cancel);
      note(label + ' bị từ chối, DB giữ nguyên; ACCEPT QR hợp lệ tiếp theo trả đủ giá, giờ, điểm hẹn và phương thức.');
    }
  });

  await t('KT06b', 'API và PostgreSQL · QR chỉ cấp quyền đúng lịch', async (note) => {
    for (const closed of ['CANCELLED', 'COMPLETED']) {
      const listing = await f.createListing({ title: 'Giáo trình lịch sử QR KT06b ' + closed });
      const photo = await f.upload(minh, 'PAYMENT_QR');
      const target = await f.reserve(listing);
      const input = { ...meeting(), paymentMethod: 'QR_MANUAL', qrAssetId: photo.id };
      const accepted = await f.change(target, minh, input);
      assertMeeting(accepted, input, 'ACCEPTED');
      assert.equal(accepted.qrAsset.id, photo.id);
      const oldUrl = assetPath(accepted.qrAsset);
      await assertImage((await lan.request(oldUrl, 200)).data);
      await an.request(oldUrl, 404);
      await anon(oldUrl, 404);
      await f.change(target, lan, closed === 'CANCELLED' ? cancel : complete);
      const [freshLan, freshMinh] = await Promise.all([f.login('lan'), f.login('minh')]);
      for (const who of [freshLan, freshMinh]) {
        const state = await f.history(target, who);
        assertMeeting(state, input, closed);
        if (closed === 'CANCELLED') assert.ok(!Object.hasOwn(state, 'qrAsset'));
        else assert.equal(state.qrAsset.id, photo.id);
      }
      if (closed === 'CANCELLED') await freshLan.request(oldUrl, 404);
      else await assertImage((await freshLan.request(oldUrl, 200)).data);
      await an.request(oldUrl, 404);
      const previous = await db.inspect(listing.id);
      assertStored(previous, closed === 'CANCELLED' ? 'AVAILABLE' : 'SOLD', [[target.id, closed]]);
      note(closed === 'CANCELLED' ? 'Sau tải lại hai vai trò giữ lịch/giá/phương thức nhưng bỏ qrAsset, URL cũ Lan nhận 404.'
        : 'Sau hoàn tất/tải lại, Lan đọc được đúng ảnh, An vẫn 404, cơ sở dữ liệu giữ SOLD + COMPLETED.');
    }
  });

  await t('KT06c', 'API và PostgreSQL · CANCEL đua COMPLETE theo hai thứ tự', async (note) => {
    for (const cancelFirst of [true, false]) {
      const listing = await f.createListing({ title: 'Giáo trình CANCEL đua COMPLETE KT06c' });
      const target = await f.reserve(listing);
      await f.change(target, minh, meeting());
      const sellerCancels = () => f.change(target, minh, cancel, cancelFirst ? 200 : 409, cancelFirst ? undefined : conflict);
      const buyerCompletes = () => f.change(target, lan, complete, cancelFirst ? 409 : 200, cancelFirst ? conflict : undefined);
      await db.queued('users', minh.user.id, ...(cancelFirst ? [sellerCancels, buyerCompletes] : [buyerCompletes, sellerCancels]), note);
      assertStored(await db.inspect(listing.id), cancelFirst ? 'AVAILABLE' : 'SOLD',
        [[target.id, cancelFirst ? 'CANCELLED' : 'COMPLETED']]);
      note(cancelFirst ? 'CANCEL 200, COMPLETE 409, CANCELLED + AVAILABLE.'
        : 'COMPLETE 200, CANCEL 409, COMPLETED + SOLD.');
    }
  });

  await t('KT06d', 'API · lọc đúng lịch hiện hành/lịch sử từ hội thoại', async (note) => {
    const listing = await f.createListing({ title: 'Giáo trình từ hộp thư KT06d' });
    const first = await f.reserve(listing);
    const conversation = await f.conversation(listing);
    const otherConversation = await f.conversation(listing, an);
    const path = (id) => '/reservations?conversationId=' + id;
    const lanHistory = async () => (await lan.request(path(conversation.id), 200)).data.items.map(({ id }) => id);
    assert.deepEqual(await lanHistory(), [first.id]);
    assert.deepEqual((await an.request(path(otherConversation.id), 200)).data.items, []);
    await f.change(first, lan, cancel);
    assert.deepEqual(await lanHistory(), [first.id]);
    const second = await f.reserve(listing);
    const outsider = await f.reserve(listing, an);
    assert.deepEqual(await lanHistory(), [second.id, first.id]);
    assert.deepEqual((await an.request(path(otherConversation.id), 200)).data.items.map(({ id }) => id), [outsider.id]);
    await an.request(path(conversation.id), 404);
    await lan.request(path(otherConversation.id), 404);
    assert.ok((await minh.request('/reservations?role=SELLER&state=PENDING', 200)).data.items.some(({ id }) => id === second.id));
    note('Giữ trước chat; bộ lọc trả đúng yêu cầu Lan, chỉ lịch sử sau hủy, lượt mới xếp đầu, An thấy rỗng trước khi gửi, đổi conversationId nhận 404.');
  });

  await t('KT09a', 'API và PostgreSQL · khóa người mua/bán và gỡ đua POST/ACCEPT', async (note) => {
    const independentListing = await f.createListing({ title: 'Giáo trình đối chứng không bị tác động' });
    const independent = await f.reserve(independentListing);
    await f.change(independent, minh, meeting());
    // An sells to a separately verified student. Neither appears in the control transaction.
    const buyer = await verifiedRaceBuyer(f, config, app);
    let currentAn = an;

    for (const role of ['buyer', 'seller']) {
      for (const action of ['POST', 'ACCEPT']) {
        for (const holdFirst of [true, false]) {
          const buyerSession = await buyer.login();
          const locked = role === 'buyer' ? buyerSession : currentAn;
          const listing = await f.createListing({ title: 'Giáo trình khóa đua giữ KT09a' }, currentAn);
          const target = action === 'ACCEPT' ? await f.reserve(listing, buyerSession) : null;
          const adminPath = '/admin/users/' + locked.user.id;
          const lock = () => admin.request(adminPath, 200, { method: 'PATCH', body: { status: 'LOCKED', reason: 'Kiểm thử race KT09a' } });
          // When locking the buyer, POST's authenticated session is revoked. ACCEPT is a
          // seller request, but its buyer must still be active. A locked seller's tin is private.
          const hold = () => action === 'POST'
            ? f.reserve(listing, buyerSession, holdFirst ? 200 : role === 'buyer' ? 401 : 404)
            : f.change(target, currentAn, meeting(), holdFirst ? 200 : role === 'seller' ? 401 : 409);
          const order = holdFirst ? [hold, lock] : [lock, hold];
          const results = await db.queued('users', locked.user.id, ...order, note);
          await locked.request('/me', 401);
          await anon('/listings/' + listing.id, role === 'seller' ? 404 : 200);
          const affected = await db.inspect(listing.id);
          const expected = target ? [[target.id, 'CANCELLED']] : holdFirst ? [[results[0].id, 'CANCELLED']] : [];
          assertStored(affected, 'AVAILABLE', expected);
          await admin.request(adminPath, 200, { method: 'PATCH', body: { status: 'ACTIVE', reason: 'Mở lại KT09a' } });
          await locked.request('/me', 401);
          assert.deepEqual(await db.inspect(listing.id), affected);
          await anon('/listings/' + listing.id, 200);
          assertStored(await db.inspect(independentListing.id), 'RESERVED', [[independent.id, 'ACCEPTED']]);
          if (role === 'seller') currentAn = await f.login('an');
          note(`Khóa ${role} / ${action}, ${holdFirst ? 'giữ' : 'khóa'} thắng: phiên cũ mất, tin giải phóng, mở khóa giữ nguyên lịch sử và yêu cầu đối chứng.`);
        }
      }
    }
    f.an = currentAn;

    for (const holdFirst of [true, false]) {
      const listing = await f.createListing({ title: 'Giáo trình gỡ đua ACCEPT KT09a' });
      const target = await f.reserve(listing);
      const remove = () => admin.request('/admin/listings/' + listing.id, 200,
        { method: 'PATCH', body: { action: 'REMOVE', reason: 'Gỡ đua ACCEPT KT09a' } });
      const hold = () => f.change(target, minh, meeting(), holdFirst ? 200 : 409, holdFirst ? undefined : conflict);
      await db.queued('users', minh.user.id, ...(holdFirst ? [hold, remove] : [remove, hold]), note);
      const affected = await db.inspect(listing.id);
      assertStored(affected, 'AVAILABLE', [[target.id, 'CANCELLED']]);
      assert.equal(affected.listing.moderation, 'REMOVED');
      await anon('/listings/' + listing.id, 404);
      assertStored(await db.inspect(independentListing.id), 'RESERVED', [[independent.id, 'ACCEPTED']]);
      note(`Gỡ / ACCEPT, ${holdFirst ? 'giữ' : 'gỡ'} thắng: tin REMOVED/404, yêu cầu CANCELLED, giao dịch độc lập không đổi.`);
    }
  });

  await t('KT11a', 'API và PostgreSQL · sai vai trò và người ngoài', async (note) => {
    const listing = await f.createListing({ title: 'Giáo trình quyền yêu cầu KT11a' });
    const pending = await f.reserve(listing);
    const before = await db.inspect(listing.id);
    await f.change(pending, lan, meeting(), 403);
    await f.change(pending, minh, cancel, 403);
    await f.reserve(listing, minh, 403);
    await f.history(pending, f.an, 404);
    await f.change(pending, f.an, cancel, 404);
    assert.deepEqual(await db.inspect(listing.id), before);
    await f.change(pending, minh, meeting());
    const afterAccept = await db.inspect(listing.id);
    await f.change(pending, minh, complete, 403);
    assert.deepEqual(await db.inspect(listing.id), afterAccept);
    const other = await f.createListing({ title: 'Giáo trình quyền đối chứng KT11a' });
    const withdrawn = await f.reserve(other);
    const refused = await f.reserve(other, f.an);
    await f.change(withdrawn, lan, cancel);
    await f.change(refused, minh, reject);
    assertStored(await db.inspect(other.id), 'AVAILABLE', [[withdrawn.id, 'CANCELLED'], [refused.id, 'REJECTED']]);
    note('Lan ACCEPT, Minh CANCEL khi PENDING, COMPLETE khi ACCEPTED hoặc tự giữ đều 403; An đọc/sửa 404; DB giữ nguyên; Lan rút và Minh từ chối đối chứng cập nhật đúng.');
  });
}

async function verifiedRaceBuyer(f, config, app) {
  const email = 'kt09a-' + randomUUID() + '@student.example.test';
  await f.anon('/auth/register', 202, { method: 'POST', body: { email, password, displayName: 'Người mua KT09a' } });
  const link = await verificationLink(config.mailpit, email, app.webOrigin);
  await f.anon('/auth/verify', 200, { method: 'POST', body: { token: link.searchParams.get('token') } });
  return {
    async login() {
      const request = f.newClient();
      return { request, user: await signIn(request, '', 200, email) };
    },
  };
}
