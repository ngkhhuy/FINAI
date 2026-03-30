# FINAI – AI Loan Advisor

Chatbot tư vấn vay vốn thông minh: hỏi vài câu, phân tích nhu cầu, gợi ý sản phẩm vay phù hợp từ Google Sheets.

🌐 **Live**: [lendoraai.site](https://lendoraai.site)

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| AI | Google Gemini 2.5 Flash |
| Data | Google Sheets (Service Account JWT) |
| Hosting | AWS Elastic Beanstalk (Node.js 24, Amazon Linux 2023) |
| CDN / DNS | Cloudflare |

---

## Cấu trúc dự án

```
FINAI/
├── backend/          # Express API server (TypeScript)
│   └── src/
│       ├── config/   # env validation (zod)
│       ├── controllers/
│       ├── middleware/
│       ├── routes/   # /api/chat, /api/offers, /api/admin, /api/tracking
│       ├── services/ # ai.service, sheets, chat, session, routing
│       ├── types/
│       └── utils/
├── frontend/         # React SPA
│   └── src/
│       ├── components/chat/
│       ├── pages/
│       ├── hooks/
│       ├── lib/
│       └── locales/  # en.json, es.json
├── scripts/
│   └── build-and-zip.ps1  # Build & deploy script
├── .ebextensions/    # AWS EB config
├── .ebignore
└── Procfile
```

---

## Cài đặt & Chạy local

### Yêu cầu
- Node.js 20+
- npm

### 1. Clone & cài dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Tạo file `.env` trong `backend/`

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080

GEMINI_API_KEY=your_gemini_api_key

SPREADSHEET_ID=your_google_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY_BASE64=your_base64_encoded_private_key

SESSION_TTL_DAYS=7
FEATURED_DEFAULT_WEIGHT=0.6
ADMIN_API_KEY=your_admin_key
```

> **Tạo `GOOGLE_PRIVATE_KEY_BASE64`**: Encode private key từ service account JSON:
> ```bash
> node -e "const k=require('./service-account.json').private_key; console.log(Buffer.from(k).toString('base64'))"
> ```

### 3. Chạy

```bash
# Terminal 1 — Backend (port 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (port 8080)
cd frontend && npm run dev
```

---

## API Endpoints

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/api/chat/message` | Gửi tin nhắn chat |
| `GET` | `/api/offers` | Lấy danh sách offers |
| `GET` | `/health` | Health check |
| `POST` | `/api/tracking/click` | Ghi nhận click affiliate |
| `GET/PUT` | `/api/admin/offers` | Quản lý offers (cần `ADMIN_API_KEY`) |

---

## Deploy lên AWS Elastic Beanstalk

### Build & tạo ZIP

```powershell
cd scripts
.\build-and-zip.ps1
```

Script sẽ:
1. Build backend TypeScript → `backend/dist/`
2. Build frontend Vite → copy vào `backend/dist/public/`
3. Prune dev dependencies
4. Đóng gói thành `finai-deploy.zip`

### Deploy

```bash
eb deploy --label v1-description
```

### Biến môi trường trên EB Console

Vào **Configuration → Software → Environment properties** và thêm tất cả các biến từ file `.env` phần trên.

> **Lưu ý quan trọng**: Dùng `GOOGLE_PRIVATE_KEY_BASE64` thay vì `GOOGLE_PRIVATE_KEY` để tránh lỗi format khi EB Console xử lý ký tự `\n`.

---

## Google Sheets

Spreadsheet cần có 2 tab:

### Tab `OFFERS`

| Cột | Mô tả |
|-----|-------|
| `offer_id` | ID duy nhất |
| `brand_name` | Tên thương hiệu |
| `loan_type` | `personal` / `business` / `auto` / `home` |
| `amount_min` / `amount_max` | Số tiền vay (USD) |
| `term_min` / `term_max` | Kỳ hạn (tháng) |
| `apr_min` / `apr_max` | Lãi suất (%) |
| `apply_url` | Link đăng ký |
| `speed_label` | VD: "Same day" |
| `conditions_short` | Điều kiện ngắn |
| `pros_1` / `pros_2` / `pros_3` | 3 ưu điểm |
| `is_active` | `true` / `false` |
| `is_featured` | `true` / `false` |
| `featured_weight` | 0.0 – 1.0 |

### Tab `CONFIG`

| key | value |
|-----|-------|
| `max_offers_shown` | `3` |

---

## Luồng Chat

```
User message
    ↓
AI (Gemini) phân tích → trích xuất: purpose, urgency, amount_bucket
    ↓
Khi đủ 3 field → Google Sheets → lọc & xếp hạng offers
    ↓
Trả về: tin nhắn AI + danh sách OfferCard
```

Project đang được triển khai tại : Lendoraai.site 