// Source: PRD sections 6.6 (Family Messages) and 4.3 (Client Profile
// Messages tab, per Session 10's decision to add it there). Shared between
// both portals — alignment is by sender_id === viewerId (the viewer's own
// messages right-aligned/blue), not by role, so the same component works
// whichever side of the conversation is viewing.
export interface MessageItem {
  id: string;
  sender_id: string;
  sender_role: string;
  sender_name: string;
  body: string;
  created_at: string;
}

function dateSeparatorLabel(date: Date, todayStart: Date): string {
  const diffDays = Math.round((todayStart.getTime() - Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) / (1000 * 60 * 60 * 24));
  const dateStr = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  if (diffDays === 0) return `Today — ${dateStr}`;
  return dateStr;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MessageThread({ messages, viewerId }: { messages: MessageItem[]; viewerId: string }) {
  const todayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  const groups: Array<{ label: string; messages: MessageItem[] }> = [];
  for (const message of messages) {
    const label = dateSeparatorLabel(new Date(message.created_at), todayStart);
    const existing = groups[groups.length - 1];
    if (existing && existing.label === label) existing.messages.push(message);
    else groups.push({ label, messages: [message] });
  }

  if (messages.length === 0) {
    return <p className="py-8 text-center text-body text-text-secondary">No messages yet. Send one to start the conversation.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-center text-tiny text-text-secondary">{group.label}</p>
          <div className="flex flex-col gap-2">
            {group.messages.map((message) => {
              const isOwn = message.sender_id === viewerId;
              return (
                <div key={message.id} className={["flex items-end gap-1.5", isOwn ? "flex-row-reverse" : ""].join(" ")}>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nhs-light-blue text-[10px] font-medium text-nhs-dark-blue">
                    {initials(message.sender_name)}
                  </div>
                  <div className={["max-w-[75%]", isOwn ? "items-end" : "items-start", "flex flex-col"].join(" ")}>
                    {!isOwn ? <p className="mb-0.5 text-tiny text-text-secondary">{message.sender_name}</p> : null}
                    <div
                      className={[
                        "rounded-card px-3 py-2 text-body",
                        isOwn ? "bg-nhs-blue text-white" : "border border-border-default bg-card-bg text-text-primary",
                      ].join(" ")}
                    >
                      {message.body}
                    </div>
                    <p className="mt-0.5 text-tiny text-text-secondary">{new Date(message.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
