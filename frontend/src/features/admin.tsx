'use client';

import { useId, useState, type FormEvent } from 'react';
import { Field, Notice } from '../components/ui';
import { ApiError, request } from '../lib/api';
import type { Category } from '../lib/model';
import { formData, value } from '../lib/query';
import { useMutation } from './mutation';

type Decision = { label: string; body: Record<string, string>; danger?: boolean };

export function AdminDecision({ endpoint, decisions }: { endpoint: string; decisions: Decision[] }) {
  const id = useId();
  const { pending, error, fields, run, router } = useMutation();

  function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = formData(event);
    const reason = value(data, 'reason');
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const choice = submitter instanceof HTMLButtonElement
      ? decisions.find((decision) => decision.label === submitter.value) : decisions[0];
    if (!choice) return;
    void run(async () => {
      if (!reason) throw new ApiError(400, 'Nhập lý do xử lý.', { reason: 'Nhập lý do xử lý.' });
      await request(endpoint, 'PATCH', { ...choice.body, reason });
      form.reset();
      router.refresh();
    }, true);
  }

  return <form className="stack compact" onSubmit={submit}>
    <Field name={id} label="Lý do xử lý" error={fields.reason}>
      <input name="reason" id={id} maxLength={500} required />
    </Field>
    <div className="row">{decisions.map((decision) => <button key={decision.label} type="submit" value={decision.label} className={decision.danger ? 'danger' : undefined} disabled={pending}>{decision.label}</button>)}</div>
    <Notice text={error} error />
  </form>;
}

export function CategoryForm({ category }: { category?: Category }) {
  const id = useId();
  const { pending, error, fields, run, router } = useMutation();
  const [success, setSuccess] = useState('');
  const endpoint = category ? `/admin/categories/${category.id}` : '/admin/categories';

  function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = formData(event);
    const name = value(data, 'name');
    setSuccess('');
    void run(async () => {
      if (!name) throw new ApiError(400, 'Nhập tên danh mục.', { name: 'Nhập tên danh mục.' });
      await request(endpoint, category ? 'PATCH' : 'POST', { name });
      if (!category) form.reset();
      setSuccess(category ? 'Đã lưu tên danh mục.' : 'Đã tạo danh mục.');
      router.refresh();
    });
  }

  function toggle() {
    if (!category) return;
    setSuccess('');
    void run(async () => {
      await request(endpoint, 'PATCH', { active: !category.active });
      setSuccess(category.active ? 'Đã ngừng sử dụng danh mục.' : 'Đã bật danh mục.');
      router.refresh();
    }, true);
  }

  return <form className="stack compact" onSubmit={submit}>
    <Field name={id} label="Tên danh mục" error={fields.name}>
      <input id={id} name="name" defaultValue={category?.name ?? ''} maxLength={100} required />
    </Field>
    <div className="row">
      <button disabled={pending} type="submit">{category ? 'Lưu tên' : 'Tạo danh mục'}</button>
      {category && <button className="secondary" disabled={pending} onClick={toggle} type="button">{category.active ? 'Ngừng sử dụng' : 'Bật danh mục'}</button>}
    </div>
    <Notice text={success} />
    <Notice text={error} error />
  </form>;
}
