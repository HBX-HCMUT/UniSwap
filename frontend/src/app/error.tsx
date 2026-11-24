'use client';

import { Empty } from '../components/ui';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <Empty title="Không thể tải trang"><p>Kiểm tra kết nối rồi thử lại.</p><button type="button" onClick={reset}>Thử lại</button></Empty>;
}
