# 🎰 Casino Gaming Platform

A modern, full-stack casino gaming and betting platform built with **React + TypeScript** (frontend) and **Python FastAPI** (backend).

## ✨ Features

- **Multiple Games** — Blackjack, Roulette, Slots, Poker, and more
- **Real Money Wallet** — ACID-compliant transaction system with event sourcing
- **User Authentication** — JWT-based auth with refresh tokens
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Dark Theme** — Premium casino aesthetic
- **Secure** — Server-side RNG, provably fair ready

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL 16, Redis 7 |
| Auth | JWT (access + refresh tokens), bcrypt |

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (for PostgreSQL + Redis)

### 1. Clone & Install

```bash
# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Services

```bash
# Start PostgreSQL and Redis
cd ../docker
docker-compose up -d postgres redis
```

### 3. Run Database Migrations

```bash
cd ../backend
alembic upgrade head
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit **http://localhost:5173** to see the app.

## 📁 Project Structure

```
casino-platform/
├── frontend/            # React + Vite + TypeScript
│   ├── src/
│   │   ├── api/         # API client
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   └── store/       # Zustand state stores
├── backend/             # Python FastAPI
│   ├── app/
│   │   ├── api/         # Route handlers
│   │   ├── core/        # Config, auth, middleware
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   └── games/       # Game engines
│   └── migrations/      # Alembic DB migrations
├── docker/              # Docker Compose configs
└── shared/              # Shared types/utilities
```

## 📚 API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🔒 Security Notes

- Never use the `SECRET_KEY` from `.env` in production
- Configure `CORS_ORIGINS` for your production domain
- Enable HTTPS with TLS 1.3
- Set up proper KYC/AML before real-money operations
- Consult a gaming attorney for regulatory compliance

## ⚖️ License

For educational and development purposes only.
Real-money gambling requires proper licensing and compliance.
# 247vegas
