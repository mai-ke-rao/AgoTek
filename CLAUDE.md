# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgoTek is a full-stack web app for managing agricultural production. It has two core features:
1. **Inventory** — field/parcel and activity (Knjiga polja) management per user
2. **IoT device integration** — real-time LoRaWAN data via The Things Network (TTN) and Chirpstack v1, displayed over WebSockets

Live deployment: https://agotek.onrender.com/

## Repository Structure

```
/
├── Backend/      # Node.js/Express API
└── Frontend/     # React + Vite SPA
```

## Backend

**Entry:** `Backend/index.js` → `Backend/App.js`

**Stack:** Express, Mongoose (MongoDB), Socket.IO, JWT auth, bcrypt, dotenv

**Required env vars** (in `Backend/.env`):
- `MONGODB_URI` — MongoDB connection string
- `SECRET` — JWT signing secret
- `PORT` — server port (default 3001)
- `DEVICE_ENC_KEY` — base64-encoded 32-byte key for AES-256-GCM device API key encryption

**Dev commands** (run from `Backend/`):
```bash
npm run dev    # nodemon hot-reload
npm start      # production
```

**API routes:**
| Prefix | Controller | Notes |
|---|---|---|
| `/api/users` | `controllers/users.js` | Registration |
| `/api/login` | `controllers/login.js` | Returns JWT |
| `/api/parcels` | `controllers/parcels.js` | Field/parcel CRUD |
| `/api/activities` | `controllers/activities.js` | Activity CRUD per parcel |
| `/api/TTN` | `controllers/TTN.js` | TTN webhook receiver + device CRUD + downlink |
| `/api/Chirpstack` | `controllers/Chirpstack.js` | Chirpstack webhook + device CRUD |

**Auth flow:** `tokenExtractor` middleware (in `App.js`) pulls the Bearer token from every request. Routes that need user identity call `userExtractor` individually — it resolves the token to a full Mongoose user document and sets `request.user`.

**Device API key security:** Keys are stored encrypted in MongoDB using AES-256-GCM (`utils/cryptoHelper.js`). The `DEVICE_ENC_KEY` env var is the symmetric key. Incoming TTN webhooks are authenticated by comparing the `x-downlink-apikey` header against the decrypted stored key.

**WebSockets:** Socket.IO is mounted on the same HTTP server. `socketAuth` middleware authenticates the handshake token. Clients join a room per `dev_id` (`join-device` event); the TTN/Chirpstack webhook handlers emit `uplink` events to that room when new sensor data arrives.

**Models:**
- `User` — username, passwordHash; virtual relations to Parcel and Device
- `Parcel` — belongs to User
- `Activity` — belongs to Parcel (multiple activity subtypes via `models/activity.js`)
- `Device` (TTN) — dev_id (unique), encrypted apikey, downpush URL, user ref
- `Chirpdev` (Chirpstack) — similar to Device
- `Bucket` — time-series sensor readings (name, value, date_time, dev_id)

## Frontend

**Entry:** `Frontend/src/main.jsx`

**Stack:** React 19, Vite, React Router v7, Redux Toolkit, redux-persist, Axios, Socket.IO client

**Dev commands** (run from `Frontend/`):
```bash
npm run dev     # Vite dev server (http://localhost:5173)
npm run build   # production build
npm run lint    # ESLint
```

**State management:** Redux store has two slices — `activities` and `notification`. Most other state (user, parcels, devices, chosen parcel/device) lives in `App.jsx` and is passed down as props. Auth token and chosen parcel ID are persisted to `localStorage` under `loggedFarmAppUser` and `chosenParcelId`.

**Service layer** (`src/services/`): thin Axios wrappers — `parcels.js`, `activities.js`, `devices.js`, `login.js`, `register.js`, `chirpstack.js`. Each exposes a `setToken()` method called in `App.jsx`'s `useEffect` on login.

**Routing** (defined in `App.jsx`):
- `/` — Pocetna (home, auth-gated)
- `/parcele` — parcel management
- `/aktivnosti` — activities for chosen parcel
- `/uredjaji` — device list
- `/device_menu` — device data/downlink UI
- `/integrations` — add TTN or Chirpstack device
- `/vremenska` — weather
- `/login`, `/registracija`

**Socket.IO (client):** Components that display live device data connect to the backend, authenticate with the stored JWT, and join a `dev_id` room. UI updates arrive via the `uplink` event.

## Key Architectural Notes

- The backend passes the Socket.IO `io` instance through Express via `app.set('io', io)`, allowing route handlers to emit events with `request.app.get('io')`.
- `userExtractor` is applied per-route, not globally — only routes that need it import and use it explicitly.
- Device list endpoint (`GET /api/TTN/device_list`) returns both TTN and Chirpstack devices concatenated, with `apikey_encrypted` cleared before sending.
- Paginated device data: `GET /api/TTN/device_data/:dev_id/:page` — pass a page number for batches of 15 (newest-first), or `all` to return everything (used for search/query views).
- The `Bucket` model stores each sensor variable as a separate document per uplink message.
