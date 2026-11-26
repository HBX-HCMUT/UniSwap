import { argon2id, hash } from 'argon2';
import { AssetPurpose, ListingCondition, PrismaClient, Role } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { storeImage } from '../../src/modules/listings/asset-storage';

const prisma = new PrismaClient();
const demoPassword = 'UniSwapDemo123!';
const demoListings = [
  {
    key: '01', assetKey: '02', title: 'Đèn bàn học mẫu',
    description: 'Tin minh họa dùng để thực hành xử lý báo cáo trong buổi demo.',
    price: 45000, condition: ListingCondition.GOOD, category: 1, seller: 0, media: 'lamp', reserved: true,
  },
  {
    key: '03', assetKey: '04', title: 'Giáo trình đại số',
    description: 'Giáo trình dùng cho năm nhất, có ghi chú nhẹ bằng bút chì.',
    price: 55000, condition: ListingCondition.GOOD, category: 0, seller: 0, media: 'book',
  },
  {
    key: '05', assetKey: '06', title: 'Đèn đọc sách',
    description: 'Đèn để bàn gọn nhẹ, ánh sáng ấm, phù hợp với bàn học ở ký túc xá.',
    price: 90000, condition: ListingCondition.LIKE_NEW, category: 1, seller: 2, media: 'lamp',
  },
  {
    key: '07', assetKey: '08', title: 'Máy tính cầm tay',
    description: 'Máy tính khoa học còn hoạt động tốt, có nắp bảo vệ.',
    price: 180000, condition: ListingCondition.GOOD, category: 2, seller: 2, media: 'calculator',
  },
];

function demoId(key: string) {
  return `f1000000-0000-4000-8000-0000000000${key}`;
}

async function seed() {
  const databaseHost = new URL(process.env.DATABASE_URL || '').hostname;
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(databaseHost);
  const studentPassword = process.env.DEMO_STUDENT_PASSWORD || (local ? demoPassword : '');
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || (local ? demoPassword : '');
  if (!local && (
    !process.env.BLOB_READ_WRITE_TOKEN || studentPassword.length < 16 || adminPassword.length < 16
    || adminPassword === studentPassword || [studentPassword, adminPassword].includes(demoPassword)
  )) throw Error('Seed cloud cần kho ảnh và hai mật khẩu riêng dài ít nhất 16 ký tự cho sinh viên và quản trị viên.');

  const images = await Promise.all(demoListings.map(async ({ assetKey, media }) => {
    const id = demoId(assetKey);
    const image = await readFile(resolve(__dirname, '../../demo-media', `${media}.webp`));
    const objectKey = `seeded-${id}.webp`;
    await storeImage(objectKey, image, 'image/webp', true);
    return { id, objectKey, bytes: image.length, mime: 'image/webp', purpose: AssetPurpose.LISTING, position: 0 };
  }));

  const passwordHash = await hash(studentPassword, { type: argon2id });
  const adminHash = studentPassword === adminPassword ? passwordHash : await hash(adminPassword, { type: argon2id });
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const schools = await Promise.all(['A', 'B'].map((code) =>
      tx.school.upsert({ where: { code }, update: {}, create: { code, name: `Trường ${code}` } }),
    ));
    const categories = await Promise.all(['Giáo trình', 'Đồ KTX', 'Điện tử'].map((name, index) => {
      const id = demoId(`1${index}`);
      return tx.category.findFirst({ where: { OR: [{ id }, { name }] } })
        .then((existing) => existing ?? tx.category.upsert({ where: { id }, update: {}, create: { id, name } }));
    }));

    const users = await Promise.all([
      { name: 'minh', displayName: 'Minh', school: 0 },
      { name: 'lan', displayName: 'Lan', school: 0 },
      { name: 'an', displayName: 'An', school: 1 },
      { name: 'chua-xac-minh', displayName: 'Sinh viên chưa xác minh', school: 1 },
      { name: 'admin', displayName: 'Quản trị viên', school: 0 },
    ].map(({ name, displayName, school }) => {
      const email = `${name}@student.example.test`;
      return tx.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          displayName,
          passwordHash: name === 'admin' ? adminHash : passwordHash,
          schoolId: schools[school].id,
          area: school === 0 ? 'KTX A' : 'KTX B',
          role: name === 'admin' ? Role.ADMIN : Role.STUDENT,
          verifiedAt: name === 'chua-xac-minh' ? null : now,
        },
      });
    }));

    for (const [index, item] of demoListings.entries()) {
      const id = demoId(item.key);
      if (await tx.listing.findUnique({ where: { id }, select: { id: true } })) continue;
      const seller = users[item.seller];
      const buyer = users[1];
      const school = seller.schoolId === schools[1].id ? schools[1] : schools[0];
      await tx.listing.create({
        data: {
          id,
          sellerId: seller.id,
          categoryId: categories[item.category].id,
          schoolId: school.id,
          area: seller.area || 'KTX A',
          title: item.title,
          description: item.description,
          price: item.price,
          condition: item.condition,
          state: item.reserved ? 'RESERVED' : 'AVAILABLE',
          publishedAt: seller.status === 'ACTIVE' ? now : null,
          assets: { create: { ...images[index], ownerId: seller.id } },
          ...(item.reserved ? {
            reservations: {
              create: {
                buyerId: buyer.id,
                state: 'ACCEPTED' as const,
                finalPrice: 40000,
                meetingAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                meetingPlace: 'Sảnh KTX A',
                paymentMethod: 'COD' as const,
              },
            },
            reports: {
              create: {
                reporterId: buyer.id,
                reason: 'OTHER' as const,
                details: 'Báo cáo hư cấu chuẩn bị cho bước quản trị trong buổi demo.',
              },
            },
          } : {}),
        },
      });
    }
  });
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
