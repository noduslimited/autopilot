"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { RotaStaff, RotaClient } from "./RotaGrid";

interface Proposal {
  staffId: string | null;
  staffName: string;
  staffMatched: boolean;
  clientIds: string[];
  clientNames: string[];
  unmatchedClientNames: string[];
  date: string;
  startTime: string;
  endTime: string;
  conflict: string | null;
}

export function AiScheduleForm({
  staff,
  clients,
  onCreated,
  createOrUpdateShift,
}: {
  staff: RotaStaff[];
  clients: RotaClient[];
  onCreated: () => void;
  createOrUpdateShift: (proposal: { staffId: string; date: string; startTime: string; endTime: string; clientIds: string[] }) => Promise<{ ok: boolean; conflict?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<string[] | null>(null);

  if (staff.length === 0 && clients.length === 0) return null;

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setProposals(null);
    setResults(null);

    const response = await fetch("/api/ai/rota-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim() }),
    }).catch(() => null);

    const data: { proposals?: Proposal[] | null } = response && response.ok ? await response.json() : { proposals: null };

    setLoading(false);

    if (!data.proposals) {
      setError("AI scheduling is temporarily unavailable. Please try again shortly, or add this shift manually.");
      return;
    }
    if (data.proposals.length === 0) {
      setError("Couldn't work out a shift from that — try naming a specific carer, client, day and time.");
      return;
    }

    setProposals(data.proposals);
    setSelected(new Set(data.proposals.map((p, i) => (p.staffMatched && !p.conflict ? i : -1)).filter((i) => i >= 0)));
  }

  async function handleApply() {
    if (!proposals) return;
    setApplying(true);
    const outcomes: string[] = [];

    for (const i of Array.from(selected)) {
      const p = proposals[i];
      if (!p.staffId) continue;
      const result = await createOrUpdateShift({ staffId: p.staffId, date: p.date, startTime: p.startTime, endTime: p.endTime, clientIds: p.clientIds });
      outcomes.push(
        result.ok
          ? `Added: ${p.staffName}, ${p.date} ${p.startTime}–${p.endTime}`
          : `Skipped ${p.staffName}, ${p.date}: ${result.conflict ?? "could not save"}`,
      );
    }

    setApplying(false);
    setResults(outcomes);
    setProposals(null);
    setPrompt("");
    onCreated();
  }

  return (
    <div className="mt-4 rounded-card border border-ai-blue-border bg-ai-blue-light py-3.5 px-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-1.5 text-body font-medium text-ai-blue-text">
          <i className="ti ti-sparkles text-[16px] text-nhs-blue" aria-hidden="true" />
          Schedule with AI
        </span>
        <i className={["ti text-[16px] text-nhs-blue", open ? "ti-chevron-up" : "ti-chevron-down"].join(" ")} aria-hidden="true" />
      </button>

      {open ? (
        <div className="mt-2.5">
          <p className="text-secondary text-ai-blue-text">
            Describe the shift in plain English — e.g. &ldquo;Assign Jenny to see Harry Whitfield every weekday 9–9:30am next week&rdquo;.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the shift…"
              className="flex-1 rounded-input border border-ai-blue-border bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none"
            />
            <Button onClick={handleGenerate} loading={loading} disabled={!prompt.trim()}>
              {loading ? "Thinking…" : "Generate"}
            </Button>
          </div>

          {error ? <p className="mt-2 text-body text-nhs-red">{error}</p> : null}

          {results ? (
            <div className="mt-2.5 rounded-input bg-card-bg p-2.5">
              <ul className="space-y-1 text-secondary text-text-primary">
                {results.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {proposals ? (
            <div className="mt-2.5 space-y-1.5 rounded-input bg-card-bg p-2.5">
              {proposals.map((p, i) => (
                <label key={i} className="flex items-start gap-2 border-b border-border-default pb-1.5 text-body text-text-primary last:border-0 last:pb-0">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    disabled={!p.staffMatched}
                    onChange={(e) =>
                      setSelected((s) => {
                        const next = new Set(s);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        return next;
                      })
                    }
                    className="mt-1 h-4 w-4 accent-nhs-blue"
                  />
                  <span>
                    <span className="font-medium">{p.staffName}</span> — {p.date} {p.startTime}–{p.endTime}
                    {p.clientNames.length > 0 ? ` · ${p.clientNames.join(", ")}` : ""}
                    {!p.staffMatched ? <span className="block text-secondary text-nhs-red">Couldn&apos;t find a carer named &ldquo;{p.staffName}&rdquo;.</span> : null}
                    {p.unmatchedClientNames.length > 0 ? (
                      <span className="block text-secondary text-nhs-amber">Couldn&apos;t match: {p.unmatchedClientNames.join(", ")}.</span>
                    ) : null}
                    {p.conflict ? <span className="block text-secondary text-nhs-amber">{p.conflict} Selecting this will be skipped automatically.</span> : null}
                  </span>
                </label>
              ))}
              <div className="flex justify-end gap-2 pt-1.5">
                <Button variant="secondary" onClick={() => setProposals(null)}>
                  Discard
                </Button>
                <Button onClick={handleApply} loading={applying} disabled={selected.size === 0}>
                  {applying ? "Adding…" : `Add ${selected.size} to rota`}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
