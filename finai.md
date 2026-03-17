FINAI – AI Tư vấn & Điều hướng đăng ký Loan
Requirement v1 (MVP 1 + Admin)
 Phạm vi: Chat page + Routing offers + Admin panel quản trị offers/featured/weights + Báo cáo cơ bản
________________________________________
0) Tổng quan
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Mục tiêu sản phẩm	Ưu tiên KPI: (1) Tăng số lead → (2) Tăng tỷ lệ hoàn tất đăng ký → (3) Tăng chất lượng lead.	KPI & cách đo trong báo cáo cơ bản.
Phạm vi AI	AI không thu thập thông tin cá nhân (PII). Chỉ hỏi thông tin không định danh để tư vấn, sau đó điều hướng (redirect) sang website/campaign đăng ký bên ngoài.	Danh sách offer/campaign + quy tắc điều hướng.
Kênh & trải nghiệm	1 trang chat riêng, trải nghiệm như ChatGPT (full page). Mobile-first, có streaming.	Thiết kế UI/UX, hosting.
Ngôn ngữ	EN/ES, tự nhận diện theo tin nhắn đầu tiên (mỗi phiên chỉ 1 ngôn ngữ).	Quy tắc nhận diện + nội dung song ngữ.
________________________________________
 
1) Luồng hội thoại (Conversation Flow)
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Lời chào mở đầu	Hiển thị lời chào theo ngôn ngữ phiên (EN hoặc ES).	Copy EN/ES.
Câu hỏi #1 (tự do)	Hỏi: “Hãy mô tả ngắn gọn tình huống và mục tiêu của bạn.” (người dùng gõ tự do).	Prompt + hướng dẫn phân loại nhu cầu.
Câu hỏi #2 (Độ gấp – tự do)	Người dùng gõ tự do → hệ thống map về 4 mức: trong vài giờ / hôm nay / 1–3 ngày / không gấp.	Quy tắc map intent.
Câu hỏi #3 (Số tiền – câu chốt)	Hỏi theo 5 bucket: <$500 / $500–$1k / $1k–$3k / $3k–$10k / >$10k.	Định nghĩa bucket.
Đề xuất & CTA	Trả về 3 lựa chọn (Best + 2 Alternatives). Mỗi lựa chọn có 1 nút Apply mở link ngoài.	Dữ liệu offer + logic chọn top 3.
Ngoài phạm vi	Nếu hỏi ngoài loan (đầu tư/crypto, thuế/pháp lý, y tế, khiếu nại/refund, nội dung nhạy cảm) → từ chối.	Danh sách out-of-scope.
Fallback	Nếu AI không hiểu: xin nói lại + gợi ý 3 prompt (A/B/C).	Danh sách prompt A/B/C.
________________________________________
 
2) Logic tư vấn & điều hướng (Routing)
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Phân loại nhu cầu (purpose)	Từ mô tả tự do → phân loại về 6 nhóm: PAYDAY / PERSONAL / INSTALLMENT / DEBT_RELIEF / MORTGAGE / AUTO.	Prompt/rule phân loại.
Rule tư vấn chuẩn	Tư vấn theo mục đích + độ gấp + số tiền; không hứa duyệt, không cam kết lãi/phí/kỳ hạn cố định.	Rule nội bộ.
Chọn 3 offers	Chọn Best + 2 alternatives dựa trên độ phù hợp với purpose/intent/amount.	Offer metadata + scoring.
Featured & Weight	Admin có thể set 1 offer “Featured” và featured_weight (mặc định 60%).	is_featured, featured_weight.
Featured lệch nhóm	Nếu Featured lệch nhóm nhu cầu: Best vẫn đúng nhu cầu, và Featured xuất hiện như Alternative #2.	Rule cross-group.
________________________________________
3) Hiển thị Offer (tăng tin tưởng & chuyển đổi)
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Nội dung mỗi offer	Hiển thị: tên brand/campaign, 1 câu “phù hợp vì…”, amount range, term range, APR range + disclaimer, tốc độ xử lý, nút Apply.	Dữ liệu offer.
APR an toàn	Cho phép nêu APR range nhưng luôn kèm disclaimer: “APR chỉ mang tính tham khảo; điều khoản cuối phụ thuộc xét duyệt của lender.”	Template EN/ES.
Điều kiện rút gọn	Hiển thị 1 dòng: “Yêu cầu thường gặp: …”	conditions_short.
________________________________________
4) UI/UX trang chat
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Trang chat	Full-page chat; streaming; mobile-first; responsive.	UI spec.
Prompt suggestions	Hiển thị gợi ý A/B/C lúc bắt đầu hoặc khi fallback.	Copy EN/ES.
Quick chips	Chips cho bucket số tiền và các lựa chọn nhanh khi cần.	Nội dung chips.
3 CTA Apply	Mỗi offer 1 nút Apply (mở link ngoài).	Apply URL + tham số tracking.
Disclaimer cố định	Footer: không phải lender + thông tin tham khảo + lãi/điều khoản thay đổi + phụ thuộc xét duyệt.	Text EN/ES.
Feedback	Nút 👍/👎 cho mỗi câu trả lời.	Event schema.
Available 24/7	Hiển thị song ngữ cùng lúc (EN + ES).	Copy EN+ES.
New chat	Nút tạo phiên mới.	Session handling.
Theme	Tự theo OS + toggle light/dark.	UI setting.
Link hub tổng	Link “Explore all options” dưới ô chat (URL placeholder).	general_hub_url placeholder.
________________________________________
 
5) Tracking & Session
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Click tracking	Chỉ tracking sự kiện click nút Apply.	Event schema.
Session ID	Tạo session_id mỗi phiên; append vào link cùng UTM.	Session generator.
Forward click-id	Forward ttclid/gclid/fbclid nếu có; lấy từ URL query + cookie/localStorage.	Danh sách tham số.
Lưu session	Lưu session bằng localStorage, TTL 7 ngày.	TTL config.
________________________________________
6) Dữ liệu (Google Sheet)
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Nguồn dữ liệu	1 file Google Sheet gồm 3 tab: OFFERS / FAQ / CONFIG. Trong MVP 1 + Admin sử dụng OFFERS + CONFIG.	Sheet URL + quyền truy cập.
OFFERS schema	offer_id, brand_name, loan_type(enum), apply_url, amount_min/max, term_min/max, apr_min/max, speed_label, conditions_short, pros_1/2/3, is_active, is_featured, featured_weight	Dữ liệu do admin quản trị.
CONFIG tối thiểu	featured_default_weight=0.6; max_offers_shown=3; session_ttl_days=7; language_detection=first_message; cta_tracking=click_only; pii_masking=phone,email,ssn,address,dob; general_hub_url=placeholder	Tab CONFIG.
________________________________________
7) Guardrails & Compliance
Chức năng	Mô tả cụ thể	Đầu vào cần thiết
Không thu PII	AI không hỏi PII. Nếu người dùng tự đưa/hỏi PII → từ chối + hướng dẫn bấm Apply để nhập trên website chính thức.	Template EN/ES.
Mask PII trước khi lưu	Trước khi lưu transcript/log phải mask: số điện thoại, email, SSN/ID pattern, địa chỉ đường phố, ngày sinh.	Regex/pattern list.
Cấm “guaranteed approval”	Không được hứa chắc duyệt; không cam kết lãi/phí/kỳ hạn cố định.	Hard rules.
Prompt injection	Cảnh báo nhẹ + kéo về đúng phạm vi tư vấn loan.	Template EN/ES.
________________________________________

