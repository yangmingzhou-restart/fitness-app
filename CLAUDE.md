# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Smart fitness app with food calorie recognition + workout tracking + analytics. Two-stage plan: MVP (functional now) → cloud deployment.

## Start up

Three terminal windows, in order:

```
# Terminal 1: Backend (keep running)
cd backend && D:\Anaconda3\python.exe -u main.py
# Listens on 0.0.0.0:8000, initializes SQLite on startup, serves /videos static files

# Terminal 2: ngrok (start after backend is up)
ngrok http 8000
# Copy the https://xxxx.ngrok-free.app forwarding URL

# Terminal 3: Frontend (start after ngrok)
cd frontend && set EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app && npx expo start
# Scan QR code with Expo Go on phone
```

Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`.

## Architecture

### Backend (Python FastAPI)

```
backend/
├── main.py                  # FastAPI entry, CORS, lifespan (init DB), StaticFiles mount at /videos
├── config.py                # Settings from .env (API key, engine, DB path, port)
├── engines/                 # Pluggable AI engines (strategy pattern)
│   ├── base.py              #   BaseEngine ABC: async analyze(images, language) → List[FoodItem]
│   ├── qwen_engine.py       #   Qwen3-VL-Plus via DashScope — currently active (now returns macros)
│   ├── gemini_engine.py     #   Gemini 2.0 Flash — stub
│   ├── openai_engine.py     #   GPT-4V — stub
│   └── ml_engine.py         #   Local ML — stub
├── services/
│   ├── analyzer.py          # AnalyzerService: selects engine, calls it, computes totalCalories + totalMacros
│   └── history_service.py   # HistoryService: save/get food analysis with macros
├── routers/
│   ├── analyze.py           # POST /analyze — food recognition
│   ├── history.py           # GET /history — paginated food records
│   ├── exercises.py         # GET /exercises, GET /exercises/{id} — exercise library with search/filter
│   ├── records.py           # POST/GET/DELETE /exercise-records — workout logging
│   ├── plans.py             # POST/GET /plans — workout plan templates
│   └── analytics.py         # GET /analytics/summary — training frequency + muscle group distribution
├── database/
│   ├── connection.py        # SQLite schema: analysis_history, exercise_records, exercise_plans
│   ├── crud.py              # Food analysis CRUD (now includes macros column)
│   └── crud_exercise.py     # Exercise record + plan CRUD
├── models/
│   ├── analysis.py          # Macros, FoodItem (with macros), AnalysisResult (with totalMacros)
│   └── history.py           # HistoryRecord, HistoryListResponse
├── utils/image.py           # PIL-based compress_image, create_thumbnail
├── TrainingVideos/          # Exercise video library
│   ├── exercises.json       # 200+ exercise metadata database
│   └── 哑铃弯举/            # Example exercise with 侧面.mp4, 背面.mp4, 封面.png
├── data/                    # SQLite DB stored here (gitignored)
└── .env                     # DASHSCOPE_API_KEY, ANALYSIS_ENGINE=qwen
```

### Frontend (React Native Expo SDK 55 + TypeScript)

```
frontend/
├── App.tsx                            # Root: StatusBar + i18n init + AppNavigator
└── src/
    ├── navigation/AppNavigator.tsx    # Stack (Root) + Tab (Home/History/Analytics) via React Navigation
    ├── screens/
    │   ├── HomeScreen.tsx             # Module hub with 5 feature cards (2-column grid)
    │   ├── CameraScreen.tsx           # Camera + photo review + multi-shot (max 4)
    │   ├── ResultScreen.tsx           # Compact result: food chips, total cal, MacroBar, ServingSelector
    │   ├── HistoryScreen.tsx          # FlatList of past food analyses
    │   ├── exercise/
    │   │   ├── ExerciseRecordScreen.tsx  # Date-based workout log with editable sets
    │   │   ├── ExerciseLibraryScreen.tsx # Search + muscle group filter + 200+ exercises
    │   │   ├── ExerciseDetailScreen.tsx  # Cover image + video demos + tips
    │   │   └── PlanScreen.tsx            # Pre-built workout plans by muscle group
    │   └── analytics/
    │       └── AnalyticsScreen.tsx    # Training frequency chart + muscle group donut chart
    ├── components/
    │   ├── MacroBar.tsx               # Protein/carbs/fat 3-color segmented bar
    │   ├── ServingSelector.tsx        # ± stepper with presets (0.5, 1, 2, 3, 4)
    │   └── DonutChart.tsx             # Pure RN View donut chart with legend
    ├── services/
    │   ├── api.ts                     # All API calls + TypeScript types (macros, exercise, analytics)
    │   └── storage.ts                 # expo-file-system JSON persistence for offline data
    ├── config/
    │   ├── api.ts                     # API_BASE_URL, ENDPOINTS, getVideoUrl(), getCoverUrl()
    │   └── muscleGroups.ts            # Muscle group definitions with colors
    └── i18n/
        ├── index.ts                   # i18next init (zh default, en fallback)
        ├── zh.json                    # Full Chinese translations (home, exercise, analytics)
        └── en.json                    # Full English translations
```

**Navigation flow:**
- Tab Navigator: Home | History | Analytics
- Stack screens: Camera → Result, ExerciseLibrary → ExerciseDetail, ExerciseRecord, Plan
- Home cards navigate to respective stack/tab screens

## Key data models

**Food analysis:** `AnalysisResult { foods: FoodItem[], totalEstimatedCalories, totalMacros: Macros }`
`Macros { proteinG, carbsG, fatG, proteinGPer100g, carbsGPer100g, fatGPer100g }`

**Exercise:** `ExerciseRecord { id, exerciseName, muscleGroup, date, sets: [{weight, reps, rpe, completed}], notes }`

**Muscle group colors:** chest=#E74C3C, back=#3498DB, legs=#2ECC71, shoulders=#F39C12, arms=#9B59B6, core=#1ABC9C

## Key constraints

- Max 4 photos per food analysis, max 10MB each, compressed to 1024px before AI
- AI engine returns macros per 100g + total per estimated weight
- SQLite is local (backend/data/). Uses raw sqlite3, no ORM.
- Frontend local storage uses expo-file-system JSON files in `documentDirectory/fitness_data/`
- Exercise video auto-discovery: any folder in TrainingVideos/ with .mp4 files shows up in GET /exercises
- Static files served at /videos/ via FastAPI StaticFiles mount
- .env contains live API key — never commit
- Anaconda Python at `D:\Anaconda3\python.exe`

## Tech stack summary

| Layer | Tech |
|-------|------|
| AI Engine | Qwen3-VL-Plus (DashScope, OpenAI-compatible API) |
| Backend | Python FastAPI + Uvicorn |
| Database | SQLite (raw sqlite3) |
| Frontend | React Native (Expo SDK 55) + TypeScript |
| Navigation | @react-navigation/native-stack + bottom-tabs |
| Camera | expo-camera |
| Video | expo-av |
| i18n | i18next + react-i18next |
| Tunnel | ngrok (free tier) |
| Image processing | Pillow |
| Local storage | expo-file-system |
