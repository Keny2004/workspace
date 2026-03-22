#!/bin/bash

# Configuration
PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$PROJECT_ROOT/venv"

# Function to stop services
stop_services() {
    echo "Stopping 3C Monitoring System services..."
    # Find and kill FastAPI (uvicorn)
    pkill -f "uvicorn backend.main:app"
    # Find and kill Vite
    pkill -f "vite"
    echo "Services stopped."
}

# Function to start services
start_services() {
    echo "Starting 3C Monitoring System..."

    # 1. Start Backend
    echo "Starting Backend (FastAPI)..."
    source "$VENV_DIR/bin/activate"
    cd "$PROJECT_ROOT"
    nohup env PYTHONUNBUFFERED=1 venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
    
    # 2. Start Frontend
    echo "Starting Frontend (Vite)..."
    cd "$FRONTEND_DIR"
    nohup npm run dev > ../frontend.log 2>&1 &

    echo "Services started in the background."
    echo "Backend: http://localhost:8000"
    echo "Frontend: http://localhost:3000"
    echo "Logs are available in backend.log and frontend.log"
}

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
esac

exit 0
