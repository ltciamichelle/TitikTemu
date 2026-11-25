import { Compass, LocateFixed, Minus, Plus } from 'lucide-react';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  bearing?: number;
  onResetNorth?: () => void;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  bearing = 0,
  onResetNorth,
}: MapControlsProps) {
  const showResetNorth = Math.abs(bearing) > 1 && Boolean(onResetNorth);

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2.5">
      {showResetNorth && (
        <button
          type="button"
          onClick={onResetNorth}
          aria-label="Reset map north"
          title="Reset north"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-transform hover:bg-[#F4F8F6] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Compass
            size={20}
            strokeWidth={1.8}
            className="text-accent transition-transform duration-150"
            style={{ transform: `rotate(${-bearing}deg)` }}
          />
        </button>
      )}

      <button
        type="button"
        onClick={onLocate}
        aria-label="Center on my location"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-soft transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <LocateFixed size={20} strokeWidth={1.8} />
      </button>

      <div className="flex flex-col items-center overflow-hidden rounded-full bg-white shadow-soft">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:bg-[#F4F8F6] active:bg-mint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
        <span className="h-px w-5 bg-[#EEF1F0]" />
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:bg-[#F4F8F6] active:bg-mint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Minus size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
