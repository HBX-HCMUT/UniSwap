export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface School { id: string; name: string; code: string }
export interface Category { id: string; name: string; active: boolean }
export interface PublicProfile { id: string; displayName: string; schoolId: string | null; averageRating: number | null; reviewCount: number }
export interface Me extends PublicProfile {
  email: string; area?: string; contact?: string; role: 'STUDENT' | 'ADMIN';
}
export interface Asset { id: string; purpose: 'LISTING' | 'PAYMENT_QR'; url: string }
export interface Listing {
  id: string; title: string; description: string; price: number; condition: keyof typeof conditionNames;
  schoolId: string; categoryId: string; categoryName: string; area: string; seller: PublicProfile; images: Asset[];
  state: keyof typeof listingStates; moderation: keyof typeof moderationStates; createdAt: string;
}
export interface Saved { listings: Listing[]; sellers: PublicProfile[]; categories: Category[] }
export interface Conversation { id: string; listingId: string; buyerId: string; sellerId: string; createdAt: string }
export interface Message { id: string; conversationId: string; senderId: string; text: string; createdAt: string }
export interface Reservation {
  id: string; listingId: string; buyerId: string; sellerId: string; createdAt: string;
  state: keyof typeof reservationStates; finalPrice?: number; meetingAt?: string; meetingPlace?: string;
  paymentMethod?: 'COD' | 'QR_MANUAL'; qrAsset?: Asset; completedAt?: string; viewerHasReviewed?: boolean;
}
export interface Review {
  id: string; reservationId: string; authorId: string; targetId: string; rating: number; comment?: string; createdAt: string;
}
export interface Notification {
  id: string; kind: 'MESSAGE' | 'RESERVATION' | 'NEW_LISTING' | 'MODERATION'; resourceId: string;
  text: string; readAt: string | null; createdAt: string;
}
export interface Report {
  id: string; reporterId: string; listingId: string; reason: keyof typeof reportReasons; details?: string;
  state: keyof typeof reportStates; createdAt: string;
}
export interface AdminUser { id: string; email: string; displayName: string; status: 'ACTIVE' | 'LOCKED'; role: 'STUDENT' | 'ADMIN' }
export interface Stats { from: string; to: string; listingCount: number; completedCount: number; activeStudentCount: number }

export const conditionNames = { LIKE_NEW: 'Như mới', GOOD: 'Còn tốt', FAIR: 'Đã qua sử dụng' };
export const listingStates = { AVAILABLE: 'Còn bán', RESERVED: 'Đang giữ', SOLD: 'Đã bán', HIDDEN: 'Đã ẩn' };
export const moderationStates = { APPROVED: 'Đã duyệt', PENDING: 'Chờ duyệt', REMOVED: 'Đã gỡ' };
export const reservationStates = { PENDING: 'Đang chờ', ACCEPTED: 'Đang giữ', REJECTED: 'Đã bị từ chối', CANCELLED: 'Đã hủy', COMPLETED: 'Đã hoàn tất' };
export const reportReasons = { SCAM: 'Nghi ngờ lừa đảo', PROHIBITED: 'Hàng hóa bị cấm', SPAM: 'Tin rác', OTHER: 'Lý do khác' };
export const reportStates = { OPEN: 'Chờ xử lý', DISMISSED: 'Đã bỏ qua', ACTIONED: 'Đã xử lý' };
