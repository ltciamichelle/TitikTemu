import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  GitBranch,
  Route,
} from 'lucide-react';
import type {
  GraphCheckReport,
  ValidationIssue,
  ValidationReport,
} from '../../lib/validate';
import type { Building } from '../../types';

interface AdminValidationPanelProps {
  validation: ValidationReport;
  graphChecks: GraphCheckReport;
  buildings: Building[];
  onGoToIssue: (issue: ValidationIssue) => void;
}

export function AdminValidationPanel({
  validation,
  graphChecks,
  buildings,
  onGoToIssue,
}: AdminValidationPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Errors (block export) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#B91C1C]">
            <AlertCircle size={14} strokeWidth={2} />
            Errors ({validation.errors.length}) — blocks export
          </h3>
        </div>
        {validation.errors.length === 0 ? (
          <div className="flex items-center gap-2 rounded-button bg-mint/50 px-3 py-2.5 text-xs font-semibold text-[#156A4D]">
            <CheckCircle2 size={15} strokeWidth={2} />
            <span>No blocking errors. Ready to export.</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {validation.errors.map((err) => (
              <li
                key={err.id}
                className="flex items-start justify-between gap-2 rounded-button bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]"
              >
                <span className="font-medium leading-relaxed">{err.message}</span>
                <button
                  type="button"
                  onClick={() => onGoToIssue(err)}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#991B1B] shadow-sm hover:bg-[#FEE2E2]"
                >
                  Go to field
                  <ArrowUpRight size={12} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Warnings (allow export) */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9A5B13]">
          <AlertTriangle size={14} strokeWidth={2} />
          Warnings ({validation.warnings.length}) — export allowed
        </h3>
        {validation.warnings.length === 0 ? (
          <p className="rounded-button bg-[#F4F8F6] px-3 py-2.5 text-xs font-medium text-muted">
            No warnings.
          </p>
        ) : (
          <ul className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
            {validation.warnings.map((warn) => (
              <li
                key={warn.id}
                className="flex items-start justify-between gap-2 rounded-button bg-[#FFFBEB] px-3 py-2 text-xs text-[#854D0E]"
              >
                <span className="font-medium leading-relaxed">
                  {warn.message}
                </span>
                <button
                  type="button"
                  onClick={() => onGoToIssue(warn)}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#854D0E] shadow-sm hover:bg-[#FEF3C7]"
                >
                  Go to field
                  <ArrowUpRight size={12} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Read-only Graph Checks from paths.json */}
      <section className="border-t border-[#EEF1F0] pt-4">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink">
          <GitBranch size={14} strokeWidth={2} className="text-primary" />
          Walking Graph Checks (read-only)
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-button bg-[#F4F8F6] p-3">
            <p className="text-[11px] font-semibold text-muted">
              Connected components
            </p>
            <p className="mt-0.5 text-lg font-bold text-ink">
              {graphChecks.componentCount}
            </p>
            <p className="text-[11px] text-muted">
              Main: {graphChecks.mainComponentSize}/{graphChecks.totalNodes} nodes
            </p>
          </div>
          <div className="rounded-button bg-[#F4F8F6] p-3">
            <p className="text-[11px] font-semibold text-muted">
              Guessed edges
            </p>
            <p className="mt-0.5 text-lg font-bold text-ink">
              {graphChecks.guessedEdges.length}
            </p>
            <p className="text-[11px] text-muted">manual: true in paths.json</p>
          </div>
        </div>

        {/* Entrance connectivity */}
        <div className="mt-3 rounded-button bg-[#F7FAF9] p-3">
          <p className="mb-1.5 text-xs font-bold text-ink">
            Building entrance connectivity
          </p>
          <ul className="flex flex-col gap-1">
            {graphChecks.buildingConnectivity.map((c) => (
              <li
                key={c.buildingId}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-ink">
                  {c.buildingName}{' '}
                  <span className="text-muted">({c.entranceNode})</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    c.connectedToMain
                      ? 'bg-mint text-[#156A4D]'
                      : 'bg-[#FEE2E2] text-[#991B1B]'
                  }`}
                >
                  {c.connectedToMain ? 'Connected' : 'Disconnected'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Guessed edges list */}
        {graphChecks.guessedEdges.length > 0 && (
          <div className="mt-3 rounded-button bg-[#FFF7F0] p-3">
            <p className="mb-1 text-xs font-bold text-[#8C4A1C]">
              Guessed edges (verify on site)
            </p>
            <ul className="flex flex-col gap-1 text-xs text-[#8C4A1C]">
              {graphChecks.guessedEdges.map((e, idx) => (
                <li key={`${e.from}-${e.to}-${idx}`}>
                  <code>{e.from}</code> ↔ <code>{e.to}</code> —{' '}
                  <strong>{Math.round(e.meters)} m</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 6x6 Route Matrix */}
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
            <Route size={13} strokeWidth={2} className="text-primary" />
            Shortest route matrix (meters, * = uses guessed edge)
          </p>
          <div className="overflow-x-auto rounded-button border border-[#E5ECE9]">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-[#F4F8F6] text-muted">
                  <th className="px-2 py-1.5 font-bold">From \ To</th>
                  {buildings.map((b) => (
                    <th key={b.id} className="px-2 py-1.5 text-right font-bold">
                      {b.shortName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buildings.map((a) => (
                  <tr key={a.id} className="border-t border-[#EEF1F0]">
                    <td className="whitespace-nowrap px-2 py-1.5 font-bold text-ink">
                      {a.shortName}
                    </td>
                    {buildings.map((b) => {
                      const cell = graphChecks.routeMatrix[a.id]?.[b.id];
                      const isSelf = a.id === b.id;
                      return (
                        <td
                          key={b.id}
                          className={`whitespace-nowrap px-2 py-1.5 text-right ${
                            isSelf
                              ? 'text-muted/50'
                              : cell?.meters === null
                                ? 'font-bold text-[#B91C1C]'
                                : cell?.usesManual
                                  ? 'font-semibold text-[#9A5B13]'
                                  : 'font-medium text-ink'
                          }`}
                        >
                          {isSelf
                            ? '—'
                            : cell?.meters === null
                              ? 'None'
                              : `${cell?.meters}m${cell?.usesManual ? '*' : ''}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
