import type { LngLat } from '../types';

/**
 * Fixed demo user position near the main campus road (node n3, west of Gedung I).
 * Kept in memory only; never persisted or transmitted.
 */
export const DEMO_USER_POSITION: LngLat = [106.7887265, -6.1687792];

/** Margin in meters around the 6 campus buildings for accepting real geolocation. */
export const CAMPUS_GEOLOCATION_MARGIN_M = 150;
