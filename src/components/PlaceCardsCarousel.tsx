import {
  BookOpen,
  Building2,
  HeartPulse,
  Landmark,
  MapPin,
  Mic2,
  Trophy,
  Utensils,
} from 'lucide-react';
import featuredPlacesData from '../data/featuredPlaces.json';
import { formatFloorLabel } from '../lib/geo';
import type { Building } from '../types';

export interface FeaturedPlace {
  id: string;
  name: string;
  buildingId: string;
  floor: string;
  tags: string[];
  icon: 'admin' | 'library' | 'food' | 'bank' | 'event' | 'health' | 'sport';
  accentBg: string;
  photo: string | null;
  verified: boolean;
}

const FEATURED_PLACES = featuredPlacesData as FeaturedPlace[];

function getPlaceIcon(icon: FeaturedPlace['icon']) {
  switch (icon) {
    case 'library':
      return BookOpen;
    case 'food':
      return Utensils;
    case 'bank':
      return Landmark;
    case 'event':
      return Mic2;
    case 'health':
      return HeartPulse;
    case 'sport':
      return Trophy;
    case 'admin':
    default:
      return Building2;
  }
}

interface PlaceCardsCarouselProps {
  buildings: Building[];
  onSelectPlace: (buildingId: string, floor: string) => void;
  variant?: 'sidebar' | 'mobile';
}

export function PlaceCardsCarousel({
  buildings,
  onSelectPlace,
  variant = 'sidebar',
}: PlaceCardsCarouselProps) {
  const buildingsById = new Map(buildings.map((b) => [b.id, b]));
  const isMobile = variant === 'mobile';

  return (
    <section
      aria-label="Popular campus spots"
      className={isMobile ? 'pointer-events-auto w-full' : 'mb-5'}
    >
      {!isMobile && (
        <div className="mb-2.5 flex items-center justify-between px-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Campus spots
          </p>
          <span className="text-[11px] font-medium text-muted">
            Tap to view floor
          </span>
        </div>
      )}

      <div
        className={`no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 ${
          isMobile ? 'px-4' : 'px-0.5'
        }`}
      >
        {FEATURED_PLACES.map((place) => {
          const building = buildingsById.get(place.buildingId);
          const buildingName = building ? building.name : 'UNTAR Kampus 1';
          const floorLabel = formatFloorLabel(place.floor);
          const Icon = getPlaceIcon(place.icon);

          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onSelectPlace(place.buildingId, place.floor)}
              className={`group flex shrink-0 snap-start flex-col overflow-hidden rounded-[20px] bg-white p-2 text-left shadow-soft transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:rounded-[22px] md:p-2.5 ${
                isMobile ? 'w-[164px]' : 'w-[172px]'
              }`}
            >
              {/* Photo slot with floating floor badge (top-left, matching reference card) */}
              <div
                className={`relative flex w-full items-center justify-center overflow-hidden rounded-[14px] ${
                  isMobile ? 'h-[80px]' : 'h-[96px]'
                }`}
                style={{ backgroundColor: place.accentBg }}
              >
                {place.photo ? (
                  <img
                    src={place.photo}
                    alt={place.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[#2E4657]/75">
                    <Icon size={28} strokeWidth={1.7} />
                    <span className="text-[10px] font-semibold">
                      Photo coming soon
                    </span>
                  </div>
                )}

                {/* Floating pill badge on top-left of photo */}
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-ink shadow-soft-sm">
                  <MapPin size={11} strokeWidth={2.2} className="text-accent" />
                  {floorLabel}
                </span>
              </div>

              {/* Place title */}
              <p className="mt-2.5 line-clamp-1 text-sm font-bold leading-snug text-ink">
                {place.name}
              </p>

              {/* Location subtitle */}
              <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-muted">
                {buildingName}, Lantai {place.floor} • UNTAR Kampus 1
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
