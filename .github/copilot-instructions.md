# Lethe Chat: Copilot Instructions

**Lethe Chat** is a full-stack end-to-end encrypted chat application with a monorepo structure containing a Node.js/Express backend and Next.js 16 frontend with Socket.IO real-time messaging.

---

## Build, Test & Lint

### Backend (Express + TypeScript)

**Development:** `cd backend && npm run dev`
- Runs with `nodemon` and `tsx` for hot-reload

**Build:** `cd backend && npm run build`
- Compiles TypeScript to `dist/` via tsc

**Start (production):** `cd backend && npm start`
- Runs compiled code from `dist/index.js`

**Lint:** `cd backend && npx eslint .`
- ESLint with TypeScript-eslint config; flat config format (`eslint.config.js`)

### Frontend (Next.js 16 + React 19)

**Development:** `cd frontend-test && npm run dev`
- Custom server via `server.ts` with HTTP proxy to backend
- Binds to `0.0.0.0` (all interfaces) by default; configure via `HOST` in `.env`
- Frontend proxies `/api/*` and `/socket.io` to backend (see `server.ts`)
- Default port: `3001` (backend: `3000`)

**Build:** `cd frontend-test && npm run build`
- Next.js build with type-checking

**Start (production):** `cd frontend-test && npm start -- --production`
- Runs `server.ts` with `--production` flag for optimized behavior

**Lint:** `cd frontend-test && npx eslint`
- ESLint with next/core-web-vitals and typescript configs; flat config format (`eslint.config.mjs`)

### Running both servers locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend-test && npm run dev
```

Access frontend at `http://localhost:3001` (or your LAN IP + :3001)

---

## High-Level Architecture

### Backend (`backend/src/`)

- **MVC + Service Layer:** Controllers handle HTTP/WebSocket logic; services contain business logic
- **Session & Auth:**
  - Express sessions stored in Redis via `connect-redis`
  - Session middleware in `session.ts` attached to all requests
  - Password hashing with bcrypt; usernames validated via Zod schemas
- **Real-Time:** Socket.IO server (same HTTP instance as Express) in `sockets/`
  - Room-based architecture for chat conversations
  - User expiry listener monitors Redis for session expirations
- **Config:** Environment variables validated at startup via Zod in `config/env.ts`; missing or invalid vars crash the app
- **Error Handling:** Custom `AppError` class for HTTP errors; `errorHandler` middleware catches and returns JSON responses

### Frontend (`frontend-test/src/`)

- **App Router (Next.js 16):** Modern app directory structure with client/server components
- **Auth Context:** `useAuth` hook provides authentication state and login/logout methods
- **Socket.IO Client:** `getSocket()` in `lib/socket.ts` manages the single app-wide Socket.IO client with manual connection control
- **Custom Server:** `server.ts` wraps Next.js with HTTP proxy; routes `/api/*` and `/socket.io` to backend
- **Component Structure:**
  - `components/auth/` — signup/login forms
  - `components/chat/` — chat UI and messaging components
  - `hooks/` — `useAuth`, `useChat` for shared state

---

## Key Conventions

### Backend

1. **Zod for Validation:** Request body/query validation uses Zod schemas; invalid requests return 400 with "Invalid request data"
2. **Service Layer Pattern:** All business logic goes in `services/`; controllers call services, never implement logic directly
3. **Error Handling:** Throw custom `AppError` with status code; errorHandler catches and responds with JSON
4. **Async/Await:** All async operations use native async/await; import from node modules with `.js` extension (ESM)
5. **Redis:** Environment variable `REDIS_URL` required at startup; session data + user expiry tracking via Redis

### Frontend

1. **React 19 + TypeScript:** Use the latest React features (server components, Suspense, etc.)
2. **"use client" Directive:** Components using hooks/context must have `"use client"` at the top
3. **Socket.IO Manual Connection:** Call `getSocket().connect()` in auth provider after login; disconnect on logout
4. **TypeScript Path Alias:** `@/*` resolves to `src/`; use it for clean imports (not relative paths)
5. **App Router:** All routes under `src/app/`; layout.tsx wraps the tree; pages are default exports
6. **Next.js 16 Breaking Changes:** May differ from older docs; read `node_modules/next/dist/docs/` before major API use (see AGENTS.md note)

### Both

- **TypeScript Strict Mode:** Both enabled; no `any` without justification
- **ESM Modules:** Backend uses `type: "module"` in package.json; all imports must use `.js` extension
- **Environment Files:** Backend uses `.env` (validated at startup); frontend uses `.env` (loaded by `server.ts`)

---

## Important Notes

- **No Tests:** No test framework configured (jest/vitest); testing must be manual or added as a separate task
- **Port Conflict:** Backend defaults to `3000`, frontend to `3001`; update `BACKEND_URL` in frontend `.env` if backend is on a different port
- **Session Cookies:** Frontend proxies `/api/*` and `/socket.io` to backend; session cookie is automatically attached to requests
- **User Expiry:** Backend monitors Redis keys for user session expiration via `listenForUserExpiry()` in `sockets/expiry-listener.ts`
