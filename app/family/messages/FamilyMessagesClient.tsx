"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MessageThread, type MessageItem } from "@/components/messages/MessageThread";
import { MessageComposer } from "@/components/messages/MessageComposer";

interface FamilyMessagesClientProps {
  orgId: string;
  clientId: string;
  senderId: string;
  senderName: string;
  initialMessages: MessageItem[];
}

export function FamilyMessagesClient({ orgId, clientId, senderId, senderName, initialMessages }: FamilyMessagesClientProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` }, () => {
        router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, router]);

  return (
    <div className="flex flex-col">
      <div className="px-4 py-4">
        <MessageThread messages={initialMessages} viewerId={senderId} />
      </div>
      <div className="fixed bottom-16 left-1/2 w-full max-w-[480px] -translate-x-1/2">
        <MessageComposer orgId={orgId} clientId={clientId} senderId={senderId} senderRole="family_nok" senderName={senderName} onSent={() => router.refresh()} />
        <p className="bg-page-bg px-3 py-1.5 text-center text-tiny text-text-secondary">Replies are typically within a few hours during business hours</p>
      </div>
      <div className="h-24" />
    </div>
  );
}
