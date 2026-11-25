import type { LngLat } from '../types';

/**
 * Fixed demo user position near the main campus road (node n3, west of Gedung I).
 * Kept in memory only; never persisted or transmitted.
 */
export const DEMO_USER_POSITION: LngLat = [106.7887265, -6.1687792];

/** Margin in meters around the 6 campus buildings for accepting real geolocation. */
export const CAMPUS_GEOLOCATION_MARGIN_M = 150;

/** Feature flag for 3D pastel isometric map view (defaults to true). */
export const ENABLE_3D: boolean = import.meta.env.VITE_ENABLE_3D !== 'false';

/** Feature flag for Navigation 3D follow camera (defaults to true; requires ENABLE_3D). */
export const ENABLE_NAV3D: boolean =
  ENABLE_3D && import.meta.env.VITE_ENABLE_NAV3D !== 'false';

/** Feature flag for Illustrated decorative visual style (defaults to true). */
export const ENABLE_ILLUSTRATED: boolean =
  import.meta.env.VITE_ENABLE_ILLUSTRATED !== 'false';

/** Dev-only tools flag (e.g., "Drift 40 m", "Flat / Illustrated" switch). */
export const SHOW_DEV_TOOLS: boolean =
  import.meta.env.VITE_SHOW_DEV_TOOLS === 'true' && !import.meta.env.PROD;

/**
 * Local-only Admin Lite feature flag (default FALSE).
 * Public deployments MUST keep this false; real authentication comes with Supabase later.
 */
export const ENABLE_ADMIN: boolean = import.meta.env.VITE_ENABLE_ADMIN === 'true';

/** Estimated meters per floor for 3D extrusion (visual estimate only). */
export const FLOOR_HEIGHT_M = 3.5;

/** Flat extrusion height for surrounding context buildings in 3D. */
export const CONTEXT_3D_HEIGHT_M = 8;

/** Distance filter (meters from campus center) for context buildings in 3D for smooth mobile performance. */
export const CONTEXT_3D_RADIUS_M = 250;
