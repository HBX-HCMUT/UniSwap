import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '../../components/ui';
import { AuthForm, OAuthReturn } from '../../features/auth';
import { getParam, internalPath, type SearchParams } from '../../lib/query';
import { sessionUser } from '../../lib/server';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const oauth = getParam(query, 'oauth');
  const returnTo = internalPath(getParam(query, 'returnTo'));
  const user = await sessionUser();
  if (user && oauth !== 'success') redirect(returnTo);
  return <div className="auth panel"><PageHeader title="Đăng nhập" description="Dùng email trường để vào UniSwap." />
    {user && oauth === 'success' ? <OAuthReturn /> : <AuthForm mode="login" returnTo={returnTo} oauth={oauth} />}
  </div>;
}
