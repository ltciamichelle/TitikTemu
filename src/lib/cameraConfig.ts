/**
 * Constants for Navigation 3D behind-the-user follow camera and simulation/GPS tuning.
 */
export const NAV_PITCH = 66;
export const OVERVIEW_3D_PITCH = 55;
export const OVERVIEW_3D_ROUTE_PITCH = 45;
export const OVERVIEW_3D_BEARING = -20;
export const MAX_PITCH = 70;
export const NAV_ZOOM = 19.3;
export const LOOKAHEAD_M = 25;
export const BEARING_SMOOTHING = 0.12;
export const NAV_MAX_FPS = 30;
export const NAV_FRAME_INTERVAL_MS = 1000 / NAV_MAX_FPS;
export const NAV_ROUTE_UPDATE_INTERVAL_MS = 200;

export const NAV_TOP_PADDING_MOBILE = 280;
export const NAV_TOP_PADDING_DESKTOP = 220;
export const NAV_BOTTOM_PADDING_EXTRA = 20;
export const NAV_ROUTE_PANEL_HEIGHT_MOBILE = 210;
export const NAV_ROUTE_PANEL_HEIGHT_DESKTOP = 40;

export const ARRIVAL_THRESHOLD_M = 12;
export const SIM_WALK_SPEED_MPS = 1.4;
export const OFF_ROUTE_THRESHOLD_M = 30;
export const OFF_ROUTE_CONSECUTIVE_FIXES = 3;
export const GPS_MAX_ACCURACY_M = 40;
export const GPS_SMOOTHING_WINDOW = 4;
