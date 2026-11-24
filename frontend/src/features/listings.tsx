'use client';

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { AssetImage, Field, Notice } from '../components/ui';
import { Icon } from '../components/icons';
import { ApiError, request } from '../lib/api';
import { conditionNames, reportReasons, type Asset, type Category, type Conversation, type Listing, type Me, type Reservation, type School } from '../lib/model';
import { formData, href, value } from '../lib/query';
import { useMutation } from './mutation';
import { Toggle } from './toggle';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const imageLimit = 5 * 1024 * 1024;

export function imageProblem(file: File) {
  if (!imageTypes.includes(file.type)) return 'Chỉ hỗ trợ ảnh JPEG, PNG và WebP.';
  if (file.size > imageLimit) return 'Mỗi ảnh tối đa 5 MB.';
  return '';
}

export function uploadImage(file: File, purpose: Asset['purpose']) {
  const problem = imageProblem(file);
  if (problem) throw new ApiError(400, problem);
  const form = new FormData();
  form.set('file', file);
  form.set('purpose', purpose);
  return request<Asset>('/assets', 'POST', form);
}

export function Gallery({ listing }: { listing: Listing }) {
  const [current, setCurrent] = useState(0);
  return <div className="gallery">
    <div className="gallery-main"><AssetImage asset={listing.images[current] ?? listing.images[0]} alt={`${listing.title} · Ảnh ${current + 1}`} eager /></div>
    {listing.images.length > 1 && <div className="gallery-thumbs" aria-label="Chọn ảnh">{listing.images.map((asset, index) => <button type="button" key={asset.id} aria-label={`Xem ảnh ${index + 1}`} aria-pressed={index === current} onClick={() => setCurrent(index)}><AssetImage asset={asset} alt="" /></button>)}</div>}
  </div>;
}

type Photo = { key: string; asset: Asset } | { key: string; file: File };
function PhotoPreview({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!('file' in photo)) return;
    const objectUrl = URL.createObjectURL(photo.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);
  if ('asset' in photo) return <AssetImage asset={photo.asset} alt="" />;
  // Local file previews use a browser object URL.
  return url ? <img src={url} alt="" /> : null;
}

export function ListingForm({ listing, categories, schools, user }: { listing?: Listing; categories: Category[]; schools: School[]; user: Me }) {
  const [photos, setPhotos] = useState<Photo[]>(() => listing?.images.map((asset) => ({ key: asset.id, asset })) ?? []);
  const [photoError, setPhotoError] = useState('');
  const { pending, error, fields, run, router } = useMutation();
  const listingId = listing?.id;
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > 6) {
      setPhotoError('Mỗi tin có tối đa 6 ảnh.');
      return;
    }
    const issue = files.map(imageProblem).find(Boolean);
    if (issue) { setPhotoError(issue); return; }
    setPhotoError('');
    setPhotos((previous) => [...previous, ...files.map((file) => ({ key: crypto.randomUUID(), file }))]);
  }
  function move(index: number, offset: number) {
    const next = [...photos];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setPhotos(next);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    const form = formData(event);
    if (photos.length === 0) { setPhotoError('Hãy chọn ít nhất một ảnh.'); return; }
    setPhotoError('');
    void run(async () => {
      const imageIds: string[] = [];
      for (const photo of photos) {
        if ('asset' in photo) { imageIds.push(photo.asset.id); continue; }
        const asset = await uploadImage(photo.file, 'LISTING');
        imageIds.push(asset.id);
        setPhotos((previous) => previous.map((item) => item.key === photo.key ? { key: item.key, asset } : item));
      }
      const data = {
        title: value(form, 'title'), description: value(form, 'description'), price: Number(value(form, 'price')),
        condition: value(form, 'condition'), categoryId: value(form, 'categoryId'), schoolId: value(form, 'schoolId'),
        area: value(form, 'area'), imageIds,
      };
      const saved = await request<Listing>(listingId ? `/listings/${listingId}` : '/listings', listingId ? 'PUT' : 'POST', data);
      router.push(`/listings/${saved.id}`);
      router.refresh();
    }, Boolean(listingId));
  }
  return <form className="panel stack" onSubmit={submit}>
    <Field name="photos" label="Ảnh tin đăng" error={photoError || fields.imageIds}><input id="photos" type="file" multiple accept={imageTypes.join(',')} onChange={choose} disabled={pending} aria-describedby={photoError || fields.imageIds ? 'image-help photos-error' : 'image-help'} /></Field>
    <p id="image-help" className="muted">Chọn 1–6 ảnh JPG, PNG hoặc WebP. Mỗi ảnh tối đa 5 MB. Ảnh đầu tiên làm ảnh bìa.</p>
    {photos.length > 0 && <ol className="photo-order" aria-label="Thứ tự ảnh">{photos.map((photo, index) => <li key={photo.key}>
      <PhotoPreview photo={photo} /><span>{index === 0 ? 'Ảnh bìa' : `Ảnh ${index + 1}`}</span>
      <div className="row">
        {index > 0 && <button className="button secondary" type="button" disabled={pending} onClick={() => move(index, -1)} aria-label={`Đưa ảnh ${index + 1} lên`}>Lên</button>}
        {index < photos.length - 1 && <button className="button secondary" type="button" disabled={pending} onClick={() => move(index, 1)} aria-label={`Đưa ảnh ${index + 1} xuống`}>Xuống</button>}
        <button className="button danger" type="button" disabled={pending} onClick={() => { setPhotos((previous) => previous.filter(({ key }) => key !== photo.key)); setPhotoError(''); }} aria-label={`Bỏ ảnh ${index + 1}`}>Bỏ</button>
      </div>
    </li>)}</ol>}
    <Field name="title" label="Tên món" error={fields.title}><input id="title" name="title" required maxLength={120} defaultValue={listing?.title} aria-describedby={fields.title ? 'title-error' : undefined} /></Field>
    <div className="fieldpair">
      <Field name="price" label="Giá (VND)" error={fields.price}><input id="price" name="price" type="number" required min={0} max={2000000000} step={1} defaultValue={listing?.price} aria-describedby={fields.price ? 'price-error' : undefined} /></Field>
      <Field name="condition" label="Tình trạng" error={fields.condition}><select id="condition" name="condition" defaultValue={listing?.condition ?? ''} required aria-describedby={fields.condition ? 'condition-error' : undefined}><option value="">Chọn tình trạng</option>{Object.entries(conditionNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
      <Field name="categoryId" label="Danh mục" error={fields.categoryId}><select id="categoryId" name="categoryId" required defaultValue={listing?.categoryId ?? ''} aria-describedby={fields.categoryId ? 'categoryId-error' : undefined}><option value="">Chọn danh mục</option>{listing && !categories.some(({ id }) => id === listing.categoryId) && <option value={listing.categoryId}>Danh mục hiện tại đã ngừng dùng</option>}{categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
      <Field name="schoolId" label="Trường" error={fields.schoolId}><select id="schoolId" name="schoolId" required defaultValue={listing?.schoolId ?? user.schoolId ?? ''} aria-describedby={fields.schoolId ? 'schoolId-error' : undefined}><option value="">Chọn trường</option>{schools.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
    </div>
    <Field name="area" label="Khu vực" error={fields.area}><input id="area" name="area" required maxLength={120} defaultValue={listing?.area ?? user.area} placeholder="Ví dụ KTX A" aria-describedby={fields.area ? 'area-error' : undefined} /></Field>
    <Field name="description" label="Mô tả" error={fields.description}><textarea id="description" name="description" required maxLength={4000} defaultValue={listing?.description} aria-describedby={fields.description ? 'description-error' : undefined} /></Field>
    <Notice text={error} error />
    <div><button type="submit" disabled={pending}>{pending ? 'Đang lưu tin…' : listingId ? 'Lưu thay đổi' : 'Đăng tin'}</button></div>
  </form>;
}

export function OwnerActions({ listing }: { listing: Listing }) {
  const { pending, error, run, router } = useMutation();
  function change(action: 'HIDE' | 'SHOW' | 'MARK_SOLD') {
    void run(async () => { await request(`/listings/${listing.id}/state`, 'PATCH', { action }); router.refresh(); }, true);
  }
  return <div className="stack compact">
    <div className="row">
      {listing.moderation !== 'REMOVED' && listing.state === 'AVAILABLE' && <>
        <Link className="button secondary" href={`/listings/${listing.id}/edit`}>Sửa tin</Link>
        <button type="button" className="button secondary" disabled={pending} onClick={() => change('HIDE')}>Ẩn tin</button>
        <button type="button" className="button secondary" disabled={pending} onClick={() => {
          if (window.confirm(`Đánh dấu “${listing.title}” đã bán ngoài UniSwap?`)) change('MARK_SOLD');
        }}>Đánh dấu đã bán</button>
      </>}
      {listing.moderation !== 'REMOVED' && listing.state === 'HIDDEN' && <button type="button" className="button secondary" disabled={pending} onClick={() => change('SHOW')}>Hiện lại tin</button>}
      <Link href="/me/listings">Quản lý tin của tôi</Link>
    </div>
    <Notice text={error} error />
  </div>;
}

export function ListingActions({ listing, user, saved }: { listing: Listing; user: Me | null; saved: boolean }) {
  const { pending, error, run, router } = useMutation();
  const path = `/listings/${listing.id}`;
  const canReserve = listing.state === 'AVAILABLE' && listing.moderation === 'APPROVED';
  if (user?.id === listing.seller.id) return <OwnerActions listing={listing} />;
  if (user?.role === 'ADMIN') return <Link className="button secondary" href="/admin/listings">Quản trị tin đăng</Link>;
  if (!user) {
    const login = href('/login', { returnTo: path });
    return <div className="row"><Link className="button" href={login} aria-label="Nhắn tin, đăng nhập"><Icon name="chat"/>Nhắn tin</Link>
      {canReserve && <Link className="button secondary" href={login} aria-label="Giữ món, đăng nhập">Giữ món</Link>}
      <Link href={login}>Đăng nhập để lưu hoặc báo cáo tin</Link></div>;
  }
  return <div className="stack compact">
    <div className="row sticky-actions">
      <button type="button" disabled={pending} onClick={() => void run(async () => {
        const conversation = await request<Conversation>('/conversations', 'POST', { listingId: listing.id });
        router.push(`/inbox/${conversation.id}`);
      }, true)}><Icon name="chat"/>Nhắn tin</button>
      {canReserve && <button type="button" className="button secondary" disabled={pending} onClick={() => void run(async () => {
        const reservation = await request<Reservation>('/reservations', 'POST', { listingId: listing.id });
        router.push(`/reservations/${reservation.id}`);
      }, true)}>Giữ món</button>}
    </div>
    <Notice text={error} error />
    <div className="row">
      <Toggle endpoint={`/me/favorites/${listing.id}`} active={saved} add="Lưu tin" remove="Bỏ lưu tin" />
      <ReportListing listingId={listing.id} />
    </div>
  </div>;
}

function ReportListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const { pending, error, fields, run } = useMutation();
  function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    const details = value(data, 'report-details');
    void run(async () => {
      await request('/reports', 'POST', { listingId, reason: value(data, 'report-reason'), ...(details ? { details } : {}) });
      setOpen(false);
      setSent(true);
    });
  }
  if (sent) return <Notice text="Đã gửi báo cáo." />;
  if (!open) return <button type="button" className="button secondary" onClick={() => setOpen(true)}>Báo cáo tin</button>;
  return <form className="stack compact full-width" onSubmit={submit}>
    <Field name="report-reason" label="Lý do báo cáo" error={fields.reason}><select name="report-reason" id="report-reason" required><option value="">Chọn lý do</option>{Object.entries(reportReasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <Field name="report-details" label="Chi tiết báo cáo" error={fields.details}><textarea id="report-details" name="report-details" maxLength={500} /></Field>
    <Notice text={error} error />
    <div className="row"><button disabled={pending} type="submit">Gửi báo cáo</button><button disabled={pending} type="button" className="button secondary" onClick={() => setOpen(false)}>Đóng</button></div>
  </form>;
}
