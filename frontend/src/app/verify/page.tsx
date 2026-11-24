import type { Metadata } from 'next';
import { PageHeader } from '../../components/ui';
import { VerifyForm } from '../../features/auth';
import { getParam, type SearchParams } from '../../lib/query';

export const metadata: Metadata = { title: 'Xác thực email' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <div className="auth panel"><PageHeader title="Xác thực email" description="Xác nhận để hoàn tất đăng ký UniSwap." />
    <VerifyForm token={getParam(await searchParams, 'token')} />
  </div>;
}
