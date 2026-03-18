# FINAI - Đặc tả hệ thống

## 1. Tổng quan và mục tiêu

- Mục tiêu cốt lõi: tối ưu theo thứ tự ưu tiên
	1. Tăng số lượng lead
	2. Tăng tỷ lệ hoàn tất đăng ký
	3. Tăng chất lượng lead
- Chức năng của AI: chỉ thu thập thông tin không định danh để tư vấn, sau đó điều hướng người dùng sang website hoặc campaign đăng ký bên ngoài.
- Ngôn ngữ hỗ trợ: song ngữ Tiếng Anh (EN) và Tiếng Tây Ban Nha (ES).
- Cơ chế nhận diện ngôn ngữ: tự động nhận diện từ tin nhắn đầu tiên và giữ cố định một ngôn ngữ trong toàn bộ phiên chat.

## 2. Luồng hội thoại (Conversation Flow)

Quy trình tương tác được thiết kế theo phễu thu thập thông tin:

1. Bước 1 - Chào hỏi: AI mở đầu theo ngôn ngữ của phiên (EN hoặc ES).
2. Bước 2 - Phân tích nhu cầu và độ gấp: AI yêu cầu người dùng mô tả tình huống tự do, sau đó map độ gấp vào 4 mức: trong vài giờ, hôm nay, 1-3 ngày, hoặc không gấp.
3. Bước 3 - Xác định số tiền: AI hỏi nhu cầu tài chính và phân loại vào 5 bucket: <$500, $500-$1k, $1k-$3k, $3k-$10k, >$10k.
4. Bước 4 - Đề xuất offer: AI trả về 3 lựa chọn (1 Best và 2 Alternatives) kèm nút Apply để mở link đối tác.

Các kịch bản rẽ nhánh (Edge cases):

- Ngoài phạm vi (Out-of-scope): từ chối các chủ đề đầu tư/crypto, thuế/pháp lý, y tế, khiếu nại/refund hoặc nội dung nhạy cảm.
- Không hiểu ý (Fallback): yêu cầu người dùng diễn đạt lại và cung cấp 3 prompt gợi ý (A/B/C) để điều hướng.

## 3. Logic tư vấn và điều hướng (Routing Logic)

Đây là bộ não lựa chọn gói vay phù hợp:

- Phân loại mục đích (Purpose): AI phân tích mô tả của người dùng để xếp vào 6 nhóm nhu cầu: PAYDAY, PERSONAL/INSTALLMENT, DEBT_RELIEF, MORTGAGE, AUTO.
- Quy tắc tư vấn: AI dựa trên 3 biến số gồm mục đích, độ gấp và số tiền. AI không được hứa duyệt vay hoặc cam kết thông số cố định về lãi/phí/kỳ hạn.
- Thuật toán chọn Top 3: chọn 1 Best và 2 Alternatives dựa trên điểm phù hợp (scoring) với mục đích, ý định và số tiền.
- Cơ chế Featured: Admin có thể cài đặt 1 offer Featured với trọng số mặc định 60% (featured_default_weight = 0.6).
- Xử lý Featured lệch nhóm: nếu offer Featured không khớp nhóm nhu cầu, hệ thống vẫn giữ offer chuẩn nhất làm Best và đẩy Featured xuống Alternative #2.

## 4. Trải nghiệm và giao diện người dùng (UI/UX)

- Thiết kế: giao diện chat toàn màn hình (full-page), mobile-first, hỗ trợ phản hồi thời gian thực (streaming).
- Công cụ hỗ trợ chat: Quick chips cho số tiền và các lựa chọn khác, kèm Prompt suggestions.
- Hiển thị offer: mỗi thẻ gồm thương hiệu, lý do phù hợp, khoảng số tiền, khoảng thời gian vay, điều kiện rút gọn và nút Apply.
- Hiển thị APR: cho phép hiển thị theo khoảng (range), nhưng bắt buộc có cảnh báo rằng APR chỉ mang tính tham khảo và phụ thuộc xét duyệt từ bên cho vay.
- Thành phần cố định: nút tạo phiên chat mới, đổi theme (light/dark), feedback thích/không thích cho mỗi phản hồi, và footer chứa thông tin miễn trừ trách nhiệm.

## 5. Quản trị dữ liệu và tracking

- Cơ sở dữ liệu: dùng Google Sheets với 3 tab chính: OFFERS, FAQ, CONFIG.
- Cấu trúc OFFERS: gồm các trường offer_id, brand_name, loan_type, apply_url, các khoảng giới hạn (amount, term, apr), điều kiện, ưu điểm, và cờ trạng thái (is_active, is_featured, featured_weight).
- Quản lý phiên (Session): tạo session_id cho mỗi phiên, lưu bằng localStorage với TTL 7 ngày (session_ttl_days = 7).
- Tracking: chỉ ghi nhận sự kiện khi người dùng click nút Apply.
- Tham số URL: gắn session_id và tham số chiến dịch (ttclid, gclid, fbclid từ query hoặc cookie) vào link Apply trước khi chuyển hướng sang đối tác.

## 6. Tuân thủ và bảo mật (Compliance & Guardrails)

- Chống thu thập PII: AI không được hỏi thông tin nhận dạng cá nhân. Nếu người dùng tự cung cấp, AI từ chối tiếp nhận và hướng dẫn nhập trên website chính thức qua nút Apply.
- Che dấu dữ liệu (Masking): cấu hình pii_masking dùng Regex/pattern để che số điện thoại, email, SSN/ID, địa chỉ, ngày sinh trước khi lưu log chat.
- Quy tắc an toàn nội dung: áp dụng hard rules, cấm các cụm từ hứa hẹn như guaranteed approval.
- Chống prompt injection: nếu phát hiện dấu hiệu tiêm nhiễm prompt, AI cảnh báo nhẹ nhàng và đưa người dùng quay về đúng phạm vi tư vấn vay vốn.