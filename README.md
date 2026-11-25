# TitikTemu

A mobile-first, responsive campus navigation and opt-in social map web prototype for **Universitas Tarumanagara (UNTAR) Kampus 1** (Jakarta).

Built with **Vite + React + TypeScript + Tailwind CSS + MapLibre GL JS + Zustand** — completely tile-free and API-key-free.

---

## Features

- **Custom Pastel & Illustrated Map (MapLibre GL JS)**
  - No external map tiles, no glyphs, and no API keys required.
  - **2D Top View**, **Overview 3D** (isometric pastel extrusions with roof-lifted pins & vertical floor picker), and **Navigation 3D** (behind-the-user follow camera at `pitch: 66°`, glowing solid route split into walked vs. remaining segments, flat ground heading cone, maneuver arrow + distance bubble, top instruction banner, and arrival card).
  - **Illustrated visual style**: precomputed soft SE shadows, floor bands with glass tint, inset roof caps, deterministic pastel context blocks, warm road curbs, campus paving tint, and Poisson-disc decorative trees that keep clear of all buildings and walking paths.
- **Responsive Single-Tree Layout**
  - **Mobile (`< 768px`)**: edge-to-edge `100dvh` map, floating search bar, bottom sheet (peek/expand/swipe-down), and floating bottom tab bar.
  - **Tablet (`768–1023px`)**: full-screen map with a `340px` floating left panel.
  - **Desktop (`≥ 1024px`)**: `400px` docked left sidebar + edge-to-edge map.
- **Building Cards, Floor Selector & Room Search**
  - Covers the 6 UNTAR Kampus 1 buildings (`Gedung I`, `Gedung M`, `Gedung P`, `Gedung J dan L`, `Gedung K`, `Gedung R`).
  - Horizontally scrollable floor chips (`B1`, `L1..L{n}`), per-floor room lists from [buildingInfo.json](src/data/buildingInfo.json), and live case-insensitive search by building name, initials, or room name.
- **Walking Routes (Dijkstra on OSM Walking Graph)**
  - Pure TypeScript routing engine ([routing.ts](src/lib/routing.ts)) over [paths.json](src/data/paths.json) with binary-heap Dijkstra, equirectangular snapping, and visual distinction for unverified `manual: true` links.
  - Supports **Simulated walk** (`1x`, `3x`, `6x`, play/pause) and **Real GPS** (`navigator.geolocation` within campus bounds + 150 m margin, accuracy filter, smoothing, and 3-fix off-route recalculation).
- **Privacy-First Friends Tab (Mock Repository)**
  - Clean `FriendsRepo` interface ([friendsRepo.ts](src/lib/friendsRepo.ts)) backed by `MockFriendsRepo` so Supabase can drop in later without changing UI components.
  - Enforces all visibility rules in a single function (`isVisibleOnMap`): accepted friendship, `shareOn`, `!ghost`, non-expired, and toggled on in your list.
  - Building-level presence only (never stores or transmits exact GPS coordinates), first-time privacy consent modal, instant Ghost mode, automatic stop after 2 hours (or 60 seconds in `?demo=1`), and one-tap *"Stop sharing and clear my data"*.

---

## Data & Honesty Notes

- **Real geometry**: Building footprints (`src/data/buildings.geojson`), surrounding context footprints (`src/data/context.geojson`), and walking paths (`src/data/paths.json`) are derived from **© OpenStreetMap contributors (ODbL)**.
- **Unverified campus directory**: Room/floor listings in `src/data/buildingInfo.json` were transcribed from the official UNTAR Kampus S Parman map (mapped from old building letters A–H to current names I, M, P, J dan L, K, R) and are marked `verified: false` until confirmed on site. Missing fields (`hours`, `description`, `photo`) display `"Info coming soon"`.
- **Estimated heights**: 3D building heights are visual estimates (`floors × 3.5 m`).
- **Decorative elements**: Trees, shadows, floor bands, roof caps, grass patches, and context building heights/colors are illustrative only.
- **Demo friends**: All users and presence data in the Friends tab are mock demo data and labeled with a **"Demo data"** chip.

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Install & Run
```bash
npm install
npm run dev
```
Open http://localhost:5173/ (or http://localhost:5173/?demo=1 for demo mode: 60-second share auto-stop and 20-second animated friend movement).

### Test & Build
```bash
npm test        # Run Vitest unit tests (routing, navigation, privacy rules)
npm run build   # TypeScript check (tsc -b) + Vite production bundle
```

---

## Feature Flags (`.env` / Environment Variables)

All feature flags default to enabled unless explicitly set to `false`:

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_ENABLE_3D` | `true` | Enables the 2D/3D toggle and 3D fill-extrusion view. |
| `VITE_ENABLE_NAV3D` | `true` | Enables Navigation 3D follow camera (requires `VITE_ENABLE_3D`). |
| `VITE_ENABLE_ILLUSTRATED` | `true` | Enables decorative illustrated map layers (shadows, bands, roofs, trees). |
| `VITE_SHOW_DEV_TOOLS` | `false` | Dev-only controls: `"Flat / Illustrated"` switch and `"Drift 40 m"` off-route test button. |
| `VITE_SHOW_DATA_NOTES` | `false` | Dev-only floor source verification note on Building Cards. |
| `VITE_ENABLE_ADMIN` | `false` | Enables local-only Admin Lite (`#/admin`). **Keep `false` in all public deployments.** |

### Admin Lite (Local Only)
When running locally with `VITE_ENABLE_ADMIN=true` (e.g. in `.env.local`), open `http://localhost:5173/#/admin` to edit `buildingInfo.json`, run validation & graph checks, preview the public building card live, and export JSON or a Markdown validation report.

> **Security Note:** Admin Lite has **no authentication and no backend** — it is **not secure** and must never be enabled on public deployments (`VITE_ENABLE_ADMIN` defaults to `false` so Vite excludes all admin code from public production builds). Real authentication and database persistence will come with Supabase in a later stage.

---

## Project Structure

```text
src/
├── components/          # MapView, Layout, Sidebar, BuildingCard, RoutePanel,
│                        # ArrivalCard, NavBanner, NavGroundMarkers, FriendsPanel,
│                        # FriendPin, FriendCard, PrivacyConsentModal, AddFriendModal,
│                        # PlaceMarker, UserDot, SearchBar, SearchResults,
│                        # ViewModeToggle, VerticalFloorControl, MapControls, BottomTabBar
├── data/                # buildings.geojson, context.geojson, paths.json,
│                        # buildingInfo.json, buildingStyle.json
├── hooks/               # useMediaQuery.ts
├── lib/                 # routing.ts (+ tests), navigation.ts (+ tests),
│                        # friendsRepo.ts (+ tests), illustrated.ts, mapStyle.ts,
│                        # geo.ts, cameraConfig.ts, constants.ts
├── store/               # useAppStore.ts (Zustand)
└── types/               # index.ts
```

---

## Attribution

Map data © OpenStreetMap contributors (ODbL).
