"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MessageThread, type MessageItem } from "@/components/messages/MessageThread";
import { MessageComposer } from "@/components/messages/MessageComposer";

interface MessagesTabClientProps {
  orgId: string;
  clientId: string;
  managerId: string;
  managerName: string;
  initialMessages: MessageItem[];
}

export function MessagesTabClient({ orgId, clientId, managerId, managerName, initialMessages }: MessagesTabClientProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`manager-messages-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` }, () => {
        router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, router]);

  return (
    <div className="rounded-card border border-border-default bg-card-bg">
      <div className="max-h-[480px] overflow-y-auto p-4">
        <MessageThread messages={initialMessages} viewerId={managerId} />
      </div>
      <MessageComposer
        orgId={orgId}
        clientId={clientId}
        senderId={managerId}
        senderRole="manager"
        senderName={managerName}
        placeholder="Reply to the family…"
        onSent={() => router.refresh()}
      />
    </div>
  );
}
