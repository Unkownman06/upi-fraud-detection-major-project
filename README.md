# UPI Fraud Sentinel

A full-stack UPI fraud detection system with per-user data isolation, real-time detection, CSV upload/download, and JWT + Email OTP authentication.

---

## Project Structure

```
manav/
├── backend/          # Django + DRF backend
│   ├── core/         # Django project settings & URLs
│   ├── frauds/       # Main app: models, views, ML model
│   ├── manage.py
│   ├── requirements.txt
│   └── .env          # Email credentials (see below)
└── frontend/
    └── upi-fraud-ui/ # Next.js frontend
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- pip

---

## Backend Setup

```bash
cd manav/backend

# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure email in .env (for OTP login)
#    Edit .env and set:
#    EMAIL_HOST_USER=your_gmail@gmail.com
#    EMAIL_HOST_PASSWORD=your_app_password

# 4. Apply migrations
python manage.py migrate

# 5. (Optional) Create a superuser for Django admin
python manage.py createsuperuser

# 6. Start the development server
python manage.py runserver
```

Backend runs at: http://127.0.0.1:8000

---

## Frontend Setup

```bash
cd manav/frontend/upi-fraud-ui

# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Frontend runs at: http://localhost:3000

---

## Features

### Authentication
- Email OTP login (no password required)
- JWT access tokens (24h) + refresh tokens (7 days)
- Automatic token refresh on expiry

### User-Specific Data
- Every transaction is linked to the logged-in user via `user_id` (FK on `Transaction` model)
- All API endpoints filter by `request.user` — users cannot access each other's data
- New users are automatically created on first OTP login

### Fraud Detection
- Random Forest ML model scores every transaction
- Results saved to DB with fields: `transaction_id`, `amount`, `sender`, `receiver`, `fraud_status`, `date`
- Real-time alerts via Server-Sent Events (SSE)

### CSV Upload
- Upload your own transaction CSV for batch processing
- Processed in a background thread; dashboard updates live

### CSV Download *(newly added)*
- Click **⬇ Download CSV** in the dashboard top bar
- Downloads only the logged-in user's **fraud** transactions
- File is named `fraud_transactions_<user_id>.csv`
- Fields: `transaction_id`, `amount`, `sender`, `receiver`, `fraud_status`, `date`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp/` | Send OTP to email |
| POST | `/api/auth/verify-otp/` | Verify OTP → returns JWT |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| POST | `/api/predict/` | Run fraud detection on a transaction |
| GET  | `/api/transactions/` | List user's transactions (paginated) |
| GET  | `/api/transactions/<id>/` | Transaction detail |
| GET  | `/api/stats/` | Dashboard stats for user |
| GET  | `/api/stream/` | SSE stream (fraud/suspicious alerts) |
| POST | `/api/upload-csv/` | Batch upload transactions via CSV |
| GET  | `/api/download-csv/` | **[NEW]** Download user's fraud transactions as CSV |

---

## Modified Files

| File | Change |
|------|--------|
| `backend/frauds/views.py` | Added `import csv`, `HttpResponse` import, and new `download_csv` view |
| `backend/frauds/urls.py` | Registered `download-csv/` URL route |
| `frontend/upi-fraud-ui/src/app/page.tsx` | Added `csvDownloading` state, `handleDownloadCsv` function, and Download CSV button |

---

## Notes

- The `Transaction` model already had a `user` FK from the existing codebase — no new migrations needed.
- All existing endpoints already filter by `request.user` — user isolation was already in place.
- The download endpoint streams CSV directly from the database without creating temp files.
