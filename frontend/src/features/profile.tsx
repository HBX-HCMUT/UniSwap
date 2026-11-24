'use client';

import { useState, type FormEvent } from 'react';
import { Field, Notice } from '../components/ui';
import { request } from '../lib/api';
import type { Me, School } from '../lib/model';
import { formData, value } from '../lib/query';
import { useMutation } from './mutation';

export function ProfileForm({ user, schools }: { user: Me; schools: School[] }) {
  const { pending, error, fields, run, router } = useMutation();
  const [saved, setSaved] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    setSaved(false);
    void run(async () => {
      const area = value(data, 'area');
      const schoolId = value(data, 'profile-school');
      await request('/me', 'PATCH', {
        displayName: value(data, 'displayName'), ...(schoolId ? { schoolId } : {}),
        ...(area ? { area } : {}), contact: value(data, 'contact'),
      });
      setSaved(true);
      router.refresh();
    });
  }
  return <form className="panel stack" onSubmit={submit}>
    <h2>Thông tin cá nhân</h2>
    <Field name="displayName" label="Tên hiển thị" error={fields.displayName}><input id="displayName" name="displayName" required maxLength={100} defaultValue={user.displayName} /></Field>
    <Field name="profile-school" label="Trường" error={fields.schoolId}><select id="profile-school" name="profile-school" defaultValue={user.schoolId ?? ''}>
      <option value="" disabled={Boolean(user.schoolId)}>Chọn trường</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
    </select></Field>
    <Field name="area" label="Khu vực / ký túc xá" error={fields.area}><input id="area" name="area" maxLength={120} defaultValue={user.area ?? ''} required={Boolean(user.area)} /></Field>
    <Field name="contact" label="Thông tin liên hệ" error={fields.contact}><input id="contact" name="contact" maxLength={200} defaultValue={user.contact ?? ''} aria-describedby="contact-help" /></Field>
    <p className="muted" id="contact-help">Thông tin liên hệ chỉ hiển thị trên trang cá nhân của bạn.</p>
    <Notice text={error} error />{saved && <Notice text="Đã cập nhật hồ sơ." />}
    <div><button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div>
  </form>;
}
