import { LocateFixed, Minus, Plus } from 'lucide-react';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}

export function MapControls({ onZoomIn, onZoomOut, onLocate }: MapControlsProps) {
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2.5">
      <button
        type="button"
        onClick={onLocate}
        aria-label="Center on my location"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-soft transition-transform active:scale-95"
      >
        <LocateFixed size={20} strokeWidth={1.8} />
      </button>

      <div className="flex flex-col items-center overflow-hidden rounded-full bg-white shadow-soft">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:bg-[#F4F8F6] active:bg-mint/40"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
        <span className="h-px w-5 bg-[#EEF1F0]" />
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:bg-[#F4F8F6] active:bg-mint/40"
        >
          <Minus size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
