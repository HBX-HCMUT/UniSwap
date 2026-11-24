import type { Metadata } from 'next';
import { PageHeader } from '../../components/ui';
import { AuthForm } from '../../features/auth';
import { getParam, internalPath, type SearchParams } from '../../lib/query';

export const metadata: Metadata = { title: 'Đăng ký' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  return <div className="auth panel"><PageHeader title="Tạo tài khoản" description="Đăng ký bằng email trường. Mật khẩu có ít nhất 8 ký tự." />
    <AuthForm mode="register" returnTo={internalPath(getParam(query, 'returnTo'))} />
  </div>;
}
