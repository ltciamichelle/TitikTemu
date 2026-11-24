import type { BuildingCategory } from '../types';

export interface BuildingPlaceholderInfo {
  category: BuildingCategory;
  hours: string | null;
  description: string | null;
}

/**
 * Every value below is PLACEHOLDER, verify on site.
 * Never present invented hours or descriptions as real in the UI —
 * UI components must show "Info coming soon" when real properties are null.
 */
export const buildingInfoMock: Record<string, BuildingPlaceholderInfo> = {
  b518483234: {
    // PLACEHOLDER, verify on site
    category: null, // PLACEHOLDER, verify on site
    hours: null, // PLACEHOLDER, verify on site
    description: null, // PLACEHOLDER, verify on site
  },
  b518483236: {
    // PLACEHOLDER, verify on site
    category: null, // PLACEHOLDER, verify on site
    hours: null, // PLACEHOLDER, verify on site
    description: null, // PLACEHOLDER, verify on site
  },
  b518483239: {
    // PLACEHOLDER, verify on site
    category: null, // PLACEHOLDER, verify on site
    hours: null, // PLACEHOLDER, verify on site
    description: null, // PLACEHOLDER, verify on site
  },
  b518483240: {
    // PLACEHOLDER, verify on site
    category: null, // PLACEHOLDER, verify on site
    hours: null, // PLACEHOLDER, verify on site
    description: null, // PLACEHOLDER, verify on site
  },
  b518483241: {
    // PLACEHOLDER, verify on site
    category: null, // PLACEHOLDER, verify on site
    hours: null, // PLACEHOLDER, verify on site
    description: null, // PLACEHOLDER, verify on site
  },
  b518483242: {
    // PLACEHOLDER, verify on site
    category: null, // PLACEHOLDER, verify on site
    hours: null, // PLACEHOLDER, verify on site
    description: null, // PLACEHOLDER, verify on site
  },
};
