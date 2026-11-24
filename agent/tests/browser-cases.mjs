import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { assertImage, emailOf, meeting, password, px, verificationLink } from './http.mjs';
import { assetPath } from './api-cases.mjs';

const book = 'Giáo trình Giải tích 1';
const discussion = '60.000 đ ở sảnh A1 được không?';
const pricePattern = /65[.\s]000\s*đ/;
const denied = /Trang này không còn hiển thị/;
const reservationLabels = {
  ACCEPTED: 'Đang giữ', REJECTED: 'Đã bị từ chối', CANCELLED: 'Đã hủy', COMPLETED: 'Đã hoàn tất',
};
const notFound = (page) => expect(page.getByRole('heading', { name: denied })).toBeVisible();
const button = (page, name) => page.getByRole('button', { name, exact: true });
const link = (page, name) => page.getByRole('link', { name, exact: true });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });
const title = (page, name) => expect(heading(page, name)).toBeVisible();
const text = (page, value) => expect(page.getByText(value, { exact: true })).toBeVisible();
const dateAtVietnam = (offsetHours = 0) => new Date(Date.now() + (7 + offsetHours) * 3_600_000).toISOString();
const imageFile = { name: 'anh.png', mimeType: 'image/png', buffer: px };
const reservationUrl = (item) => '/reservations/' + item.id;
const listingUrl = (item) => '/listings/' + item.id;

function observe(page, method, path) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === new URL(page.url()).origin
      && url.pathname === '/api/v1' + path
      && response.request().method() === method;
  });
}

// HTML do server render trước, listener chỉ có sau khi React hydrate. Thao tác (bấm nút,
// chọn file, gõ) khi chưa hydrate sẽ submit form native hoặc mất state, nên chờ React gắn
// props vào DOM. Trang mở với javaScriptEnabled: false (ca KT12) không bao giờ hydrate.
const noHydration = new Set();

function waitHydrated(page) {
  return page.waitForFunction(() => [...document.querySelectorAll('form,button,input,select,a')]
    .some((element) => Object.keys(element).some((key) => key.startsWith('__reactProps$'))),
  null, { timeout: 15000 });
}

async function mutate(page, method, path, action, status) {
  await waitHydrated(page);
  const [response] = await Promise.all([observe(page, method, path), action()]);
  assert.equal(response.status(), status, method + ' ' + path);
  return response;
}

async function signIn(page, goto, actor, { email = emailOf(actor), status = 200 } = {}) {
  await goto(page, '/login?returnTo=%2Fme');
  await page.getByLabel('Email trường').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await mutate(page, 'POST', '/auth/login', () => button(page, 'Đăng nhập').click(), status);
  if (status === 200) await title(page, 'Cá nhân');
  else await expect(page.getByRole('alert').filter({ hasText: /chưa xác thực/i })).toBeVisible();
}

async function publish(page, goto, f, name = book) {
  await goto(page, '/sell');
  await page.getByLabel('Ảnh tin đăng').setInputFiles(imageFile);
  await page.getByLabel('Tên món').fill(name);
  await page.getByLabel('Giá (VND)').fill('65000');
  await page.getByLabel('Tình trạng').selectOption('GOOD');
  await page.getByLabel('Danh mục').selectOption(f.category.id);
  await page.getByLabel('Trường').selectOption(f.school.id);
  await page.getByLabel('Khu vực').fill('KTX A');
  await page.getByLabel('Mô tả').fill('Giáo trình còn tốt, dùng cho kịch bản demo.');
  const response = await mutate(page, 'POST', '/listings', () => button(page, 'Đăng tin').click(), 201);
  const listing = await response.json();
  await expect(page).toHaveURL(new RegExp(listingUrl(listing) + '$'));
  await title(page, name);
  return listing;
}

async function findBook(page, goto, f, name = 'Giải tích') {
  await goto(page, '/');
  await page.getByRole('searchbox', { name: 'Tìm món đồ' }).or(page.getByRole('textbox', { name: 'Tìm món đồ' })).fill(name);
  await button(page, 'Tìm').click();
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === name);
  await page.getByLabel('Trường').selectOption(f.school.id);
  await page.getByLabel('Khu vực').fill('KTX A');
  await page.getByLabel('Tình trạng').selectOption('GOOD');
  await page.getByLabel('Giá tối thiểu').fill('50000');
  await page.getByLabel('Giá tối đa').fill('70000');
  await button(page, 'Áp dụng bộ lọc').click();
  await expect(page).toHaveURL((url) => url.searchParams.get('maxPrice') === '70000');
}

async function openConversation(page, goto, listing) {
  await goto(page, listingUrl(listing));
  const response = await mutate(page, 'POST', '/conversations', () => button(page, 'Nhắn tin').click(), 200);
  const room = await response.json();
  await expect(page).toHaveURL(new RegExp('/inbox/' + room.id + '$'));
  return room;
}

async function reserve(page, goto, listing) {
  await goto(page, listingUrl(listing));
  const response = await mutate(page, 'POST', '/reservations', () => button(page, 'Giữ món').click(), 200);
  const item = await response.json();
  assert.equal(item.state, 'PENDING');
  assert.equal(item.listingId, listing.id);
  await expect(page).toHaveURL(new RegExp(reservationUrl(item) + '$'));
  return item;
}

async function setMeeting(page, place = 'Sảnh A1', method = 'COD') {
  await page.getByLabel('Giá chốt (VND)').fill('60000');
  await page.getByLabel('Ngày và giờ hẹn (giờ Việt Nam)').fill(dateAtVietnam(2).slice(0, 16));
  await page.getByLabel('Điểm hẹn').fill(place);
  await page.getByLabel('Phương thức thanh toán').selectOption(method);
  if (method === 'QR_MANUAL') await page.getByLabel('Ảnh QR thanh toán').setInputFiles(imageFile);
}

async function change(page, item, label, expectedState, status = 200) {
  const confirm = async () => {
    await button(page, label).click();
    if (label === 'Đã nhận món') await button(page, 'Xác nhận đã nhận').click();
  };
  const response = await mutate(page, 'PATCH', reservationUrl(item), confirm, status);
  const result = await response.json();
  if (status === 200) assert.equal(result.state, expectedState);
  else assert.equal(result.code, 'STATE_CONFLICT');
  await text(page, reservationLabels[expectedState]);
  return result;
}

export async function browserCases(t, f, db, config, app, google) {
  const browser = await chromium.launch({ headless: true, timeout: 15000 });
  const contexts = new Map();
  const usedPages = new Set();
  const traces = new Set();
  const goto = async (page, path) => {
    usedPages.add(page);
    const response = await page.goto(app.webOrigin + path, { waitUntil: 'domcontentloaded' });
    if (!noHydration.has(page)) await waitHydrated(page);
    return response;
  };
  async function makePage(name, options) {
    const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', ...options });
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(15000);
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    if (options?.javaScriptEnabled === false) noHydration.add(page);
    contexts.set(name, { context, page });
    return page;
  }

  async function test(id, description, callback) {
    await t(id, 'Trình duyệt · ' + description, async (note) => {
      usedPages.clear();
      try {
        await callback(note);
      } catch (error) {
        for (const [name, { context, page }] of contexts) {
          if (!usedPages.has(page)) continue;
          const file = join(app.evidence, id + '-' + name + '.png');
          if (await page.screenshot({ path: file, timeout: 1000 }).catch(() => null)) note('Ảnh lỗi: ' + file);
          if (traces.has(name)) continue;
          const trace = join(app.evidence, id + '-' + name + '.zip');
          await context.tracing.stop({ path: trace });
          traces.add(name);
          note('Trace Chromium: ' + trace);
        }
        throw error;
      }
    });
  }

  try {
    const [minh, lan, an, admin, guest, newcomer, oauth] = await Promise.all(
      ['minh', 'lan', 'an', 'admin', 'khach', 'tai-khoan-moi', 'google'].map((name) => makePage(name)));
    await test('KT01', 'mở web, SMTP qua UI, hồ sơ và Google giả lập', async (note) => {
      const response = await goto(guest, '/');
      assert.equal(response.status(), 200);
      await title(guest, 'Chợ đồ cũ sinh viên');
      const email = 'browser-' + randomUUID() + '@student.example.test';
      await goto(newcomer, '/register');
      await newcomer.getByLabel('Tên hiển thị').fill('Sinh viên thử qua trình duyệt');
      await newcomer.getByLabel('Email trường').fill(email);
      await newcomer.getByLabel('Mật khẩu').fill(password);
      await mutate(newcomer, 'POST', '/auth/register', () => button(newcomer, 'Đăng ký').click(), 202);
      await expect(newcomer.getByText(/Hãy mở thư xác thực gửi đến/)).toBeVisible();
      await signIn(newcomer, goto, '', { email, status: 403 });
      const { pathname, search } = await verificationLink(config.mailpit, email, app.webOrigin);
      await goto(newcomer, pathname + search);
      await mutate(newcomer, 'POST', '/auth/verify', () => button(newcomer, 'Xác thực email').click(), 200);
      await text(newcomer, 'Email đã được xác thực.');
      await signIn(newcomer, goto, '', { email });
      const privateContact = 'Liên lạc riêng của sinh viên KT01';
      await newcomer.getByLabel('Tên hiển thị').fill('Sinh viên đã xác thực KT01');
      await newcomer.getByLabel('Thông tin liên hệ').fill(privateContact);
      await mutate(newcomer, 'PATCH', '/me', () => button(newcomer, 'Lưu hồ sơ').click(), 200);
      await text(newcomer, 'Đã cập nhật hồ sơ.');
      const profileUrl = await link(newcomer, 'Xem hồ sơ công khai').getAttribute('href');
      assert.match(profileUrl, /^\/users\//);
      await goto(guest, profileUrl);
      await title(guest, 'Sinh viên đã xác thực KT01');
      await expect(guest.getByText(privateContact, { exact: true })).toHaveCount(0);

      google.use('google-browser-' + randomUUID() + '@student.example.test', true);
      await goto(oauth, '/login?returnTo=%2Fme');
      await link(oauth, 'Tiếp tục với Google').click();
      await text(oauth, 'Đã đăng nhập bằng Google.');
      await button(oauth, 'Tiếp tục').click();
      await title(oauth, 'Cá nhân');
      note('Chromium headless mở web 200, đăng ký UI nhận SMTP, đăng nhập trước link 403, xác minh và sửa hồ sơ được, cookie Google giả lập vào trang cá nhân. Google thật chưa chạy.');
    });

    let demoListing;
    await test('KT02', 'demo bước 1, Minh đăng ảnh và ẩn/hiện, Lan không sửa được', async (note) => {
      await Promise.all([
        signIn(minh, goto, 'minh'),
        signIn(lan, goto, 'lan'),
        signIn(an, goto, 'an'),
        signIn(admin, goto, 'admin'),
      ]);
      demoListing = await publish(minh, goto, f);
      assert.equal(demoListing.price, 65000);
      assert.equal(demoListing.images.length, 1);
      const response = await goto(lan, listingUrl(demoListing));
      assert.equal(response.status(), 200);
      await title(lan, book);
      await expect(lan.getByText(pricePattern)).toBeVisible();
      const cover = lan.getByRole('img', { name: book });
      await expect(cover).toBeVisible();
      await expect.poll(() => cover.evaluate((image) => image.naturalWidth)).toBe(4);
      await goto(lan, listingUrl(demoListing) + '/edit');
      await title(lan, 'Bạn không có quyền sửa tin này');
      await mutate(minh, 'PATCH', listingUrl(demoListing) + '/state', () => button(minh, 'Ẩn tin').click(), 200);
      await expect(button(minh, 'Hiện lại tin')).toBeVisible();
      assert.equal((await goto(guest, listingUrl(demoListing))).status(), 404);
      await notFound(guest);
      await mutate(minh, 'PATCH', listingUrl(demoListing) + '/state', () => button(minh, 'Hiện lại tin').click(), 200);
      await expect(button(minh, 'Ẩn tin')).toBeVisible();
      await goto(guest, '/?q=' + encodeURIComponent(book));
      await expect(guest.locator('a[href="' + listingUrl(demoListing) + '"]')).toBeVisible();
      note('Demo 1. Minh đăng sách thật qua biểu mẫu có ảnh đọc được, giá 65.000 đ; Lan bị chặn vào trang sửa; khách nhận 404 khi ẩn và tìm thấy sau khi hiện.');
    });

    await test('KT03', 'lọc kết hợp, kết quả rỗng, lỗi khoảng giá và hồ sơ rỗng', async (note) => {
      const target = await f.createListing({ title: 'Giải tích không có đánh giá KT03' }, f.an);
      await findBook(guest, goto, f, 'Giải tích không có đánh giá KT03');
      await guest.locator('a[href="' + listingUrl(target) + '"]').click();
      await title(guest, target.title);
      await guest.locator('a[href="/users/' + target.seller.id + '"]').click();
      await expect(guest.getByText('Chưa có đánh giá', { exact: true }).first()).toBeVisible();
      await findBook(guest, goto, f, target.title);
      await guest.getByLabel('Khu vực').fill('KTX không tồn tại');
      await button(guest, 'Áp dụng bộ lọc').click();
      await title(guest, 'Không tìm thấy món phù hợp');
      await guest.getByLabel('Giá tối đa').fill('40000');
      await button(guest, 'Áp dụng bộ lọc').click();
      await expect(guest.getByRole('alert').first()).toContainText(/giá/i);
      note('Kết hợp từ khóa, trường, KTX, tình trạng và giá trả đúng fixture; hồ sơ rỗng; khu vực lạ trả trạng thái rỗng và khoảng giá đảo chiều báo lỗi.');
    });

    await test('KT04', 'demo bước 2, hội thoại nhận tin qua polling và từ chối An', async (note) => {
      await findBook(lan, goto, f);
      await lan.locator('a[href="' + listingUrl(demoListing) + '"]').click();
      await expect(lan).toHaveURL(new RegExp(listingUrl(demoListing) + '$'));
      await expect(lan.getByRole('heading', { name: book, level: 1 })).toBeVisible();
      const room = await openConversation(lan, goto, demoListing);
      await goto(minh, '/inbox/' + room.id);
      await title(minh, f.lan.user.displayName);
      await text(minh, 'Chưa có tin nhắn trong hội thoại.');
      await lan.getByLabel('Tin nhắn', { exact: true }).fill(discussion);
      await mutate(lan, 'POST', '/conversations/' + room.id + '/messages',
        () => button(lan, 'Gửi tin nhắn').click(), 201);
      await expect(minh.getByText(discussion, { exact: true })).toBeVisible({ timeout: 9000 });
      await minh.reload({ waitUntil: 'domcontentloaded' });
      await text(minh, discussion);
      assert.equal((await goto(an, '/inbox/' + room.id)).status(), 404);
      await notFound(an);
      note('Demo 2. Lan lọc sách và gửi lời hẹn 60.000 đ; trình duyệt Minh thấy tin qua polling trên trang đang mở và sau reload; trình duyệt An mở URL riêng nhận 404.');
    });

    let demoReservation;
    await test('KT05', 'demo bước 2–3, giữ cạnh tranh và refresh sau HTTP 409', async (note) => {
      demoReservation = await reserve(lan, goto, demoListing);
      const competition = await reserve(an, goto, demoListing);
      const stale = await makePage('minh-phien-cu');
      await signIn(stale, goto, 'minh');
      await goto(stale, reservationUrl(competition));
      await setMeeting(stale);
      await goto(minh, reservationUrl(demoReservation));
      await setMeeting(minh);
      const accepted = await change(minh, demoReservation, 'Xác nhận giữ', 'ACCEPTED');
      assert.equal(accepted.finalPrice, 60000);
      assert.equal(accepted.meetingPlace, 'Sảnh A1');
      assert.equal(accepted.paymentMethod, 'COD');
      await change(stale, competition, 'Xác nhận giữ', 'REJECTED', 409);
      await expect(button(stale, 'Xác nhận giữ')).toHaveCount(0);
      await an.reload({ waitUntil: 'domcontentloaded' });
      await text(an, reservationLabels.REJECTED);
      note('Demo 2–3. Hai context mua có hai ID; Minh chốt Lan 60.000 đ tại sảnh A1 COD. Phiên Minh đang mở yêu cầu An nhận 409 STATE_CONFLICT, tự tải trạng thái đã từ chối và bỏ form; An tải lại thấy từ chối.');
    });

    await test('KT06', 'demo bước 4, giao nhận COD và đổi lịch qua UI', async (note) => {
      assert.ok(demoReservation);
      assert.ok((await f.history(demoReservation, f.lan)).meetingAt);
      await goto(lan, reservationUrl(demoReservation));
      await expect(lan.getByText(/60[.\s]000\s*đ/).first()).toBeVisible();
      const completed = await change(lan, demoReservation, 'Đã nhận món', 'COMPLETED');
      assert.ok(completed.completedAt);
      await goto(guest, listingUrl(demoListing));
      await text(guest, 'Đã bán');

      const other = await f.createListing({ title: 'Đổi lịch trình duyệt KT06' });
      const old = await reserve(lan, goto, other);
      await goto(minh, reservationUrl(old));
      await setMeeting(minh, 'Hẹn cũ A1');
      await change(minh, old, 'Xác nhận giữ', 'ACCEPTED');
      await change(minh, old, 'Hủy hẹn', 'CANCELLED');
      await goto(lan, reservationUrl(old));
      await text(lan, 'Hẹn cũ A1');
      const next = await reserve(lan, goto, other);
      assert.notEqual(next.id, old.id);
      await goto(minh, reservationUrl(next));
      await setMeeting(minh, 'Hẹn mới A2');
      await change(minh, next, 'Xác nhận giữ', 'ACCEPTED');
      await goto(lan, reservationUrl(next));
      await text(lan, 'Hẹn mới A2');
      note('Demo 4. Lan xác nhận đã nhận sách, backend ghi completedAt, khách thấy đã bán. Ca riêng hủy vẫn đọc hẹn cũ; tạo ID khác và xem hẹn mới.');
    });

    await test('KT06b', 'QR hiển thị đúng phiên và biến mất khỏi lịch đã hủy', async (note) => {
      const listing = await f.createListing({ title: 'QR qua trình duyệt KT06b' });
      const item = await reserve(lan, goto, listing);
      await goto(minh, reservationUrl(item));
      await setMeeting(minh, 'Sảnh nhận QR', 'QR_MANUAL');
      const accepted = await change(minh, item, 'Xác nhận giữ', 'ACCEPTED');
      assert.ok(accepted.qrAsset);
      const qrUrl = '/api/v1' + assetPath(accepted.qrAsset);
      await goto(lan, reservationUrl(item));
      const image = lan.getByRole('img', { name: 'Ảnh QR thanh toán' });
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute('src', qrUrl);
      await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBe(4);
      const member = await lan.request.get(app.webOrigin + qrUrl);
      assert.equal(member.status(), 200);
      await assertImage(await member.body());
      const outsider = await an.request.get(app.webOrigin + qrUrl);
      assert.equal(outsider.status(), 404);
      await change(minh, item, 'Hủy hẹn', 'CANCELLED');
      await lan.reload({ waitUntil: 'domcontentloaded' });
      await text(lan, 'Sảnh nhận QR');
      await expect(image).toHaveCount(0);
      await expect(minh.getByRole('img', { name: 'Ảnh QR thanh toán' })).toHaveCount(0);
      const expired = await lan.request.get(app.webOrigin + qrUrl);
      assert.equal(expired.status(), 404);
      note('QR từ biểu mẫu Minh tải được ở trình duyệt Lan với đúng ảnh 4×4. An nhận 404. Sau hủy, ảnh mất trong cả hai phiên, URL cũ trả 404, địa điểm vẫn còn.');
    });

    await test('KT06d', 'mở giao dịch đúng người từ hộp thư, lịch sử và trạng thái rỗng', async (note) => {
      const listing = await f.createListing({ title: 'Đối chiếu hội thoại KT06d' });
      const first = await reserve(lan, goto, listing);
      const lanRoom = await openConversation(lan, goto, listing);
      const anRoom = await openConversation(an, goto, listing);
      await button(an, 'Mở giao dịch').click();
      await text(an, 'Chưa có yêu cầu giữ.');
      await button(lan, 'Mở giao dịch').click();
      await expect(lan).toHaveURL(new RegExp(reservationUrl(first) + '$'));
      await change(lan, first, 'Rút yêu cầu', 'CANCELLED');
      await goto(lan, '/inbox/' + lanRoom.id);
      await button(lan, 'Mở giao dịch').click();
      await expect(lan).toHaveURL((url) => url.pathname === '/me/reservations'
        && url.searchParams.get('conversationId') === lanRoom.id);
      const rival = await reserve(an, goto, listing);
      const again = await reserve(lan, goto, listing);
      assert.notEqual(rival.id, again.id);
      await goto(lan, '/inbox/' + lanRoom.id);
      await button(lan, 'Mở giao dịch').click();
      await expect(lan).toHaveURL(new RegExp(reservationUrl(again) + '$'));
      assert.equal((await goto(lan, '/inbox/' + anRoom.id)).status(), 404);
      await notFound(lan);
      note('Lan giữ trước chat; hộp thư mở đúng ID đang giữ, mở danh sách đã lọc khi còn lịch sử, sau đó mở ID mới đúng Lan dù An cũng giữ; An thấy rỗng trước khi giữ và URL riêng trả 404.');
    });

    await browserSecondary({ test, f, db, app, goto, minh, lan, an, admin, guest, makePage, demoListing, demoReservation });
  } finally {
    await browser.close();
  }
}

async function browserSecondary({ test, f, db, app, goto, minh, lan, an, admin, guest, makePage, demoListing, demoReservation }) {
  await test('KT07', 'lưu và theo dõi, tác giả đăng tin mới, thông báo đổi trạng thái đọc', async (note) => {
    const listing = await f.createListing({ title: 'Tin để lưu qua trình duyệt KT07' });
    await goto(lan, listingUrl(listing));
    const under = '/me/favorites/' + listing.id;
    await mutate(lan, 'PUT', under, () => button(lan, 'Lưu tin').click(), 204);
    await goto(lan, '/me/saved');
    await heading(lan, listing.title).waitFor();
    await lan.reload({ waitUntil: 'domcontentloaded' });
    await title(lan, listing.title);
    await goto(lan, listingUrl(listing));
    await mutate(lan, 'DELETE', under, () => button(lan, 'Bỏ lưu tin').click(), 204);
    await goto(lan, '/me/saved');
    await expect(heading(lan, listing.title)).toHaveCount(0);
    await goto(lan, '/users/' + f.minh.user.id);
    await mutate(lan, 'PUT', '/me/seller-follows/' + f.minh.user.id,
      () => button(lan, 'Theo dõi người bán').click(), 204);
    await goto(lan, '/?categoryId=' + f.category.id);
    await mutate(lan, 'PUT', '/me/category-follows/' + f.category.id,
      () => button(lan, 'Theo dõi danh mục').click(), 204);
    const newest = await publish(minh, goto, f, 'Sách mới từ nguồn theo dõi KT07');
    const matching = async () => (await f.notifications(f.lan))
      .filter(({ kind, resourceId }) => kind === 'NEW_LISTING' && resourceId === newest.id);
    const [notification] = await matching();
    assert.ok(notification);
    assert.equal((await matching()).length, 1);
    await link(minh, 'Sửa tin').click();
    await minh.getByLabel('Giá (VND)').fill('64000');
    await mutate(minh, 'PUT', listingUrl(newest), () => button(minh, 'Lưu thay đổi').click(), 200);
    assert.deepEqual((await matching()).map(({ id }) => id), [notification.id]);

    await goto(lan, '/notifications');
    await title(lan, 'Thông báo');
    const rows = lan.getByRole('article').filter({ has: button(lan, notification.text) });
    const row = rows.first();
    await mutate(lan, 'PUT', '/notifications/' + notification.id + '/read',
      () => button(row, 'Đánh dấu đã đọc').click(), 200);
    await lan.reload({ waitUntil: 'domcontentloaded' });
    const readRow = lan.getByRole('article').filter({ has: lan.locator('a[href="' + listingUrl(newest) + '"]') });
    await text(readRow, 'Đã đọc');
    assert.ok((await matching())[0].readAt);
    await readRow.getByRole('link').click();
    await title(lan, newest.title);
    note('Lưu/bỏ lưu có hiệu lực qua reload. Theo dõi cả Minh và Giáo trình; Minh đăng rồi sửa giá, chỉ có một thông báo. Lan đánh dấu đã đọc và mở đúng tin qua thông báo sau tải lại.');
  });

  await test('KT08', 'demo bước 4, hai phiên đánh giá độc lập sau reload và xem uy tín', async (note) => {
    const reviewPath = reservationUrl(demoReservation) + '/reviews';
    const beforeMinh = (await f.anon('/users/' + f.minh.user.id, 200)).data;
    const beforeLan = (await f.anon('/users/' + f.lan.user.id, 200)).data;
    await Promise.all([goto(lan, reservationUrl(demoReservation)), goto(minh, reservationUrl(demoReservation))]);

    async function review(page, score, comment) {
      await page.getByLabel('Số sao').selectOption(String(score));
      await page.getByLabel('Nhận xét').fill(comment);
      const response = await mutate(page, 'POST', reviewPath, () => button(page, 'Gửi đánh giá').click(), 201);
      await text(page, 'Đã đánh giá');
      return response.json();
    }

    const buyerReview = 'Sách tốt, nhận ở sảnh A1.';
    assert.equal((await review(lan, 5, buyerReview)).targetId, f.minh.user.id);
    await Promise.all([lan.reload({ waitUntil: 'domcontentloaded' }), minh.reload({ waitUntil: 'domcontentloaded' })]);
    await text(lan, 'Đã đánh giá');
    await expect(button(lan, 'Gửi đánh giá')).toHaveCount(0);
    await expect(button(minh, 'Gửi đánh giá')).toBeVisible();
    assert.equal((await review(minh, 4, 'Nhận đúng hẹn.')).targetId, f.lan.user.id);
    const afterMinh = (await f.anon('/users/' + f.minh.user.id, 200)).data;
    const afterLan = (await f.anon('/users/' + f.lan.user.id, 200)).data;
    assert.equal(afterMinh.reviewCount, beforeMinh.reviewCount + 1);
    assert.equal(afterLan.reviewCount, beforeLan.reviewCount + 1);
    await goto(guest, listingUrl(demoListing));
    await text(guest, 'Đã bán');
    await link(guest, f.minh.user.displayName).click();
    await title(guest, f.minh.user.displayName);
    await text(guest, buyerReview);
    await expect(guest.getByText('(' + afterMinh.reviewCount + ' đánh giá)', { exact: true }).first()).toBeVisible();
    note('Demo 4. Lan gửi 5 sao, tải lại thấy đã đánh giá trong khi Minh vẫn có form; Minh gửi 4 sao. Khách mở lại tin đã bán và xem nhận xét mới, số lượt và điểm trên hồ sơ Minh.');
  });

  await test('KT09', 'demo bước 5, admin duyệt tin chờ và gỡ tin đang hẹn qua báo cáo', async (note) => {
    const flagged = await publish(minh, goto, f, 'Sách hangcam-mau trình duyệt KT09');
    assert.equal(flagged.moderation, 'PENDING');
    assert.equal((await goto(guest, listingUrl(flagged))).status(), 404);
    await notFound(guest);
    await goto(admin, '/admin/listings?moderation=PENDING');
    await title(admin, 'Tin đăng');
    const flaggedRow = admin.getByRole('article').filter({ hasText: flagged.title });
    await flaggedRow.getByLabel('Lý do xử lý').fill('Duyệt fixture đang chờ');
    const approved = await mutate(admin, 'PATCH', '/admin' + listingUrl(flagged),
      () => button(flaggedRow, 'Duyệt tin').click(), 200);
    assert.equal((await approved.json()).moderation, 'APPROVED');
    assert.equal((await goto(guest, listingUrl(flagged))).status(), 200);

    const target = await f.createListing({ title: 'Tin đang hẹn cho kịch bản admin KT09' });
    const item = await f.reserve(target);
    await f.change(item, f.minh, meeting());
    await goto(lan, listingUrl(target));
    await button(lan, 'Báo cáo tin').click();
    await lan.getByLabel('Lý do báo cáo').selectOption('SPAM');
    const details = 'Cần xử lý trong bước 5 KT09';
    await lan.getByLabel('Chi tiết báo cáo').fill(details);
    const filed = await mutate(lan, 'POST', '/reports', () => button(lan, 'Gửi báo cáo').click(), 201);
    const report = await filed.json();
    assert.equal(report.state, 'OPEN');
    await goto(admin, '/admin/reports');
    await title(admin, 'Báo cáo');
    const row = admin.getByRole('article').filter({ hasText: target.title });
    const reason = 'Gỡ tin đang hẹn trong demo KT09';
    await row.getByLabel('Lý do xử lý').fill(reason);
    const removed = await mutate(admin, 'PATCH', '/admin/reports/' + report.id, () => button(row, 'Gỡ tin').click(), 200);
    assert.equal((await removed.json()).state, 'ACTIONED');
    await goto(admin, '/admin/reports?state=ACTIONED');
    await expect(admin.getByRole('article').filter({ hasText: details })).toContainText('Đã xử lý');
    assert.equal((await goto(guest, listingUrl(target))).status(), 404);
    await notFound(guest);
    await Promise.all([goto(lan, reservationUrl(item)), goto(minh, reservationUrl(item))]);
    await Promise.all([text(lan, 'Đã hủy'), text(minh, 'Đã hủy')]);
    for (const [page, actor] of [[minh, f.minh], [lan, f.lan]]) {
      const notice = (await f.notifications(actor)).find(({ resourceId, kind, text }) =>
        resourceId === target.id && kind === 'MODERATION' && /gỡ/.test(text));
      assert.ok(notice, 'Phiên người mua hoặc người bán thiếu thông báo gỡ');
      await goto(page, '/notifications');
      await expect(page.getByText(notice.text, { exact: true }).first()).toBeVisible();
    }
    const audit = await db.query('SELECT "adminId" FROM moderation_logs WHERE reason = $1', [reason]);
    assert.ok(audit.some(({ adminId }) => adminId === f.admin.user.id));
    note('Demo 5. Admin duyệt tin gắn cờ; Lan báo cáo một tin đang hẹn, admin gỡ có lý do. Báo cáo đã xử lý, khách 404, lịch cả hai bên đã hủy, thông báo hiện trong hai context và DB lưu nhật ký.');
  });

  await test('KT10', 'demo bước 5, đường admin, khóa/mở tài khoản, danh mục và thống kê', async (note) => {
    await goto(lan, '/admin');
    await expect(lan.getByRole('heading', { name: /không có quyền|dành cho quản trị/i })).toBeVisible();
    await expect(button(lan, 'Xem thống kê')).toHaveCount(0);

    await goto(admin, '/admin/users');
    await title(admin, 'Tài khoản');
    const anEmail = emailOf('an');
    await admin.getByLabel('Tên hoặc email').fill(anEmail);
    await button(admin, 'Tìm tài khoản').click();
    await expect(admin).toHaveURL((url) => url.searchParams.get('q') === anEmail);
    const account = admin.getByRole('article').filter({ has: heading(admin, f.an.user.displayName) });
    await account.getByLabel('Lý do xử lý').fill('Khóa An trong lượt trình duyệt');
    await mutate(admin, 'PATCH', '/admin/users/' + f.an.user.id,
      () => button(account, 'Khóa tài khoản').click(), 200);
    await goto(an, '/me');
    await expect(an).toHaveURL((url) => url.pathname === '/login');
    await expect(button(account, 'Mở khóa tài khoản')).toBeVisible();
    await account.getByLabel('Lý do xử lý').fill('Mở An sau lượt trình duyệt');
    await mutate(admin, 'PATCH', '/admin/users/' + f.an.user.id,
      () => button(account, 'Mở khóa tài khoản').click(), 200);
    await goto(an, '/me');
    await expect(an).toHaveURL((url) => url.pathname === '/login');
    await signIn(an, goto, 'an');

    const name = 'Danh mục lưu lịch sử qua trình duyệt KT10';
    await goto(admin, '/admin/categories');
    await title(admin, 'Danh mục');
    const create = admin.locator('form').filter({ has: button(admin, 'Tạo danh mục') });
    await create.getByLabel('Tên danh mục').fill(name);
    const response = await mutate(admin, 'POST', '/admin/categories', () => button(admin, 'Tạo danh mục').click(), 201);
    const category = await response.json();
    const historical = await f.createListing({ categoryId: category.id, title: 'Tin trong danh mục cũ KT10' });
    const categoryRow = admin.getByRole('article').filter({ has: heading(admin, name) });
    await mutate(admin, 'PATCH', '/admin/categories/' + category.id,
      () => button(categoryRow, 'Ngừng sử dụng').click(), 200);
    await goto(minh, '/sell');
    await expect(minh.getByLabel('Danh mục').locator('option[value="' + category.id + '"]')).toHaveCount(0);
    assert.equal((await goto(guest, listingUrl(historical))).status(), 200);
    await text(guest, name);

    await goto(admin, '/admin');
    await title(admin, 'Quản trị');
    const dateFrom = dateAtVietnam(-24).slice(0, 10);
    const dateTo = dateAtVietnam(24).slice(0, 10);
    const from = new Date(dateFrom + 'T00:00:00+07:00');
    const to = new Date(new Date(dateTo + 'T00:00:00+07:00').getTime() + 86_400_000);
    await admin.getByLabel('Từ ngày').fill(dateFrom);
    await admin.getByLabel('Đến ngày').fill(dateTo);
    await button(admin, 'Xem thống kê').click();
    await expect(admin).toHaveURL((url) => url.searchParams.get('from') === dateFrom
      && url.searchParams.get('to') === dateTo);
    const selected = await f.admin.request('/admin/stats?' + new URLSearchParams({
      from: from.toISOString(), to: to.toISOString(),
    }), 200);
    const { completedCount } = selected.data;
    assert.ok(completedCount > 0);
    const stats = admin.getByRole('article').filter({ has: heading(admin, 'Giao dịch hoàn tất') });
    await text(stats, completedCount.toLocaleString('vi-VN'));
    note('Demo 5. Lan bị từ chối trang admin. Khóa/mở An làm cookie cũ mất hiệu lực, đăng nhập lại được. Danh mục tắt vẫn đọc tên trên tin cũ, mất lựa chọn trên form mới. Số giao dịch hoàn tất trên UI khớp API cùng kỳ demo.');
  });

  await test('KT12', 'HTML có tiêu đề và giá, không tràn ngang, dùng được bàn phím', async (note) => {
    assert.ok(demoListing);
    const pathname = listingUrl(demoListing);
    const response = await fetch(app.webOrigin + pathname, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<title>Giáo trình Giải tích 1[^<]*<\/title>/);
    assert.match(html, pricePattern);

    const [mobile, desktop, noScripts] = await Promise.all([
      makePage('360px', { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true }),
      makePage('desktop', { viewport: { width: 1366, height: 900 } }),
      makePage('ssr', { javaScriptEnabled: false }),
    ]);
    await goto(noScripts, pathname);
    await title(noScripts, book);
    await expect(noScripts.getByText(pricePattern)).toBeVisible();

    for (const [page, width] of [[mobile, 360], [desktop, 1366]]) {
      assert.equal((await goto(page, pathname)).status(), 200);
      await title(page, book);
      const viewport = await page.evaluate(() => ({
        width: innerWidth, scroll: document.documentElement.scrollWidth,
      }));
      assert.equal(viewport.width, width);
      assert.ok(viewport.scroll <= viewport.width, 'Trang rộng hơn ' + width + ' px: ' + viewport.scroll);
      let focused = false;
      for (let step = 0; step < 30; step++) {
        await page.keyboard.press('Tab');
        focused = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Về chợ');
        if (focused) break;
      }
      assert.ok(focused, 'Tab không tới được liên kết Về chợ ở ' + width + ' px');
      await page.keyboard.press('Enter');
      await title(page, 'Chợ đồ cũ sinh viên');
    }
    note('Phản hồi HTTP HTML có <title> và giá. Context tắt JavaScript vẫn đọc đủ tên/giá. Context 360 px và 1366 px không tràn ngang, dùng Tab và Enter về chợ.');
  });
}
