# Transfer Window Simulation

**Transfer Window Financial Simulator for managing financial fairplay (FFP) compliance and transfer impact analysis.**

A full-stack application that enables users to simulate transfer scenarios, analyze financial impact, and understand FFP (Financial Fair Play) implications for football clubs.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)

---

## 🎯 Overview

Transfer Window Simulator is a sophisticated tool for football club management, enabling users to:

- Simulate player transfers (buy, sell, loan in, loan out)
- Calculate FFP compliance impact
- Analyze squad composition and financial implications
- Track salary structures and budget constraints

The application supports **4 access levels** with progressive permissions:

- 🔓 **Anonymous/Public** - Search clubs, view squads, view FFP dashboards
- 👤 **User** - Save simulations, manage profile
- 🎯 **Sport Director** - Set private salaries, accurate FFP calculations
- 🔐 **Admin** - User management, force data syncs

---

## Features

### Core Functionality

- **Real-time Transfer Simulation** - Model different transfer scenarios instantly
- **FFP Impact Analysis** - Understand financial fair play compliance
- **Squad Management** - View and modify club squads
- **Salary Management** - Track and adjust player salaries
- **Historical Data** - Integrate real player and club data
- **Multi-source Integration** - API Football, Capology, Apify scraping

### Data Integration

- **API Football** - Real player and club data
- **Capology** - Salary estimates and historical data
- **Apify** - Web scraping for additional data sources
- **MongoDB Atlas** - Scalable data persistence
- **Redis** - Caching and real-time updates

### AI & Analysis

- **Groq LLM** - AI-powered analysis and insights
- **Google Generative AI** - Additional AI capabilities
- **Advanced Charts** - React-based visualization

## Tech Stack

### Backend ( Python)

```
Framework:       FastAPI 0.111.0
Server:          Uvicorn 0.29.0
Database:        MongoDB (Motor 3.5.1, PyMongo 4.8.0, Beanie 1.25.0)
Cache:           Redis 5.0.4
Authentication:  Python-Jose, Passlib, BCrypt
Task Queue:      Celery 5.4.0
Data Parsing:    BeautifulSoup4, lxml
Web Scraping:    Apify Client
AI Integration:  Groq, Google Generative AI
Testing:         Pytest, Pytest-asyncio
```

### Frontend (TypeScript)

```
Framework:       Next.js 15.2.4
Runtime:         React 19.0.0
Styling:         Tailwind CSS 3.4.17
UI Components:   Custom components with Lucide icons
Forms:           React Hook Form with Zod validation
Data Fetching:   TanStack React Query 5.67.2
Animation:       Framer Motion 12.5.0
Charts:          Recharts 2.15.0
Theme:           Next Themes
TypeScript:      5.8.2
```

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
│  - User Interface  - Forms  - Real-time Updates  - Dashboards   │
│  (http://localhost:3000)                                        |
└────────────────────────┬────────────────────────────────────────┘
                         │ (HTTP/REST)
                         ↓
┌──────────────────────────────────────────────────────────────────
│                    Backend (FastAPI)                             │
│  - API Endpoints  - Authentication  - Business Logic             │
│  - Data Processing  - FFP Calculations                           │
│  (http://localhost:8000)                                         │
└────────┬─────────────────┬──────────────────────┬────────────────┘
         │                 │                      │
         ↓                 ↓                      ↓
    ┌─────────┐      ┌──────────┐          ┌──────────┐
    │ MongoDB │      │  Redis   │          │ External │
    │ Atlas   │      │ (Cache)  │          │   APIs   │
    │ (Data)  │      │          │          │          │
    └─────────┘      └──────────┘          └──────────┘
```

### Backend Structure

```
backend/
├── app/
│   ├── main.py                # Application entry point
│   ├── core/
│   │   ├── config.py          # Configuration management
│   │   └── database.py        # MongoDB connection
│   ├── api/
│   │   └── v1/
│   │       ├── router.py      # API routes
│   │       └── endpoints/     # Endpoint handlers
│   ├── schemas/               # Pydantic models
│   ├── services/              # Business logic
│   ├── integrations/          # External APIs
│   │   └── clients/           # API clients
│   ├── utils/                 # Utility functions
│   └── models/                # Database models
├── tests/                     # Test suite
├── requirements.txt           # Python dependencies
└── Dockerfile                 # Docker configuration
```

### Frontend Structure

```
frontend/
├── app/                       # Next.js App Router
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   ├── admin/                # Admin pages
│   ├── clubs/                # Club pages
│   ├── players/              # Player pages
│   ├── simulations/          # Simulation pages
│   └── auth/                 # Authentication pages
├── components/               # React components
│   ├── ui/                  # Reusable UI components
│   ├── charts/              # Chart components
│   ├── player/              # Player-related components
│   ├── squad/               # Squad management
│   └── simulation/          # Simulation components
├── lib/
│   ├── api/                 # API client
│   ├── auth/                # Authentication logic
│   └── utils/               # Utility functions
├── public/                  # Static assets
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── tailwind.config.js      # Tailwind CSS config
└── next.config.js          # Next.js config
```

## Installation

### Prerequisites

- **Docker & Docker Compose** (recommended)
- **Node.js 22+** (for local frontend development)
- **Python 3.12+** (for local backend development)
- **Git**

### Option 1: Docker

```bash
# Clone repository
git clone https://github.com/almatmz/Transfer-Window-Simulation.git
cd Transfer-Window-Simulation

# Create .env file in backend/

# Build images
docker-compose build

# Start services
docker-compose up -d

# Access applications
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Option 2: Local Development

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file

# Run server
uvicorn app.main:app --reload
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## Configuration

### Environment Variables

#### Backend (`backend/.env`)

```env
# App Configuration
APP_ENV=development
APP_NAME=Transfer Window Simulator
APP_VERSION=3.0.0

# Database
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/
DATABASE_NAME=transfer_simulator

# Authentication
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# External APIs
API_FOOTBALL_KEY=your-api-key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
CAPOLOGY_BASE_URL=https://www.capology.com
SCRAPE_CACHE_TTL_HOURS=24

# AI APIs
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
APIFY_API_TOKEN=your-apify-token
```

#### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Transfer Window Simulator
```

---

## 🚀 Running the Application

### With Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Access Points

| Service       | URL                         | Purpose              |
| ------------- | --------------------------- | -------------------- |
| Frontend      | http://localhost:3000       | Web application      |
| Backend API   | http://localhost:8000       | REST API             |
| API Docs      | http://localhost:8000/docs  | Interactive API docs |
| ReDoc         | http://localhost:8000/redoc | API documentation    |
| Mongo Express | http://localhost:8081       | MongoDB UI           |

---

## API Documentation

### Interactive Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Health Check

```bash
curl http://localhost:8000/
# Response: {"status":"ok","version":"3.0.0"}
```

### Key API Endpoints (Examples)

#### Search Clubs

```bash
GET /api/v1/clubs/search?query=Manchester
```

#### Get Club Squad

```bash
GET /api/v1/clubs/{clubId}/squad
```

#### Get FFP Analysis

```bash
GET /api/v1/clubs/{clubId}/ffp
```

#### Create Simulation

```bash
POST /api/v1/simulations
{
  "club_id": "123",
  "transfers": [
    {
      "type": "buy",
      "player_id": "456",
      "fee": 50000000,
      "wage": 250000
    }
  ]
}
```

#### Get Simulation Results

```bash
GET /api/v1/simulations/{simId}
```

---

## Performance Metrics

- **Frontend**: Next.js 15 with optimized bundle
- **Backend**: Async FastAPI with MongoDB indexing
- **Caching**: Redis for frequently accessed data
- **Rate Limiting**: Implemented on all endpoints
- **Database**: MongoDB Atlas with sharding support
