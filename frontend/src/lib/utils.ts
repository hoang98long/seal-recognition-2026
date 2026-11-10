import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Asset } from '../types';
export const assetLabel = (asset: Asset) =>
  asset.display_name || `${asset.original_filename} · ${asset.id.slice(0, 8)}`;
export const scoreBand = (score: number | null | undefined) =>
  score == null ? 'gray' : score > 90 ? 'green' : score >= 70 ? 'yellow' : 'red';
export const scoreLabel = (score: number | null | undefined) =>
  score == null
    ? 'Chưa đủ dữ liệu'
    : score > 90
      ? 'Tương đồng cao'
      : score >= 70
        ? 'Cần xem xét'
        : 'Ít tương đồng';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const dateTime = (date: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
export const statusLabel: Record<string, string> = {
  draft: 'Bản nháp',
  running: 'Đang phân tích',
  queued: 'Đang chờ xử lý',
  interrupted: 'Bị gián đoạn',
  organization_search: 'Tra cứu tổ chức',
  completed: 'Hoàn tất',
  failed: 'Có lỗi',
  active: 'Đang sử dụng',
  inactive: 'Ngưng sử dụng',
  reference_only: 'Chỉ tham chiếu',
  unverified: 'Chưa xác thực',
  verified: 'Đã xác thực',
  round: 'Dấu tròn',
  rectangular: 'Dấu chữ nhật',
  other: 'Khác',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  weak: 'Yếu',
  moderate: 'Vừa',
  strong: 'Rõ',
  uncertain: 'Chưa rõ',
  success: 'Có kết quả',
  insufficient_data: 'Không đủ dữ liệu',
  error: 'Lỗi',
  unknown: 'Chưa rõ',
  documented: 'Có hồ sơ',
  scan: 'Quét',
  photo: 'Chụp ảnh',
  uploaded: 'Tải lên',
  digital: 'Ảnh số',
  similar: 'Tương đồng',
  different: 'Khác biệt',
  user_note: 'Ghi chú',
  outer_ring: 'Vòng ngoài',
  inner_ring: 'Vòng trong',
  text: 'Chữ',
  symbol: 'Biểu tượng',
  layout: 'Bố cục',
  color: 'Màu',
  local_detail: 'Chi tiết',
  admin: 'Quản trị',
  analyst: 'Phân tích viên',
  viewer: 'Chỉ xem',
};
export const verdictLabel: Record<string, string> = {
  visually_similar: 'Tương đồng biểu kiến',
  partially_similar: 'Tương đồng một phần',
  visually_different: 'Khác biệt biểu kiến',
  insufficient_evidence: 'KHÔNG ĐỦ CƠ SỞ KẾT LUẬN',
};
