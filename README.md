# Production-Ready Containerized Inventory & Order Management System

Full-stack implementation using:
- **Backend**: Flask + SQLAlchemy (Python)
- **Frontend**: React + Vite (JavaScript)
- **Database**: PostgreSQL
- **Containers**: Docker + Docker Compose

## Features

### Product Management
- `POST /products`
- `GET /products`
- `GET /products/{id}`
- `PUT /products/{id}`
- `DELETE /products/{id}`

### Customer Management
- `POST /customers`
- `GET /customers`
- `GET /customers/{id}`
- `DELETE /customers/{id}`

### Order Management
- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `DELETE /orders/{id}`

### Dashboard
- `GET /dashboard`
  - total products
  - total customers
  - total orders
  - low stock products (quantity <= 5)

## Business Rules Implemented
- Product SKU must be unique.
- Customer email must be unique.
- Product quantity cannot be negative.
- Orders fail if inventory is insufficient.
- Order placement automatically reduces stock.
- Order total amount is calculated by backend.
- Cancelling/deleting order restores inventory.
- Request validation and proper HTTP status codes are enforced.

## Local Setup (Docker)

1. Copy env file:
```bash
cp .env.example .env
```

2. Run all services:
```bash
docker compose up --build
```

3. Access services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

## API Quick Test
```bash
curl http://localhost:8000/health
```

## Manual (Without Docker)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
gunicorn -w 2 -b 0.0.0.0:8000 app.main:app
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deployment Guide
Detailed guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Submission Checklist
- GitHub repository link
- Docker Hub backend image link
- Live frontend deployment URL
- Live backend API URL
