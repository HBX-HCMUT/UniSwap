import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssetImage, Back, Badge, PageHeader } from '../../../components/ui';
import { ReservationActions } from '../../../features/reservations';
import { moment, money } from '../../../lib/format';
import { reservationStates, type Listing, type PublicProfile, type Reservation } from '../../../lib/model';
import { optionalGet, requireUser } from '../../../lib/server';

export const metadata = { title: 'Chi tiết yêu cầu giữ', robots: { index: false, follow: false } };

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(`/reservations/${id}`);
  if (viewer.role !== 'STUDENT') notFound();
  const reservation = await optionalGet<Reservation>(`/reservations/${id}`);
  if (!reservation) notFound();

  const buyer = viewer.id === reservation.buyerId;
  const [listing, profile] = await Promise.all([
    optionalGet<Listing>(`/listings/${reservation.listingId}`),
    optionalGet<PublicProfile>(`/users/${buyer ? reservation.sellerId : reservation.buyerId}`),
  ]);
  const title = listing?.title ?? 'Tin không còn hiển thị';
  const partner = profile?.displayName ?? (buyer ? 'người bán' : 'người mua');
  const { state, finalPrice, meetingAt, meetingPlace, paymentMethod, qrAsset, completedAt } = reservation;

  return <section className="narrow">
    <Back to="/me/reservations">Giao dịch của tôi</Back>
    <PageHeader title={title} description={`${buyer ? 'Mua từ' : 'Bán cho'} ${partner}`}>
      <Badge tone={state === 'COMPLETED' ? 'green' : state === 'CANCELLED' || state === 'REJECTED' ? 'red' : 'amber'}>{reservationStates[state]}</Badge>
    </PageHeader>
    <div className="stack">
      <section className="panel stack">
        <div className="record-top"><h2>{meetingAt ? 'Lịch hẹn' : 'Chi tiết yêu cầu giữ'}</h2>{listing && <Link href={`/listings/${listing.id}`}>Xem tin đăng</Link>}</div>
        <dl className="details">
          {finalPrice !== undefined && <><dt>Giá chốt</dt><dd>{money(finalPrice)}</dd></>}
          {meetingAt && <><dt>Giờ hẹn</dt><dd><time dateTime={meetingAt}>{moment(meetingAt)}</time> (giờ Việt Nam)</dd></>}
          {meetingPlace && <><dt>Điểm hẹn</dt><dd>{meetingPlace}</dd></>}
          {paymentMethod && <><dt>Thanh toán</dt><dd>{paymentMethod === 'COD' ? 'Trả tiền khi nhận (COD)' : 'Chuyển khoản qua QR thủ công'}</dd></>}
          {completedAt && <><dt>Hoàn tất lúc</dt><dd><time dateTime={completedAt}>{moment(completedAt)}</time></dd></>}
          <dt>Gửi yêu cầu lúc</dt><dd><time dateTime={reservation.createdAt}>{moment(reservation.createdAt)}</time></dd>
        </dl>
        {qrAsset && (state === 'ACCEPTED' || state === 'COMPLETED') && <div className="qr-preview stack compact">
          <p>Hai bên tự kiểm tra khoản chuyển lúc gặp.</p><AssetImage asset={qrAsset} alt="Ảnh QR thanh toán" eager />
        </div>}
      </section>
      <ReservationActions reservation={reservation} buyer={buyer} partner={partner} title={title} askingPrice={listing?.price} canChat={Boolean(listing)} />
    </div>
  </section>;
}
