# 3C Second-hand Monitoring System

## Folder Structure
- `backend/`: FastAPI application, SQLAlchemy models, and background tasks.
- `frontend/`: React (Vite) frontend with Tailwind CSS and Recharts.
- `venv/`: Python virtual environment.

## Getting Started

### Backend
1. Activate virtual environment: `source venv/bin/activate`
2. Run FastAPI: `uvicorn backend.main:app --reload`

### Frontend
1. Navigate to frontend: `cd frontend`
2. Install dependencies: `npm install` (Note: Run this if you have npm permission issues fixed)
3. Start development server: `npm run dev`

## Initialized Files
- [models.py](file:///Users/huangyuxuan/Documents/git/auto/workspace/backend/models.py): SQLAlchemy models for Category, Model, Spec, MarketPrice, etc.
- [main.py](file:///Users/huangyuxuan/Documents/git/auto/workspace/backend/main.py): FastAPI entry point with WebSocket status monitoring.
- [App.jsx](file:///Users/huangyuxuan/Documents/git/auto/workspace/frontend/src/App.jsx): React routing and page skeletons.
