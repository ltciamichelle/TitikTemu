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
