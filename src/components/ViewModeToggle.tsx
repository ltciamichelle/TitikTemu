import { ENABLE_3D } from '../lib/constants';
import { useAppStore } from '../store/useAppStore';

interface ViewModeToggleProps {
  align?: 'right' | 'center';
}

const SHOW_DEV_HEIGHT_NOTE = !import.meta.env.PROD;

export function ViewModeToggle({ align = 'right' }: ViewModeToggleProps) {
  const mapMode = useAppStore((s) => s.mapMode);
  const setMapMode = useAppStore((s) => s.setMapMode);

  if (!ENABLE_3D) return null;

  return (
    <div
      className={`pointer-events-auto flex flex-col gap-1 ${
        align === 'right' ? 'items-end' : 'items-center'
      }`}
    >
      <div
        role="group"
        aria-label="Map view dimension"
        className="inline-flex items-center rounded-full bg-white p-1 shadow-soft"
      >
        <button
          type="button"
          aria-label="Switch to 2D map view"
          aria-pressed={mapMode === '2d'}
          onClick={() => setMapMode('2d')}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-sm ${
            mapMode === '2d'
              ? 'bg-primary text-white shadow-soft-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          2D
        </button>
        <button
          type="button"
          aria-label="Switch to 3D map view"
          aria-pressed={mapMode === '3d'}
          onClick={() => setMapMode('3d')}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-sm ${
            mapMode === '3d'
              ? 'bg-primary text-white shadow-soft-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          3D
        </button>
      </div>

      {SHOW_DEV_HEIGHT_NOTE && mapMode === '3d' && (
        <span className="rounded-full bg-white/85 px-2.5 py-0.5 text-[11px] font-medium text-muted shadow-soft-sm backdrop-blur-[2px]">
          3D heights are estimated.
        </span>
      )}
    </div>
  );
}
