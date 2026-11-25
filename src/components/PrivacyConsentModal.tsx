import { ShieldCheck, X } from 'lucide-react';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  demoMode: boolean;
  onAllow: () => void;
  onDecline: () => void;
}

export function PrivacyConsentModal({
  isOpen,
  demoMode,
  onAllow,
  onDecline,
}: PrivacyConsentModalProps) {
  if (!isOpen) return null;

  const points = [
    'Building-level only — no exact GPS coordinates',
    'Only accepted friends can see you',
    demoMode
      ? 'Auto stop after 60 seconds (demo mode; 2 hours normally)'
      : 'Auto stop after 2 hours',
    'Ghost mode hides you at once',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[360px] rounded-card bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-[#156A4D]">
            <ShieldCheck size={22} strokeWidth={1.8} />
          </span>
          <button
            type="button"
            onClick={onDecline}
            aria-label="Close privacy dialog"
            className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <h2
          id="privacy-modal-title"
          className="mt-3 text-lg font-bold text-ink"
        >
          Your privacy comes first
        </h2>
        <p className="mt-1 text-xs font-medium text-muted md:text-sm">
          Before sharing your campus building with friends:
        </p>

        <ul className="mt-3.5 flex flex-col gap-2 rounded-button bg-[#F4F8F6] p-3.5">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 text-xs font-semibold text-ink md:text-sm"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onDecline}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-button bg-[#EEF1F0] px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-[#E2E7E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-button bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
