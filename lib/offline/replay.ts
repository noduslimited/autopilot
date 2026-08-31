import { createClient } from "@/lib/supabase/client";
import { getQueuedActions, removeQueuedAction, type QueuedAction } from "./queue";

// Source: TRD section 11.3 — "When connection restores: queued actions
// are replayed against the database in order. Conflict resolution: last
// write wins" (acceptable for care task logging per the TRD's own
// reasoning). Processes the queue sequentially, oldest first, removing
// each entry only once its write actually succeeds — a failure partway
// through (e.g. connection drops again) leaves the remaining entries
// queued for the next reconnect rather than losing them.
async function replayOne(action: QueuedAction): Promise<boolean> {
  const supabase = createClient();
  if (action.type === "complete_task") {
    const { error } = await supabase
      .from("visit_tasks")
      .update({ completed: true, completed_at: action.createdAt, completed_by: action.payload.carerId })
      .eq("id", action.payload.taskId);
    return !error;
  }
  return false;
}

export async function replayQueue(): Promise<void> {
  const actions = await getQueuedActions();
  for (const action of actions) {
    if (action.id === undefined) continue;
    const ok = await replayOne(action);
    if (ok) {
      await removeQueuedAction(action.id);
    } else {
      break; // preserve order — stop here, retry from this point next time
    }
  }
}
