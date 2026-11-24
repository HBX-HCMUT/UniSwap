'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Field, Notice } from '../components/ui';
import { ApiError, request } from '../lib/api';
import { money, vietnamDateTime } from '../lib/format';
import type { Conversation, Reservation } from '../lib/model';
import { formData, value } from '../lib/query';
import { uploadImage } from './listings';
import { useMutation } from './mutation';

export function ReservationActions({ reservation, buyer, partner, title, askingPrice, canChat }: {
  reservation: Reservation; buyer: boolean; partner: string; title: string; askingPrice?: number; canChat: boolean;
}) {
  const { pending, error, fields, run, router } = useMutation();
  const [payment, setPayment] = useState<'COD' | 'QR_MANUAL'>('COD');
  const qrUpload = useRef<{ file: File; id: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const endpoint = `/reservations/${reservation.id}`;

  function change(action: 'REJECT' | 'CANCEL' | 'COMPLETE') {
    void run(async () => {
      await request(endpoint, 'PATCH', { action });
      router.refresh();
    }, true);
  }

  function accept(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    void run(async () => {
      const meetingAt = vietnamDateTime(value(data, 'meetingAt'));
      if (new Date(meetingAt).getTime() <= Date.now()) {
        throw new ApiError(422, 'Giờ hẹn phải ở tương lai.', { meetingAt: 'Chọn giờ hẹn ở tương lai.' });
      }
      const payload = {
        action: 'ACCEPT', finalPrice: Number(value(data, 'finalPrice')),
        meetingAt, meetingPlace: value(data, 'meetingPlace'), paymentMethod: payment,
      };
      if (payment === 'QR_MANUAL') {
        const file = data.get('qrAssetId');
        if (!(file instanceof File) || !file.size) throw new ApiError(400, 'Chọn ảnh QR thanh toán.');
        if (qrUpload.current?.file !== file) {
          const asset = await uploadImage(file, 'PAYMENT_QR');
          qrUpload.current = { file, id: asset.id };
        }
        await request(endpoint, 'PATCH', { ...payload, qrAssetId: qrUpload.current.id });
      } else {
        await request(endpoint, 'PATCH', payload);
      }
      router.refresh();
    }, true);
  }

  function review(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    const comment = value(data, 'comment');
    void run(async () => {
      await request(`${endpoint}/reviews`, 'POST', { rating: Number(value(data, 'rating')), ...(comment ? { comment } : {}) });
      router.refresh();
    }, true);
  }

  function chat() {
    void run(async () => {
      const conversation = await request<Conversation>('/conversations', 'POST', { listingId: reservation.listingId });
      router.push(`/inbox/${conversation.id}`);
    }, true);
  }

  const { state } = reservation;
  return <section className="panel stack">
    {state === 'PENDING' && !buyer && <form className="stack" onSubmit={accept}>
      <h2>Chốt lịch hẹn</h2>
      <div className="fieldpair">
        <Field name="finalPrice" label="Giá chốt (VND)" error={fields.finalPrice}>
          <input type="number" min={0} max={2000000000} step="1" name="finalPrice" id="finalPrice" required defaultValue={askingPrice} />
        </Field>
        <Field name="meetingAt" label="Ngày và giờ hẹn (giờ Việt Nam)" error={fields.meetingAt}>
          <input type="datetime-local" name="meetingAt" id="meetingAt" required />
        </Field>
      </div>
      <Field name="meetingPlace" label="Điểm hẹn" error={fields.meetingPlace}>
        <input name="meetingPlace" id="meetingPlace" maxLength={120} required />
      </Field>
      <Field name="paymentMethod" label="Phương thức thanh toán" error={fields.paymentMethod}>
        <select name="paymentMethod" id="paymentMethod" value={payment} onChange={(event) => setPayment(event.target.value === 'QR_MANUAL' ? 'QR_MANUAL' : 'COD')}>
          <option value="COD">Trả tiền khi nhận (COD)</option><option value="QR_MANUAL">Chuyển khoản qua QR thủ công</option>
        </select>
      </Field>
      {payment === 'QR_MANUAL' && <Field name="qrAssetId" label="Ảnh QR thanh toán" error={fields.qrAssetId}>
        <input type="file" name="qrAssetId" id="qrAssetId" accept="image/jpeg,image/png,image/webp" required />
      </Field>}
      <div className="row">
        <button type="submit" disabled={pending}>Xác nhận giữ</button>
        <button type="button" className="danger" disabled={pending} onClick={() => change('REJECT')}>Từ chối</button>
      </div>
    </form>}
    {state === 'COMPLETED' && (reservation.viewerHasReviewed ? <Notice text="Đã đánh giá" /> : <form className="stack" onSubmit={review}>
      <h2>Đánh giá {partner}</h2>
      <Field name="rating" label="Số sao" error={fields.rating}><select id="rating" name="rating" required defaultValue="">
        <option value="" disabled>Chọn số sao</option>
        {[5, 4, 3, 2, 1].map((stars) => <option key={stars} value={stars}>{stars} sao</option>)}
      </select></Field>
      <Field name="comment" label="Nhận xét" error={fields.comment}><textarea id="comment" name="comment" maxLength={1000} /></Field>
      <div><button type="submit" disabled={pending}>Gửi đánh giá</button></div>
    </form>)}
    {state === 'CANCELLED' && <p className="muted">Yêu cầu đã hủy. {reservation.meetingAt && 'Lịch hẹn cũ được lưu trong lịch sử.'}</p>}
    {state === 'REJECTED' && <p className="muted">Yêu cầu giữ đã bị từ chối.</p>}
    <div className="row">
      {state === 'PENDING' && buyer && <button type="button" className="danger" disabled={pending} onClick={() => change('CANCEL')}>Rút yêu cầu</button>}
      {state === 'ACCEPTED' && buyer && <button type="button" disabled={pending} onClick={() => dialog.current?.showModal()}>Đã nhận món</button>}
      {state === 'ACCEPTED' && <button type="button" className="danger" disabled={pending} onClick={() => change('CANCEL')}>Hủy hẹn</button>}
      {canChat && buyer && (state === 'PENDING' || state === 'ACCEPTED') && <button type="button" className="secondary" disabled={pending} onClick={chat}>Nhắn người bán</button>}
      {canChat && !buyer && state === 'ACCEPTED' && <a className="button secondary" href="/inbox">Về hộp thư</a>}
    </div>
    {state === 'ACCEPTED' && buyer && <dialog ref={dialog} aria-labelledby="confirm-receipt-title">
      <div className="stack">
        <h2 id="confirm-receipt-title">Xác nhận đã nhận món</h2>
        <p>Bạn đã nhận {title}{reservation.finalPrice !== undefined ? ` với giá ${money(reservation.finalPrice)}` : ''}?</p>
        <div className="row">
          <button type="button" className="secondary" onClick={() => dialog.current?.close()}>Quay lại</button>
          <button type="button" onClick={() => { dialog.current?.close(); change('COMPLETE'); }}>Xác nhận đã nhận</button>
        </div>
      </div>
    </dialog>}
    {pending && <p role="status" className="muted">Đang xử lý…</p>}
    <Notice text={error} error />
  </section>;
}
