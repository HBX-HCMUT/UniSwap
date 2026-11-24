import Link from 'next/link';
import { Empty } from '../components/ui';

export default function NotFoundPage() {
  return <Empty title="Trang này không còn hiển thị"><p>Tin có thể đã bị ẩn, bị gỡ hoặc bạn không có quyền truy cập.</p><Link className="button" href="/">Về chợ</Link></Empty>;
}
