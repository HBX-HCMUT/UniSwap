import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { availableParallelism, cpus, platform, release, totalmem } from 'node:os';
import { assertImage, formFor, meeting, password, signIn, verificationLink } from './http.mjs';

export const moderatedTitle = 'Giáo trình hangcam-mau';
const post = (body) => ({ method: 'POST', body });
const patch = (body) => ({ method: 'PATCH', body });
const put = (body) => ({ method: 'PUT', body });
const del = { method: 'DELETE' };

export async function fixtures(api) {
  const [minh, lan, an, admin] = await Promise.all(['minh', 'lan', 'an', 'admin'].map(api.login));
  const schools = (await api.anon('/schools', 200)).data;
  const categories = (await api.anon('/categories', 200)).data;
  const school = schools.find(({ code }) => code === 'A');
  const category = categories.find(({ name }) => name === 'Giáo trình');
  assert.ok(school && schools.some(({ code }) => code === 'B') && category);
  assert.ok(['Đồ KTX', 'Điện tử'].every((name) => categories.some((entry) => entry.name === name)));
  const upload = async (who, purpose = 'LISTING') => (await who.request('/assets', 201, post(formFor(purpose)))).data;
  const listingBody = async (seller = minh, extra = {}) => ({
    title: 'Giáo trình Giải tích 1',
    description: 'Sách mẫu còn tốt để nghiệm thu UniSwap.',
    price: 65000, condition: 'GOOD', categoryId: category.id, schoolId: school.id,
    area: 'KTX A',
    imageIds: [(await upload(seller)).id], ...extra,
  });
  const createListing = async (extra = {}, seller = minh) => {
    const body = await listingBody(seller, extra);
    return (await seller.request('/listings', 201, post(body))).data;
  };
  const reserve = async (listing, who = lan, status = 200, code) =>
    (await who.request('/reservations', status, { ...post({ listingId: listing.id }), code })).data;
  const change = async (item, who, body, status = 200, code) =>
    (await who.request('/reservations/' + item.id, status, { ...patch(body), code })).data;
  const history = async (item, who, status = 200) => (await who.request('/reservations/' + item.id, status)).data;
  const listingState = async (listing, action, status = 200, code) =>
    (await minh.request('/listings/' + listing.id + '/state', status, { ...patch({ action }), code })).data;
  const review = async (item, who, rating, status = 201) =>
    (await who.request('/reservations/' + item.id + '/reviews', status, post({ rating, comment: 'Giao dịch thử nghiệm.' }))).data;
  const notifications = async (actor, suffix = '') =>
    (await actor.request('/notifications?pageSize=100' + suffix, 200)).data.items;
  const conversation = async (listing, who = lan) =>
    (await who.request('/conversations', 200, post({ listingId: listing.id }))).data;
  const report = async (listing, who = lan) =>
    (await who.request('/reports', 201, post({ listingId: listing.id, reason: 'SPAM', details: 'Mẫu nghiệm thu.' }))).data;
  return {
    ...api, minh, lan, an, admin, school, category, upload, listingBody, createListing,
    reserve, change, history, listingState, review, notifications, conversation, report,
  };
}

export function assetPath(asset) {
  const url = new URL(asset.url, 'http://127.0.0.1');
  assert.equal(url.pathname, '/api/v1/assets/' + asset.id);
  assert.ok(!url.search && !url.hash);
  return url.pathname.slice('/api/v1'.length);
}

export function assertMeeting(reservation, body, state) {
  assert.equal(reservation.state, state);
  for (const key of ['finalPrice', 'meetingAt', 'meetingPlace', 'paymentMethod']) {
    assert.equal(reservation[key], body[key], 'Lịch hẹn giữ giá trị ' + key);
  }
}

const profileKeys = ['averageRating', 'displayName', 'id', 'reviewCount', 'schoolId'];
const statsRange = () => '?' + new URLSearchParams({
  from: new Date(Date.now() - 86_400_000).toISOString(),
  to: new Date(Date.now() + 86_400_000).toISOString(),
});
const authDomain = '@student.example.test';

export async function standardCases(t, f, db, google, app, config, measurements) {
  const { anon, minh, lan, an, admin, school, category } = f;

  await t('KT01', 'API · SMTP, tài khoản, hồ sơ, OAuth fixture', async (note) => {
    const email = 'kt01-' + randomUUID() + authDomain;
    const credentials = { email, password, displayName: 'Sinh viên mới KT01' };
    await anon('/health', 200);
    await anon('/auth/register', 400, post({ ...credentials, email: 'ngoaimien@example.test' }));
    await anon('/auth/register', 202, post(credentials));
    await signIn(f.newClient(), '', 403, email);
    await signIn(f.newClient(), 'chua-xac-minh', 403);
    const firstEmail = await verificationLink(config.mailpit, email, app.webOrigin);
    await anon('/auth/resend', 202, post({ email }));
    const resent = await verificationLink(config.mailpit, email, app.webOrigin, 2);
    const token = resent.searchParams.get('token');
    assert.notEqual(token, firstEmail.searchParams.get('token'));
    await anon('/auth/verify', 200, post({ token }));
    await anon('/auth/verify', 410, post({ token }));
    const newbie = f.newClient();
    const user = await signIn(newbie, '', 200, email);
    const updates = { displayName: 'Sinh viên đã xác minh', schoolId: school.id, area: 'KTX A', contact: 'Liên hệ riêng KT01' };
    const updated = (await newbie('/me', 200, patch(updates))).data;
    for (const [key, value] of Object.entries(updates)) assert.equal(updated[key], value);
    const profile = (await anon('/users/' + user.id, 200)).data;
    assert.deepEqual(Object.keys(profile).sort(), profileKeys);
    assert.equal(profile.displayName, updates.displayName);
    await newbie('/auth/logout', 200, post());
    await newbie('/me', 401);
    note('Đăng ký sai miền 400, chưa xác minh 403, Mailpit có hai thư đúng người nhận, token mới chỉ dùng một lần, đăng nhập OK, PATCH hồ sơ, GET công khai bỏ email/liên hệ, logout thu hồi phiên');

    async function oauth(emailAddress, verified, status, hostedDomain) {
      google.use(emailAddress, verified, hostedDomain);
      const api = f.newClient();
      const start = await api('/auth/google', 302);
      const authorize = new URL(start.headers.get('location'));
      assert.equal(authorize.origin, google.issuer);
      assert.equal(authorize.pathname, '/authorize');
      const response = await fetch(authorize, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
      await response.arrayBuffer();
      assert.equal(response.status, 302, 'OIDC fixture trả code về callback');
      const callback = new URL(response.headers.get('location'));
      assert.equal(callback.origin, app.apiOrigin);
      assert.equal(callback.pathname, '/api/v1/auth/google/callback');
      const result = await api('/auth/google/callback' + callback.search, status);
      if (status === 302) {
        const location = new URL(result.headers.get('location'), app.apiOrigin);
        assert.equal(location.origin, app.webOrigin);
        assert.equal((await api('/me', 200)).data.email, emailAddress);
      } else {
        await api('/me', 401);
        assert.equal((await db.query('SELECT count(*)::int AS count FROM users WHERE email = $1', [emailAddress]))[0].count, 0);
      }
    }
    await oauth('google-valid' + authDomain, true, 302);
    await oauth('google-wrong@example.test', true, 403);
    await oauth('google-unverified' + authDomain, false, 403);
    await oauth('google-unmanaged' + authDomain, true, 403, null);
    await anon('/auth/google/callback?code=unused&state=bad-state', 400);
    const canceled = await fetch(app.apiOrigin + '/api/v1/auth/google/callback?error=access_denied', {
      headers: { Accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(3000),
    });
    await canceled.arrayBuffer();
    assert.equal(canceled.status, 302);
    assert.equal(canceled.headers.get('location'), app.webOrigin + '/login?oauth=error');
    note('OAuth giả lập có code, nonce/state, token RS256 và JWKS, đúng miền tạo phiên, sai miền, chưa xác minh hoặc không do Google quản lý 403, callback sai state 400. Google thật chưa chạy trong bộ local.');
  });

  await t('KT02', 'API · đăng ảnh, giới hạn, quyền sửa và hiển thị', async (note) => {
    await anon('/assets/upload-ticket', 401, post({ purpose: 'LISTING' }));
    await minh.request('/assets/upload-ticket', 503, post({ purpose: 'LISTING' }));
    await minh.request('/assets/upload-complete', 400, post({ ticket: 'invalid-ticket' }));
    const body = await f.listingBody();
    const listing = (await minh.request('/listings', 201, post(body))).data;
    assert.equal(listing.price, 65000);
    assert.equal(listing.seller.id, minh.user.id);
    assert.equal(listing.images[0].id, body.imageIds[0]);
    const response = await anon(assetPath(listing.images[0]), 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    await assertImage(response.data);
    const tooMany = await Promise.all(Array.from({ length: 7 }, () => f.upload(minh)));
    await minh.request('/listings', 400, post({ ...body, imageIds: tooMany.map(({ id }) => id) }));
    await minh.request('/assets', 415, post(formFor('LISTING', false)));
    await lan.request('/listings/' + listing.id, 403, put({ ...body, price: 1 }));
    await minh.request('/listings/' + listing.id, 200, put({ ...body, price: 67000 }));
    assert.equal((await f.listingState(listing, 'HIDE')).state, 'HIDDEN');
    await anon('/listings/' + listing.id, 404);
    await anon(assetPath(listing.images[0]), 404);
    assert.ok((await minh.request('/me/listings?pageSize=100', 200)).data.items.some(({ id }) => id === listing.id));
    assert.equal((await f.listingState(listing, 'SHOW')).state, 'AVAILABLE');
    assert.equal((await anon('/listings/' + listing.id, 200)).data.price, 67000);
    assert.ok((await anon('/listings?pageSize=100', 200)).data.items.some(({ id }) => id === listing.id));
    note('Giá nguyên và ảnh bìa có đúng dữ liệu, 7 ảnh trả 400, ảnh văn bản 415; Lan không sửa được; khách mất cả tin/ảnh khi ẩn và tìm lại tin sau hiện.');
  });

  await t('KT03', 'API · giao của bộ lọc, phân trang và hồ sơ rỗng', async (note) => {
    const target = await f.createListing();
    const decoys = await Promise.all([
      f.createListing({ area: 'KTX khác' }),
      f.createListing({ price: 90000 }),
      f.createListing({ condition: 'FAIR' }),
    ]);
    const filter = new URLSearchParams({
      q: 'Giải tích', schoolId: school.id, area: 'KTX A', minPrice: '50000', maxPrice: '70000',
      condition: 'GOOD', categoryId: category.id,
    });
    const result = (await anon('/listings?' + filter, 200)).data;
    assert.ok(result.items.some(({ id }) => id === target.id));
    assert.ok(decoys.every(({ id }) => !result.items.some((item) => item.id === id)));
    const paged = (await anon('/listings?' + filter + '&page=1&pageSize=1', 200)).data;
    assert.equal(paged.items.length, 1);
    assert.equal(paged.total, result.total);
    filter.set('area', 'KTX không tồn tại');
    assert.deepEqual((await anon('/listings?' + filter, 200)).data.items, []);
    filter.set('maxPrice', '40000');
    await anon('/listings?' + filter, 400);
    const item = (await anon('/listings/' + target.id, 200)).data;
    assert.equal(item.seller.averageRating, null);
    assert.equal(item.seller.reviewCount, 0);
    assert.equal((await anon('/users/' + item.seller.id + '/reviews', 200)).data.total, 0);
    note('Tin đúng lên theo toàn bộ lọc; loại ba tin trái khu vực/giá/tình trạng; trang kích thước 1 giữ tổng; lọc không khớp rỗng; maxPrice=40.000 với minPrice=50.000 trả 400; chi tiết không có lượt chấm.');
  });

  await t('KT04', 'API · hội thoại, tin nhắn, thông báo và quyền', async (note) => {
    const listing = await f.createListing({ title: 'Giáo trình hỏi mua KT04' });
    const convo = await f.conversation(listing);
    const anotherLan = await f.login('lan');
    assert.equal((await f.conversation(listing, anotherLan)).id, convo.id);
    const text = '60.000 đ ở sảnh A1 được không?';
    const message = (await lan.request('/conversations/' + convo.id + '/messages', 201, post({ text }))).data;
    assert.equal(message.text, text);
    assert.equal(message.senderId, lan.user.id);
    assert.ok((await minh.request('/conversations', 200)).data.items.some(({ id }) => id === convo.id));
    const fresh = await f.login('minh');
    const read = (await fresh.request('/conversations/' + convo.id + '/messages', 200)).data.items;
    assert.ok(read.some(({ id }) => id === message.id));
    await an.request('/conversations/' + convo.id + '/messages', 404);
    await an.request('/conversations/' + convo.id + '/messages', 404, post({ text }));
    assert.ok((await f.notifications(minh)).some((item) => item.kind === 'MESSAGE' && item.resourceId === convo.id));
    note('Phiên riêng lấy lại cùng ID hội thoại, Minh tải lại còn tin và thông báo; An đọc/gửi qua URL nhận 404.');
  });

  await t('KT06', 'API và PostgreSQL · hủy, giữ lại, hoàn tất đúng một lần', async (note) => {
    const listing = await f.createListing({ title: 'Giáo trình đổi lịch KT06' });
    const first = await f.reserve(listing);
    const old = meeting(120);
    assertMeeting(await f.change(first, minh, old), old, 'ACCEPTED');
    assertMeeting(await f.change(first, minh, { action: 'CANCEL' }), old, 'CANCELLED');
    const afterCancel = await db.inspect(listing.id);
    assert.equal(afterCancel.listing.state, 'AVAILABLE');
    const second = await f.reserve(listing);
    assert.notEqual(first.id, second.id);
    const data = { ...meeting(160), meetingPlace: 'Sảnh A2' };
    assertMeeting(await f.change(second, minh, data), data, 'ACCEPTED');
    const range = statsRange();
    const before = (await admin.request('/admin/stats' + range, 200)).data.completedCount;
    const result = await f.change(second, lan, { action: 'COMPLETE' });
    assertMeeting(result, data, 'COMPLETED');
    assert.ok(Number.isFinite(Date.parse(result.completedAt)));
    assert.equal(result.viewerHasReviewed, false);
    const stored = await db.inspect(listing.id);
    assert.equal(stored.listing.state, 'SOLD');
    assert.equal(stored.reservations.filter(({ state }) => state === 'COMPLETED').length, 1);
    assert.equal(stored.reservations.find(({ id }) => id === second.id).completedAt.toISOString(), result.completedAt);
    await f.change(second, lan, { action: 'COMPLETE' }, 409, 'STATE_CONFLICT');
    assert.equal((await f.history(second, lan)).completedAt, result.completedAt);
    assert.equal((await admin.request('/admin/stats' + range, 200)).data.completedCount, before + 1);
    note('CANCELLED giữ lịch cũ và mở lại tin; yêu cầu mới có ID/lịch mới; commit SOLD, COMPLETED và completedAt; COMPLETE lặp trả 409, giữ thời điểm và chỉ tăng bộ đếm một.');
    measurements.restart = { listing, reservation: second, completedAt: result.completedAt };
  });

  await t('KT07', 'API · lưu, theo dõi và gộp thông báo', async (note) => {
    const listing = await f.createListing({ title: 'Giáo trình lưu lại KT07' });
    await lan.request('/me/favorites/' + listing.id, 204, put());
    const freshLan = await f.login('lan');
    assert.ok((await freshLan.request('/me/saved', 200)).data.listings.some(({ id }) => id === listing.id));
    await lan.request('/me/favorites/' + listing.id, 204, del);
    assert.ok(!(await freshLan.request('/me/saved', 200)).data.listings.some(({ id }) => id === listing.id));
    await lan.request('/me/seller-follows/' + minh.user.id, 204, put());
    await lan.request('/me/category-follows/' + category.id, 204, put());
    const editBody = await f.listingBody(minh, { title: 'Giáo trình mới cho người theo dõi' });
    const newest = (await minh.request('/listings', 201, post(editBody))).data;
    const matching = async () => (await f.notifications(freshLan))
      .filter(({ kind, resourceId }) => kind === 'NEW_LISTING' && resourceId === newest.id);
    const [original] = await matching();
    assert.ok(original);
    assert.equal((await matching()).length, 1);
    assert.equal(original.readAt, null);
    await minh.request('/listings/' + newest.id, 200, put({ ...editBody, price: 62000 }));
    assert.deepEqual((await matching()).map(({ id }) => id), [original.id]);
    await an.request('/notifications/' + original.id + '/read', 404, put());
    const nowRead = (await lan.request('/notifications/' + original.id + '/read', 200, put())).data;
    assert.ok(Number.isFinite(Date.parse(nowRead.readAt)));
    assert.equal((await matching())[0].readAt, nowRead.readAt);
    await lan.request('/me/seller-follows/' + minh.user.id, 204, del);
    await lan.request('/me/category-follows/' + category.id, 204, del);
    const saved = (await freshLan.request('/me/saved', 200)).data;
    assert.ok(!saved.sellers.some(({ id }) => id === minh.user.id) && !saved.categories.some(({ id }) => id === category.id));
    note('Phiên Lan mới thấy bật/tắt lưu; theo dõi Minh và Giáo trình được đúng một NEW_LISTING, sửa giá không tạo trùng; An đánh dấu đọc bị chặn, Lan đọc và giữ readAt.');
  });

  await t('KT08', 'API · đánh giá hai chiều, tính điểm từ các lượt thật', async (note) => {
    const listing = await f.createListing({ title: 'Giáo trình đánh giá KT08' });
    const item = await f.reserve(listing);
    await f.review(item, lan, 5, 409);
    await f.change(item, minh, meeting());
    await f.review(item, lan, 5, 409);
    await f.change(item, lan, { action: 'COMPLETE' });
    const review = await f.review(item, lan, 5);
    assert.equal(review.targetId, minh.user.id);
    const [againLan, againMinh] = await Promise.all([f.login('lan'), f.login('minh')]);
    assert.equal((await f.history(item, againLan)).viewerHasReviewed, true);
    assert.equal((await f.history(item, againMinh)).viewerHasReviewed, false);
    assert.equal((await f.review(item, minh, 4)).targetId, lan.user.id);
    await f.review(item, an, 5, 404);
    await f.review(item, lan, 5, 409);
    const secondListing = await f.createListing({ title: 'Giáo trình đối chiếu điểm uy tín' });
    const second = await f.reserve(secondListing, an);
    await f.change(second, minh, meeting());
    await f.change(second, an, { action: 'COMPLETE' });
    await f.review(second, an, 4);
    const sellerReviews = (await anon('/users/' + minh.user.id + '/reviews', 200)).data;
    assert.deepEqual(sellerReviews.items.map(({ rating }) => rating).sort(), [4, 5]);
    const average = (await anon('/users/' + minh.user.id, 200)).data;
    assert.equal(average.reviewCount, 2);
    assert.equal(average.averageRating, 4.5);
    const buyer = (await anon('/users/' + lan.user.id, 200)).data;
    assert.equal(buyer.reviewCount, 1);
    assert.equal(buyer.averageRating, 4);
    note('Trước giao nhận hoặc đánh giá lặp 409, An ngoài cuộc 404, mỗi phiên tải lại thấy viewerHasReviewed riêng; Minh 4,5/2 và Lan 4/1 từ danh sách lượt thực.');
  });

  await t('KT09', 'API và PostgreSQL · duyệt, báo cáo và gỡ tin đang giữ', async (note) => {
    const waiting = await f.createListing({ title: moderatedTitle });
    assert.equal(waiting.moderation, 'PENDING');
    await anon('/listings/' + waiting.id, 404);
    assert.ok(!(await anon('/listings?q=hangcam-mau', 200)).data.items.some(({ id }) => id === waiting.id));
    assert.ok((await admin.request('/admin/listings?moderation=PENDING', 200)).data.items.some(({ id }) => id === waiting.id));
    assert.equal((await admin.request('/admin/listings/' + waiting.id, 200,
      patch({ action: 'APPROVE', reason: 'Đã duyệt fixture' }))).data.moderation, 'APPROVED');
    await anon('/listings/' + waiting.id, 200);
    const target = await f.createListing({ title: 'Giáo trình cần gỡ KT09' });
    const item = await f.reserve(target);
    await f.change(item, minh, meeting());
    const report = await f.report(target);
    assert.equal(report.state, 'OPEN');
    const ignored = await f.report(waiting);
    assert.equal((await admin.request('/admin/reports/' + ignored.id, 200,
      patch({ action: 'DISMISS', reason: 'Mẫu đối chứng' }))).data.state, 'DISMISSED');
    assert.ok((await admin.request('/admin/reports?state=OPEN', 200)).data.items.some(({ id }) => id === report.id));
    const reason = 'Gỡ tin mẫu đang giữ KT09';
    const result = (await admin.request('/admin/reports/' + report.id, 200, patch({ action: 'REMOVE_LISTING', reason }))).data;
    assert.equal(result.state, 'ACTIONED');
    const stored = await db.inspect(target.id);
    assert.equal(stored.listing.moderation, 'REMOVED');
    assert.equal(stored.listing.state, 'AVAILABLE');
    assert.equal(stored.reservations[0].state, 'CANCELLED');
    await anon('/listings/' + target.id, 404);
    const relevant = ({ kind, resourceId }) => ['MODERATION', 'RESERVATION'].includes(kind)
      && [target.id, item.id].includes(resourceId);
    const [sellerNotifications, buyerNotifications] = await Promise.all([f.notifications(minh), f.notifications(lan)]);
    for (const items of [sellerNotifications, buyerNotifications]) {
      assert.ok(items.some((entry) => relevant(entry) && /hủy|gỡ/i.test(entry.text)), 'Thiếu thông báo hủy/gỡ cho một bên');
    }
    const audit = await db.query('SELECT * FROM moderation_logs WHERE "adminId" = $1 AND reason = $2', [admin.user.id, reason]);
    assert.ok(audit.some(({ targetId }) => [report.id, target.id].includes(targetId)));
    note('Tin chờ bị ẩn khỏi chợ; admin duyệt; DISMISS đối chứng; gỡ từ báo cáo chuyển ACTIONED, hủy lịch và trả 404; hai bên có thông báo; PostgreSQL giữ audit với người và lý do.');
  });

  await t('KT10', 'API và PostgreSQL · admin, khóa phiên, danh mục và thống kê', async (note) => {
    for (const route of ['/admin/reports', '/admin/listings', '/admin/users', '/admin/categories', '/admin/stats' + statsRange()]) {
      await lan.request(route, 403);
    }
    assert.ok((await admin.request('/admin/users', 200)).data.items.some(({ id }) => id === an.user.id));
    const independent = await f.login('an');
    const accountPath = '/admin/users/' + an.user.id;
    assert.equal((await admin.request(accountPath, 200, patch({ status: 'LOCKED', reason: 'Khóa thử KT10' }))).data.status, 'LOCKED');
    await independent.request('/me', 401);
    await an.request('/me', 401);
    assert.equal((await admin.request(accountPath, 200, patch({ status: 'ACTIVE', reason: 'Mở lại KT10' }))).data.status, 'ACTIVE');
    await independent.request('/me', 401);
    f.an = await f.login('an');
    const created = (await admin.request('/admin/categories', 201, post({ name: 'Danh mục thử KT10' }))).data;
    const renamed = 'Danh mục ngừng bán KT10';
    await admin.request('/admin/categories/' + created.id, 200, patch({ name: renamed }));
    const historical = await f.createListing({ categoryId: created.id, title: 'Giáo trình trong danh mục cũ' });
    await admin.request('/admin/categories/' + created.id, 200, patch({ active: false }));
    const all = (await admin.request('/admin/categories', 200)).data;
    assert.ok(all.some(({ id, name, active }) => id === created.id && name === renamed && active === false));
    assert.ok(!(await anon('/categories', 200)).data.some(({ id }) => id === created.id));
    assert.equal((await anon('/listings/' + historical.id, 200)).data.categoryId, created.id);
    await minh.request('/listings', 422, post(await f.listingBody(minh, { categoryId: created.id })));
    const stats = (await admin.request('/admin/stats' + statsRange(), 200)).data;
    const args = [stats.from, stats.to];
    const [counts] = await db.query(`SELECT
      (SELECT count(*)::int FROM listings WHERE "createdAt" >= $1 AND "createdAt" < $2) AS "listingCount",
      (SELECT count(*)::int FROM reservations WHERE state = 'COMPLETED' AND "completedAt" >= $1 AND "completedAt" < $2) AS "completedCount",
      (SELECT count(*)::int FROM users WHERE role = 'STUDENT' AND "lastActiveAt" >= $1 AND "lastActiveAt" < $2) AS "activeStudentCount"`, args);
    for (const [key, value] of Object.entries(counts)) assert.equal(stats[key], value, key);
    note('Lan nhận 403 trên toàn bộ nhóm admin; hai cookie An mất phiên sau khóa và sau mở; danh mục tạo/đổi tên/tắt làm mất tùy chọn mới, lịch sử còn; ba bộ đếm khớp câu SQL [from,to).');
  });
}

export async function restartCase(t, f, db, app, measurements) {
  await t('KT11', 'API, PostgreSQL và khởi động lại cả hai ứng dụng', async (note) => {
    const { listing, reservation, completedAt } = measurements.restart;
    const path = '/reservations/' + reservation.id;
    await f.anon(path, 401);
    await f.anon('/me/saved', 401);
    await f.an.request(path, 404);
    const another = await f.reserve(await f.createListing({ title: 'Giáo trình đối chiếu quyền KT11' }), f.an);
    await f.lan.request('/reservations/' + another.id, 404);
    const qrListing = await f.createListing({ title: 'Giáo trình QR khôi phục KT11' });
    const qr = await f.upload(f.minh, 'PAYMENT_QR');
    const qrItem = await f.reserve(qrListing);
    await f.change(qrItem, f.minh, { ...meeting(), paymentMethod: 'QR_MANUAL', qrAssetId: qr.id });
    const cover = assetPath(listing.images[0]);
    const qrPath = assetPath(qr);
    for (const attempt of [f.anon, f.an.request]) await attempt(qrPath, 404);
    for (const [request, route] of [[f.anon, cover], [f.lan.request, qrPath]]) {
      await assertImage((await request(route, 200)).data);
    }
    await app.stopApplications();
    await app.startApplications();
    assert.equal((await f.history(reservation, f.lan)).completedAt, completedAt);
    assert.equal((await db.inspect(listing.id)).listing.state, 'SOLD');
    await assertImage((await f.anon(cover, 200)).data);
    await assertImage((await f.lan.request(qrPath, 200)).data);
    await f.an.request(qrPath, 404);
    const web = await fetch(app.webOrigin + '/listings/' + listing.id, { signal: AbortSignal.timeout(6000) });
    assert.equal(web.status, 200);
    assert.match(await web.text(), /Giáo trình đổi lịch KT06/);
    note('Không phiên 401, ID người khác/QR khách hoặc An 404; restart NestJS và Next.js với đúng schema/upload, lịch COMPLETED, SOLD, cookie, ảnh bìa và QR còn, trang web trả 200.');
  });
}

export async function searchPerformance(t, f, db, seedCount) {
  await t('KT12', 'API · 20 lượt tìm kiếm trên dữ liệu seed và thông số máy', async (note) => {
    const path = '/listings?' + new URLSearchParams({ q: 'Giáo trình', schoolId: f.school.id, area: 'KTX A' });
    const [{ count }] = await db.query('SELECT count(*)::int AS count FROM listings');
    assert.equal(count, seedCount, 'Phép đo phải chạy trước khi tạo fixture bổ sung');
    const times = [];
    for (let i = 0; i < 20; i++) {
      const { data, ms } = await f.anon(path, 200);
      assert.ok(data.total >= 1 && data.items.length >= 1);
      times.push(ms);
    }
    const sorted = [...times].sort((a, b) => a - b);
    const p = (percentile) => sorted[Math.ceil(percentile * sorted.length) - 1].toFixed(2);
    note(`seed=${seedCount}; tin trong DB lúc đo=${count}; ${platform()} ${release()}, ${cpus()[0]?.model ?? 'CPU không xác định'} (${availableParallelism()} luồng khả dụng), ${Math.round(totalmem() / 1024 ** 3)} GiB RAM, Node ${process.version}; 20 lượt cùng truy vấn và dữ liệu`);
    note(`ms=[${times.map((x) => x.toFixed(2)).join(', ')}]; p50=${p(0.5)} ms; p95=${p(0.95)} ms (hạng gần nhất)`);
  });
}
