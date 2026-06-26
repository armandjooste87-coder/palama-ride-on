import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ChatMsg {
  id: string;
  ride_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export function ChatSheet({ rideId, trigger }: { rideId: string; trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history + subscribe
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("chat_messages")
      .select("*")
      .eq("ride_id", rideId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setMsgs((data ?? []) as ChatMsg[]);
      });

    const ch = supabase
      .channel(`chat_${rideId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `ride_id=eq.${rideId}` },
        (payload) => {
          const m = payload.new as ChatMsg;
          setMsgs((prev) => [...prev, m]);
          if (!open && m.sender_id !== user?.id) setUnread((n) => n + 1);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [rideId, open, user?.id]);

  // Scroll on new
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, open]);

  useEffect(() => { if (open) setUnread(0); }, [open]);

  async function send() {
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      ride_id: rideId, sender_id: user.id, body,
    });
    if (error) toast.error(error.message);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="outline" aria-label="Chat with driver" className="relative">
            <MessageSquare className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Trip chat</SheetTitle>
        </SheetHeader>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: "60vh" }}>
          {msgs.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              No messages yet. Say hello!
            </p>
          )}
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-surface-2"}`}>
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          className="flex gap-2 border-t p-3 safe-bottom"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
            autoFocus
          />
          <Button type="submit" size="icon" aria-label="Send"><Send className="size-4" /></Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}