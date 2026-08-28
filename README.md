<img width="500" height="200" alt="logo" src="https://github.com/user-attachments/assets/395ad2f7-eb1c-429a-83e3-7063bb975426" />
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 64">
  <!-- Fibonacci Tapered Wave with Sharp Crest -->
  <path d="M 16 43 
           C 31 43, 44 36, 44 24 
           C 44 13, 33 8, 26 15 
           C 21 20, 21 26, 25 30 
           C 23 26, 24 21, 28 18 
           C 33 13, 40 17, 40 24 
           C 40 33, 29 39, 16 39 Z" 
        fill="#6b8fd6" />
        
  <!-- Antique Gold Grounding Line -->
  <path d="M 18 49 L 46 49" 
        fill="none" stroke="#c9a96e" stroke-width="1.5" stroke-linecap="round" />
</svg>


# Lethe Chat — Ephemeral, End-to-End Encrypted Chat

Lethe Chat is an ephemeral chat that allows you to chat with others privately and anonymously. 
You don't need an email or a phone number to sign up, and every trace of your account is deleted after a preset expiry time.
Lethe effectively makes it possible for two strangers to chat without ever knowing anything about each other 
besides what they choose to disclose, given that they know each other's username.
Communication is also end-to-end encrypted, so no one besides the two parties can read any messages.

> **Live demo note:** hosted on a free tier, which sleeps after 15 minutes of inactivity —
> the first request after idle time may take 30–60 seconds to respond.


## How Lethe Chat works

- Sign up with just a username and password: no email, no phone number, no verification step.
- Accounts and everything tied to them (sessions, friend requests, queued messages) expire
  automatically after a preset period, enforced with Redis TTLs.
- Messages are end-to-end encrypted: the server relays ciphertext it cannot read, using
  public-key encryption (libsodium/`crypto_box`) with keys generated and held entirely client-side.
- Real-time delivery over WebSockets (Socket.IO), with offline users' messages queued (in redis) and
  delivered on their next reconnect.


## Why I built it this way (architecture decisions)

- **Redis as the only datastore, no relational database.** Every piece of data in this app
  (accounts, sessions, friend requests, message queues) has a natural expiry, and Redis's native
  TTL support enforces that. Using a second database for anything permanent would have
  contradicted the app's premise.
- **Ephemeral accounts, TTL-linked to activity.** An account's Redis keys (credentials, sessions,
  friend requests, inbox) all derive their expiry from the same source, set on user creation/login, 
  so the user expires automatically, with no need to manually delete his account information.
- **Socket.IO over raw WebSockets.** I evaluated `ws` (see [trade-off notes](#))
  and chose Socket.IO deliberately for its built-in room management, acknowledgment callbacks
  (used for delivery confirmation, see below), and Redis-adapter path to horizontal scaling —
  reimplementing those on raw `ws` would've meant more time spent reinventing the wheel instead 
  of actually building the app.
- **Delivery confirmation via `emitWithAck`, not a message queue.** Undelivered messages
  (recipient offline) fall back to a Redis list acting as an inbox, drained and acknowledged on
  the recipient's next connection. A full message broker (RabbitMQ/Kafka) would have been the
  wrong tool, it'd be overengineering.
- **Server never sees plaintext messages.** Public keys are generated client-side and never
  leave the device as private keys; the server's only job is storing/relaying public keys and
  opaque ciphertext blobs.

## Known limitations & things I'd do differently at larger scale

- Single Redis instance, no replication. A production deployment would need Sentinel or a
  managed Redis with failover.
- Delivery-confirmation logic assumes a single active connection per user; 
- Encryption uses static per-account keypairs, not a full Double Ratchet. Correct E2E, but
  without forward secrecy. Since accounts are naturally ephemeral, forward secrecy is not as consequential. 
  For forward secrecy, something like `libsignal` would've been used.
- No horizontal scaling configured (would need the Socket.IO Redis adapter, already compatible
  with the existing Redis usage).

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js, TypeScript |
| Real-time | Socket.IO |
| HTTP | Express |
| Data store | Redis (sessions, accounts, friend graph, message queues) |
| Auth | `express-session` + `connect-redis`, `bcrypt` |
| Encryption | `libsodium-wrappers` (`crypto_box`, client-side) |
| Validation | Zod |
| Logging | Pino (structured JSON) |
| Metrics | `prom-client` (Prometheus-compatible `/metrics`) |
| Frontend (demo) | Next.js |

## Architecture

```
Client (Next.js)
   │  HTTPS / WSS
   ▼
┌─────────────────────────────┐
│   Express + Socket.IO        │
│   - session auth middleware  │
│   - REST: signup/login       │
│   - sockets: messages,       │
│     friend requests, keys    │
└──────────────┬────────────────┘
               │
               ▼
        ┌─────────────┐
        │    Redis     │
        │ accounts     │
        │ sessions     │
        │ friend graph │
        │ msg inbox    │
        └─────────────┘
```


## Getting started

### Prerequisites
- Node.js 20+
- Docker (for local Redis)

### Setup
```bash
git clone <repo-url>
cd <repo>

# backend
cd backend
cp .env.example .env   # fill in values, see below
npm install
docker run -d -p 6379:6379 redis:alpine --notify-keyspace-events Ex
npm run dev

# frontend
cd ../frontend-test
npm install
npm run dev
```

### Environment variables
Backend .env:

See `.env.example` for the full list. Key ones:

| Variable | Description |
|---|---|
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Random secret for signing session cookies — generate with `openssl rand -hex 32` |
| `USER_TTL_SECONDS` | How long an inactive account (and everything tied to it) stays alive in seconds |
| `PORT` | Server port |



Frontend .env:

See `.env.example` for the full list. Key ones:

| Variable | Description |
|---|---|
| `BACKEND_URL` | Local-only backend URL used by the custom dev frontend server when proxying `/api/*` and `/socket.io` requests |
| `NEXT_PUBLIC_BACKEND_URL` | Production frontend URL used to call the backend directly from the browser (Vercel, Render, etc.) |
| `HOST` | Network interface for the custom frontend server to bind to; use `0.0.0.0` to allow access from other devices on the local network |
| `PORT` | Frontend server port |
| `NEXT_PUBLIC_MESSAGE_TTL_HOURS` | How long locally stored encrypted messages are retained in the browser, in hours |

## Socket events

| Event | Direction | Description |
|---|---|---|
| `message:send` | client → server | Send an encrypted message |
| `message:incoming` | server → client | Deliver a message (with ack) |
| `inbox:incoming` | server → client | Deliver queued messages on reconnect (with ack) |
| `friend:request` / `friend:accept` / `friend:decline` | client → server | Friend request flow |
| `friend:incoming` / `friend:accepted` / `friend:rejected` | server → client | Friend request notifications |
| `public-key:register` / `public-key:get` | client ↔ server | Public key exchange for E2E encryption |

## Observability

- **`GET /health`** — liveness + Redis connectivity check
- **`GET /metrics`** — Prometheus-compatible metrics (HTTP latency, socket event duration,
  message delivery latency, default Node process metrics). Not connected to a live
  Prometheus/Grafana stack in the deployed demo — see `docker/` for a local
  `docker-compose --profile monitoring up` to visualize.
- Structured JSON logging via Pino, centralized through error-handling middleware rather than
  scattered per-function.

## Testing

Run with:
```bash
npm test                  # single run
npm run test:watch        # watch mode
npm run test:unit         # only unit tests
npm run test:integration  # only integration tests
npm run test:coverage     # with coverage report
```

Built with [Vitest](https://vitest.dev), split into two layers:

## Coverage:
Integration tests have over 90% coverage.

Deliberately out of scope: exhaustive per-handler socket tests (the handlers themselves are
thin plumbing over already-tested services) and testing Socket.IO's transport layer itself.
