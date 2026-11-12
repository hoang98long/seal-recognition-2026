import type { Result } from '../types';

const serviceErrors: Record<string, string> = {
  openai_not_configured: 'Dịch vụ so khớp chưa được cấu hình. Bạn vẫn có thể tải lên và chuẩn bị ảnh.',
  invalid_api_key: 'Thông tin kết nối dịch vụ so khớp không hợp lệ. Vui lòng kiểm tra cấu hình.',
  model_access:
    'Cấu hình dịch vụ so khớp chưa khả dụng hoặc thiếu quyền truy cập. Vui lòng kiểm tra kết nối.',
  provider_timeout: 'So khớp vượt quá thời gian chờ. Vui lòng thử lại.',
  provider_rate_limit:
    'Dịch vụ so khớp đang giới hạn lượt xử lý hoặc hết hạn mức. Vui lòng kiểm tra kết nối hoặc thử lại sau.',
  provider_network: 'Không kết nối được dịch vụ so khớp. Vui lòng kiểm tra mạng và thử lại.',
  provider_bad_request: 'Dịch vụ so khớp không chấp nhận dữ liệu đầu vào. Vui lòng kiểm tra ảnh và cấu hình.',
  provider_refusal: 'Không thể xử lý cặp ảnh này. Vui lòng chọn ảnh khác.',
  invalid_provider_result: 'Không nhận được kết quả so khớp hợp lệ. Chưa có điểm tương đồng.',
  provider_error: 'Dịch vụ so khớp gặp lỗi. Chưa có điểm tương đồng.',
  consent_required: 'Chưa thể bắt đầu so khớp. Vui lòng tải lại trang và thử lại.',
};

export const serviceErrorMessage = (code?: string | null) => (code ? serviceErrors[code] : undefined);
export const resultErrorMessage = (code?: string | null) =>
  serviceErrorMessage(code) || 'Không thể hoàn tất so khớp. Vui lòng kiểm tra ảnh và thử lại.';
export const resultScore = (result: Result) =>
  result.result_status === 'success' ? result.visual_similarity_score : null;
export const comparisonNotice =
  'Điểm tương đồng dùng để tham khảo, không phải kết luận giám định hoặc xác thực tài liệu.';
