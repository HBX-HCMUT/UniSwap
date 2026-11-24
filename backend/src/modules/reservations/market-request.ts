import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { requireUser } from '../../common/auth';

export async function requireStudent(req: Request, tx?: Prisma.TransactionClient, touch = true) {
  const user = await requireUser(req, tx, touch);
  if (user.role !== 'STUDENT') throw new ForbiddenException('Tính năng này dành cho sinh viên.');
  return user;
}

export const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

export interface PageQuery {
  page?: string | number;
  pageSize?: string | number;
}

function pageInteger(value: number | string | undefined, fallback: number, max: number) {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && !/^\d+$/.test(value)) throw new BadRequestException('Trang không hợp lệ.');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > max) {
    throw new BadRequestException('Trang không hợp lệ.');
  }
  return result;
}

export function paginate(query: PageQuery) {
  const page = pageInteger(query.page, 1, Math.floor(Number.MAX_SAFE_INTEGER / 100));
  const pageSize = pageInteger(query.pageSize, 20, 100);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function pageResult<T>(items: T[], total: number, paging: { page: number; pageSize: number }) {
  return { items, total, page: paging.page, pageSize: paging.pageSize };
}

export function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
