export type LngLat = [number, number];

export type BuildingCategory = 'admin' | 'faculty' | 'facility' | 'food' | 'event' | null;

export interface BuildingInfoEntry {
  category: BuildingCategory;
  floorsOverride?: number | null;
  oldName?: string | null;
  oldNameVerified?: boolean;
  verified?: boolean;
  sourceNote?: string | null;
  hours: string | null;
  description: string | null;
  photo: string | null;
  entranceOverride?: LngLat | null;
  rooms: Record<string, string[]>;
}

export type BuildingInfoMap = Record<string, BuildingInfoEntry>;

export interface BuildingProperties {
  id: string;
  osmId: string;
  name: string;
  shortName: string;
  kind: string;
  category: BuildingCategory;
  floors: number | null;
  heightM: number | null;
  entrance: LngLat;
  entranceNode: string;
  hours: string | null;
  description: string | null;
  photo: string | null;
  review: string[];
}

export interface BuildingFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: LngLat[][];
  };
  properties: BuildingProperties;
}

export interface BuildingsGeoJSON {
  type: 'FeatureCollection';
  copyright?: string;
  features: BuildingFeature[];
}

export interface Building extends BuildingProperties {
  centroid: LngLat;
  polygon: LngLat[][];
  floorsOverride: number | null;
  oldName: string | null;
  oldNameVerified: boolean;
  verified: boolean;
  sourceNote: string | null;
  rooms: Record<string, string[]>;
}

export interface SearchResultItem {
  key: string;
  building: Building;
  matchedRoom?: {
    floor: string;
    name: string;
  };
}

export interface PathNode {
  id: string;
  coord: LngLat;
  type: 'junction' | 'entrance';
  component?: number;
  buildingId?: string;
}

export interface PathEdge {
  from: string;
  to: string;
  meters: number;
  manual?: boolean;
}

export interface PathsGraph {
  nodes: PathNode[];
  edges: PathEdge[];
  walkSpeedMPerMin: number;
}

export type AppTab = 'map' | 'friends';

export type FriendStatus = 'study_buddy' | 'lunch_buddy' | 'in_class' | null;

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface Friendship {
  userA: string;
  userB: string;
  status: 'pending' | 'accepted';
}

/**
 * Building-level presence only. Never stores exact GPS coordinates or history.
 */
export interface Presence {
  userId: string;
  buildingId: string | null;
  status: FriendStatus;
  shareOn: boolean;
  ghost: boolean;
  updatedAt: number;
  expiresAt: number | null;
}

export interface FriendRecord {
  user: User;
  friendship: Friendship;
  presence: Presence;
}

export interface PendingRequestRecord {
  user: User;
  friendship: Friendship;
  direction: 'incoming' | 'outgoing';
}

export type SendRequestResult =
  | { ok: true; user: User; message: string }
  | {
      ok: false;
      reason: 'not_found' | 'already_friends' | 'already_pending';
      message: string;
    };
