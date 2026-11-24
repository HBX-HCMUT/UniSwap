'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Field, Notice } from '../components/ui';
import { request } from '../lib/api';
import { formData, href, value } from '../lib/query';
import { useMutation } from './mutation';

const oauthReturn = 'uniswap-oauth-return';

export function AuthForm({ mode, returnTo, oauth }: { mode: 'login' | 'register'; returnTo: string; oauth?: string }) {
  const { error, fields, pending, run } = useMutation();
  const [verifyEmail, setVerifyEmail] = useState('');
  const login = mode === 'login';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    const data = formData(event);
    const email = value(data, 'email');
    const password = String(data.get('password') ?? '');
    void run(async () => {
      if (login) {
        await request('/auth/login', 'POST', { email, password });
        location.assign(returnTo);
      } else {
        await request('/auth/register', 'POST', { email, password, displayName: value(data, 'displayName') });
        setVerifyEmail(email);
      }
    });
  };
  if (verifyEmail) return <div className="stack"><Notice text={`Hãy mở thư xác thực gửi đến ${verifyEmail}, sau đó đăng nhập.`} /><Resend initialEmail={verifyEmail} /><Link href={href('/login', { returnTo })}>Đến trang đăng nhập</Link></div>;
  return <div className="stack">
    <form className="stack" onSubmit={submit}>
      {!login && <Field name="displayName" label="Tên hiển thị" error={fields.displayName}><input id="displayName" name="displayName" autoComplete="nickname" required maxLength={100} aria-describedby={fields.displayName ? 'displayName-error' : undefined} /></Field>}
      <Field name="email" label="Email trường" error={fields.email}><input id="email" name="email" type="email" autoComplete="email" required aria-describedby={fields.email ? 'email-error' : undefined} /></Field>
      <Field name="password" label="Mật khẩu" error={fields.password}><input id="password" name="password" type="password" autoComplete={login ? 'current-password' : 'new-password'} minLength={login ? undefined : 8} maxLength={128} required aria-describedby={fields.password ? 'password-error' : undefined} /></Field>
      <Notice error text={error || (oauth === 'error' ? 'Không thể đăng nhập bằng Google. Vui lòng thử lại với email trường.' : '')} />
      <button type="submit" disabled={pending}>{pending ? 'Đang xử lý…' : login ? 'Đăng nhập' : 'Đăng ký'}</button>
    </form>
    <a className="button secondary" href="/api/v1/auth/google" onClick={() => sessionStorage.setItem(oauthReturn, returnTo)}>Tiếp tục với Google</a>
    {login ? <><p>Chưa có tài khoản? <Link href={href('/register', { returnTo })}>Đăng ký</Link></p><details><summary>Gửi lại thư xác thực</summary><div className="detail-body"><Resend /></div></details></>
      : <p>Đã có tài khoản? <Link href={href('/login', { returnTo })}>Đăng nhập</Link></p>}
  </div>;
}

export function VerifyForm({ token }: { token: string }) {
  const [verified, setVerified] = useState(false);
  const { pending, error, run } = useMutation();
  if (verified) return <div className="stack"><Notice text="Email đã được xác thực." /><Link className="button" href="/login">Đăng nhập</Link></div>;
  return <div className="stack">
    <Notice error text={error || (!token ? 'Liên kết thiếu mã xác thực. Hãy yêu cầu gửi lại thư.' : '')} />
    {token && <button disabled={pending} onClick={() => void run(async () => { await request('/auth/verify', 'POST', { token }); setVerified(true); })}>{pending ? 'Đang xác thực…' : 'Xác thực email'}</button>}
    <Resend />
  </div>;
}

function Resend({ initialEmail = '' }: { initialEmail?: string }) {
  const { pending, error, run } = useMutation();
  const [sent, setSent] = useState(false);
  function send(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    setSent(false);
    void run(async () => { await request('/auth/resend', 'POST', { email: value(data, 'resend-email') }); setSent(true); });
  }
  return <form className="stack" onSubmit={send}>
    <Field name="resend-email" label="Email nhận thư xác thực"><input id="resend-email" name="resend-email" type="email" defaultValue={initialEmail} autoComplete="email" required /></Field>
    <button type="submit" className="button secondary" disabled={pending}>{pending ? 'Đang gửi…' : 'Gửi lại thư'}</button>
    <Notice error text={error} />{sent && <Notice text="Nếu tài khoản đang chờ xác thực, UniSwap sẽ gửi lại thư." />}
  </form>;
}

export function OAuthReturn() {
  const { router } = useMutation();
  return <div className="stack"><Notice text="Đã đăng nhập bằng Google." /><button onClick={() => {
    const path = sessionStorage.getItem(oauthReturn);
    sessionStorage.removeItem(oauthReturn);
    // The value originated from the server-validated returnTo query.
    if (path?.startsWith('/') && !path.startsWith('//') && !path.includes('\\')) router.replace(path);
    else router.replace('/');
  }}>Tiếp tục</button></div>;
}

export function Logout() {
  const { error, pending, run } = useMutation();
  return <div className="stack compact"><button className="button secondary" disabled={pending} onClick={() => void run(async () => {
    await request('/auth/logout', 'POST');
    location.assign('/');
  })}>Đăng xuất</button><Notice error text={error} /></div>;
}
