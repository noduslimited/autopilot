"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import { AiDraftButton } from "@/components/ai/AiDraftButton";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { enqueueAction } from "@/lib/offline/queue";

// Source: PRD section 5.3 (Visit Detail)

export interface VisitTaskItem {
  id: string;
  task_type: string;
  task_label: string;
  task_order: number;
  requires_emar: boolean;
  completed: boolean;
}

export interface MedicationItem {
  id: string;
  medication_name: string;
  dose: string;
}

export interface EmarLogEntry {
  id?: string;
  administered: boolean;
  reasonNotAdministered: string | null;
  reasonDetail: string | null;
}

const REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "client_refused", label: "Client refused" },
  { value: "asleep", label: "Client asleep" },
  { value: "not_available", label: "Medication not available" },
  { value: "other", label: "Other" },
];

interface VisitDetailClientProps {
  visitId: string;
  clientId: string;
  carerId: string;
  orgId: string;
  clientFirstName: string;
  initialTasks: VisitTaskItem[];
  medications: MedicationItem[];
  initialEmarLog: Record<string, EmarLogEntry>;
  initialNotes: string;
}

export function VisitDetailClient({
  visitId,
  clientId,
  carerId,
  orgId,
  clientFirstName,
  initialTasks,
  medications,
  initialEmarLog,
  initialNotes,
}: VisitDetailClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [emarLog, setEmarLog] = useState<Record<string, EmarLogEntry>>(initialEmarLog);
  const [emarTaskId, setEmarTaskId] = useState<string | null>(null);
  const [emarDraft, setEmarDraft] = useState<Record<string, { administered: boolean; reasonNotAdministered: string | null; reasonDetail: string | null }>>({});
  const [savingEmar, setSavingEmar] = useState(false);

  const [notes, setNotes] = useState(initialNotes);
  const lastSavedNotes = useRef(initialNotes);
  const [drafting, setDrafting] = useState(false);
  const [draftUnavailable, setDraftUnavailable] = useState(false);

  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [wellbeingRating, setWellbeingRating] = useState<"good" | "fair" | "poor" | null>(null);

  const allTasksDone = tasks.length > 0 && tasks.every((t) => t.completed);
  const firstIncompleteIndex = tasks.findIndex((t) => !t.completed);

  async function saveNotes(text: string) {
    if (text === lastSavedNotes.current) return;
    lastSavedNotes.current = text;
    const supabase = createClient();
    await supabase.from("visits").update({ visit_notes: text }).eq("id", visitId);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      void saveNotes(notes);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 30000);
    return () => clearInterval(interval);
  }, [notes]);

  async function syncTasksCompleted(nextTasks: VisitTaskItem[]) {
    const supabase = createClient();
    await supabase
      .from("visits")
      .update({ tasks_completed: nextTasks.filter((t) => t.completed).length })
      .eq("id", visitId);
  }

  async function completeTask(taskId: string) {
    const completedAt = new Date().toISOString();

    // Source: TRD section 11.3 — offline task completion is queued in
    // IndexedDB with an optimistic UI update, replayed when connectivity
    // returns. Genuinely offline (checked up front, so we don't wait on a
    // doomed request) and a network failure mid-request (caught below,
    // e.g. a flaky connection where navigator.onLine was briefly wrong)
    // both queue. A real application-level error from Supabase (request
    // reached the server, came back with `error`) does NOT queue or
    // optimistically complete — that's a genuine failure the carer
    // should see, not a connectivity problem.
    if (!navigator.onLine) {
      await enqueueAction({ type: "complete_task", payload: { taskId, carerId }, createdAt: completedAt });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
      return;
    }

    const supabase = createClient();
    try {
      const { error } = await supabase.from("visit_tasks").update({ completed: true, completed_at: completedAt, completed_by: carerId }).eq("id", taskId);
      if (error) return;
      const next = tasks.map((t) => (t.id === taskId ? { ...t, completed: true } : t));
      setTasks(next);
      void syncTasksCompleted(next);
    } catch {
      await enqueueAction({ type: "complete_task", payload: { taskId, carerId }, createdAt: completedAt });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
    }
  }

  function handleTaskTap(task: VisitTaskItem, index: number) {
    if (task.completed || index !== firstIncompleteIndex) return; // strict in-order completion
    if (task.requires_emar) {
      setEmarDraft(
        Object.fromEntries(
          medications.map((m) => [
            m.id,
            emarLog[m.id]
              ? { administered: emarLog[m.id].administered, reasonNotAdministered: emarLog[m.id].reasonNotAdministered, reasonDetail: emarLog[m.id].reasonDetail }
              : { administered: true, reasonNotAdministered: null, reasonDetail: null },
          ]),
        ),
      );
      setEmarTaskId(task.id);
      return;
    }
    void completeTask(task.id);
  }

  const emarComplete =
    medications.length === 0 ||
    medications.every((m) => {
      const entry = emarDraft[m.id];
      if (!entry) return false;
      if (entry.administered) return true;
      if (!entry.reasonNotAdministered) return false;
      if (entry.reasonNotAdministered === "other" && !entry.reasonDetail) return false;
      return true;
    });

  async function saveEmar() {
    if (!emarTaskId) return;
    setSavingEmar(true);
    const supabase = createClient();
    const nextEmarLog: Record<string, EmarLogEntry> = {};
    for (const medication of medications) {
      const draft = emarDraft[medication.id];
      const existing = emarLog[medication.id];
      const payload = {
        visit_id: visitId,
        visit_task_id: emarTaskId,
        medication_id: medication.id,
        client_id: clientId,
        org_id: orgId,
        administered: draft.administered,
        reason_not_administered: draft.administered ? null : draft.reasonNotAdministered,
        reason_detail: draft.administered ? null : draft.reasonDetail,
        administered_at: new Date().toISOString(),
        administered_by: carerId,
      };
      const { data: savedRow } = existing?.id
        ? await supabase.from("emar_records").update(payload).eq("id", existing.id).select("id").single()
        : await supabase.from("emar_records").insert(payload).select("id").single();
      nextEmarLog[medication.id] = { ...draft, id: savedRow?.id ?? existing?.id };
    }
    setEmarLog((prev) => ({ ...prev, ...nextEmarLog }));
    setSavingEmar(false);
    const taskId = emarTaskId;
    setEmarTaskId(null);
    await completeTask(taskId);
  }

  async function draftNote() {
    setDrafting(true);
    setDraftUnavailable(false);
    const response = await fetch("/api/ai/draft-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId, existingNotes: notes }),
    }).catch(() => null);
    setDrafting(false);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.draft) {
      setDraftUnavailable(true);
      return;
    }
    setNotes(data.draft);
  }

  async function completeVisit() {
    setCompleting(true);
    await saveNotes(notes);
    const supabase = createClient();
    const { error } = await supabase
      .from("visits")
      .update({
        status: "completed",
        check_out_time: new Date().toISOString(),
        visit_notes: notes,
        wellbeing_rating: wellbeingRating,
      })
      .eq("id", visitId);
    setCompleting(false);
    setConfirmComplete(false);
    if (!error) router.push("/my-day");
  }

  const emarTask = tasks.find((t) => t.id === emarTaskId);

  return (
    <div className="px-4 py-4">
      <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Tasks</h2>
      <div className="flex flex-col gap-2">
        {tasks.map((task, index) => {
          const isActive = !task.completed && index === firstIncompleteIndex;
          const isUpcoming = !task.completed && !isActive;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => handleTaskTap(task, index)}
              disabled={task.completed || isUpcoming}
              className={[
                "flex items-center gap-2.5 rounded-input border p-3 text-left",
                task.completed ? "border-border-default bg-card-bg" : "",
                isActive ? "border-nhs-blue bg-card-bg shadow-sm" : "",
                isUpcoming ? "border-border-default bg-card-bg opacity-70" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2",
                  task.completed ? "border-nhs-green bg-nhs-green" : isActive ? "border-nhs-blue" : "border-border-default",
                ].join(" ")}
              >
                {task.completed ? <i className="ti ti-check text-[13px] text-white" aria-hidden="true" /> : null}
              </span>
              <span
                className={[
                  "flex-1 text-body",
                  task.completed ? "text-text-secondary line-through" : isActive ? "font-medium text-nhs-blue" : "text-text-primary",
                ].join(" ")}
              >
                {task.task_label}
              </span>
              {task.requires_emar ? <Badge variant="dueSoon">eMAR</Badge> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-label uppercase tracking-wide text-text-secondary">Visit notes</h2>
          <AiDraftButton
            label="Draft note"
            loading={drafting}
            disabledReason={draftUnavailable ? "AI drafting temporarily unavailable" : undefined}
            onClick={draftNote}
          />
        </div>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => void saveNotes(notes)}
          placeholder="Add notes about this visit…"
          rows={4}
        />
        <p className="mt-1 text-tiny text-text-secondary">Auto-saves every 30 seconds</p>
      </div>

      <button
        type="button"
        disabled={!allTasksDone || completing}
        onClick={() => setConfirmComplete(true)}
        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-btn bg-nhs-green py-[11px] text-[14px] font-medium text-white disabled:opacity-50"
      >
        <i className="ti ti-check text-[16px]" aria-hidden="true" />
        {allTasksDone ? "Complete visit" : "Complete visit — finish all tasks first"}
      </button>

      <button
        type="button"
        onClick={async () => {
          await saveNotes(notes);
          router.push("/my-day");
        }}
        className="mt-2.5 w-full text-center text-secondary text-text-secondary"
      >
        Pause visit
      </button>

      <ConfirmDialog
        open={confirmComplete}
        title="Complete this visit?"
        message={
          <div>
            <p>Complete this visit for {clientFirstName}?</p>
            {/* Source: PRD 6.3 ("Wellbeing rating is logged by the carer
                during each visit") — no wellbeing control exists anywhere
                in PRD 5.3's own Visit Detail spec, so this was added here,
                at visit-completion time, as the natural point to capture
                it. See CLAUDE.md Session 10 log. */}
            <p className="mt-3 text-label text-text-secondary">How was {clientFirstName}&apos;s wellbeing today?</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(["good", "fair", "poor"] as const).map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setWellbeingRating(rating)}
                  className={[
                    "rounded-input border py-2 text-[12px] font-medium capitalize",
                    wellbeingRating === rating
                      ? rating === "good"
                        ? "border-nhs-green bg-success-green-light text-success-green-text"
                        : rating === "fair"
                          ? "border-nhs-amber bg-amber-light text-amber-text"
                          : "border-nhs-red bg-[#FDECEA] text-danger-red"
                      : "border-border-default bg-card-bg text-text-primary",
                  ].join(" ")}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        }
        confirmLabel={completing ? "Completing…" : "Complete visit"}
        onConfirm={completeVisit}
        onCancel={() => setConfirmComplete(false)}
      />

      <Modal open={!!emarTaskId} onClose={() => setEmarTaskId(null)}>
        <h2 className="text-section-heading text-text-primary">Medication administration</h2>
        <p className="mt-1 text-secondary text-text-secondary">{emarTask?.task_label}</p>
        <div className="mt-3 flex flex-col gap-3">
          {medications.length === 0 ? (
            <p className="text-body text-text-secondary">No active medications recorded for this client.</p>
          ) : (
            medications.map((medication) => {
              const draft = emarDraft[medication.id] ?? { administered: true, reasonNotAdministered: null, reasonDetail: null };
              return (
                <div key={medication.id} className="rounded-input border border-border-default p-3">
                  <p className="text-body font-medium text-text-primary">{medication.medication_name}</p>
                  <p className="text-secondary text-text-secondary">{medication.dose}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEmarDraft((prev) => ({ ...prev, [medication.id]: { administered: true, reasonNotAdministered: null, reasonDetail: null } }))}
                      className={["flex-1 rounded-btn py-[7px] text-[12px] font-medium", draft.administered ? "bg-nhs-green text-white" : "border border-border-default bg-card-bg text-text-primary"].join(" ")}
                    >
                      Administered
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmarDraft((prev) => ({ ...prev, [medication.id]: { administered: false, reasonNotAdministered: prev[medication.id]?.reasonNotAdministered ?? null, reasonDetail: null } }))}
                      className={["flex-1 rounded-btn py-[7px] text-[12px] font-medium", !draft.administered ? "bg-[#F1EFE8] text-text-primary" : "border border-border-default bg-card-bg text-text-primary"].join(" ")}
                    >
                      Not administered
                    </button>
                  </div>
                  {!draft.administered ? (
                    <div className="mt-2">
                      <select
                        value={draft.reasonNotAdministered ?? ""}
                        onChange={(event) =>
                          setEmarDraft((prev) => ({ ...prev, [medication.id]: { ...draft, reasonNotAdministered: event.target.value || null, reasonDetail: event.target.value === "other" ? draft.reasonDetail : null } }))
                        }
                        className="w-full rounded-input border border-border-default px-3 py-[7px] text-body"
                      >
                        <option value="">Select a reason…</option>
                        {REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {draft.reasonNotAdministered === "other" ? (
                        <input
                          type="text"
                          value={draft.reasonDetail ?? ""}
                          onChange={(event) => setEmarDraft((prev) => ({ ...prev, [medication.id]: { ...draft, reasonDetail: event.target.value } }))}
                          placeholder="Describe the reason…"
                          className="mt-2 w-full rounded-input border border-border-default px-3 py-[7px] text-body"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setEmarTaskId(null)} className="rounded-btn border border-border-default bg-card-bg px-3.5 py-[7px] text-[12px] font-medium text-text-primary">
            Cancel
          </button>
          <button
            type="button"
            disabled={!emarComplete || savingEmar}
            onClick={saveEmar}
            className="rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white disabled:opacity-50"
          >
            {savingEmar ? "Saving…" : "Save and mark complete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
