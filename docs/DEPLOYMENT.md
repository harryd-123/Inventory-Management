# Deployment Guide (Free Platforms)

## 1. Backend Deployment (Render example)

1. Push repository to GitHub.
2. Create new **Web Service** in Render.
3. Choose Docker deployment from `backend/Dockerfile`.
4. Set environment variable:
   - `DATABASE_URL=<managed_postgres_connection_url>`
5. Create Render PostgreSQL instance and use its connection string.
6. Deploy backend and verify:
   - `/health`
   - `/products`
7. Save the backend URL (example: `https://inventory-backend.onrender.com`).

## 2. Frontend Deployment (Vercel example)

1. Import GitHub repo into Vercel.
2. Root directory: `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Set env var:
   - `VITE_API_URL=<your_live_backend_url>`
6. Deploy and verify frontend loads and calls backend.
7. Save the frontend URL (example: `https://inventory-frontend.vercel.app`).

## 3. Docker Hub Backend Image

Build and push:

```bash
docker build -t <dockerhub-username>/inventory-backend:latest ./backend
docker login
docker push <dockerhub-username>/inventory-backend:latest
```

## 4. Alternative free hosts

- Backend: Railway, Fly.io
- Frontend: Netlify (set `VITE_API_URL`)

## 5. Post-Deployment Validation

- Create product/customer/order from UI
- Confirm stock decreases after order
- Confirm order deletion restores stock
- Verify dashboard counters

## 6. Submission Deliverables

Submit these 4 links:

1. GitHub repository URL
2. Docker Hub backend image URL
3. Live frontend URL
4. Live backend API URL
