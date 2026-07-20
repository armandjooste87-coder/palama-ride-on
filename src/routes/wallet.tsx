import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/palama/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight, Plus, Smartphone } from "lucide-react";
import { LSM } from "@/lib/palama";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReceiptSlip, type Receipt } from "@/components/palama/ReceiptSlip";
import { logger } from "@/lib/logger";
import { Send } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Palama" },
      {
        name: "description",
        content:
          "Top up your Palama wallet, withdraw to M-Pesa, and see every Maloti transaction tied to your rides.",
      },
      { property: "og:title", content: "Wallet — Palama" },
      {
        property: "og:description",
        content: "Manage your Maloti balance, top-ups, and withdrawals in the Palama wallet.",
      },
      { property: "og:url", content: "https://palama-co-ls.lovable.app/wallet" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://palama-co-ls.lovable.app/wallet" }],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [txns, setTxns] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState<null | "deposit" | "withdraw">(null);
  const [amount, setAmount] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [toPhone, setToPhone] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTxns(data ?? []);
  }
  useEffect(() => {
    load();
  }, [user]);

  const balance =
    (profile?.wallet_balance ?? 0) + txns.reduce((s, t) => s + Number(t.amount_lsm), 0);

  async function submit() {
    const n = Number(amount);
    if (!user || !n || n <= 0) return;
    if (open === "withdraw" && balance < n) {
      toast.error("Insufficient balance");
      return;
    }
    const { error } =
      open === "deposit"
        ? await supabase.rpc("wallet_topup", { _amount: n })
        : await supabase.rpc("wallet_withdraw", { _amount: n });
    if (error) {
      logger.warn("wallet_op_failed", { op: open, err: error.message });
      toast.error(error.message);
      return;
    }
    logger.info("wallet_op", { op: open, amount: n });
    toast.success(open === "deposit" ? "Deposited" : "Withdrawal queued");
    setLastReceipt({
      title: open === "deposit" ? "Wallet top-up" : "Withdrawal",
      reference: crypto.randomUUID().slice(0, 8).toUpperCase(),
      amount: n,
      method: "wallet",
      lines: [{ label: "Type", value: open === "deposit" ? "M-Pesa top-up" : "M-Pesa withdrawal" }],
    });
    setAmount("");
    setOpen(null);
    load();
    refreshProfile();
  }

  async function sendToFriend() {
    const n = Number(transferAmt);
    if (!toPhone || !n || n <= 0) return;
    const { data, error } = await supabase.rpc("wallet_transfer", {
      _to_phone: toPhone,
      _amount: n,
      _note: transferNote || null,
    } as never);
    if (error) {
      logger.warn("wallet_transfer_failed", { err: error.message });
      toast.error(error.message);
      return;
    }
    const info = (data ?? {}) as { recipient_name?: string | null };
    logger.info("wallet_transfer", { amount: n });
    toast.success(`Sent to ${info.recipient_name ?? "friend"}`);
    setLastReceipt({
      title: `Sent to ${info.recipient_name ?? toPhone}`,
      reference: crypto.randomUUID().slice(0, 8).toUpperCase(),
      amount: n,
      method: "transfer",
      lines: [
        { label: "Recipient", value: info.recipient_name ?? toPhone },
        { label: "Phone", value: toPhone },
        ...(transferNote ? [{ label: "Note", value: transferNote }] : []),
      ],
    });
    setToPhone("");
    setTransferAmt("");
    setTransferNote("");
    setTransferOpen(false);
    load();
    refreshProfile();
  }

  return (
    <AppShell>
      <header className="palama-gradient px-5 pt-10 pb-12 safe-top">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground">
          Available balance
        </p>
        <p className="mt-1 text-4xl font-bold">{LSM(balance)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => setOpen("deposit")}>
            <Plus className="mr-1 size-4" />
            Top up
          </Button>
          <Button size="lg" variant="outline" onClick={() => setOpen("withdraw")}>
            <ArrowUpRight className="mr-1 size-4" />
            Withdraw
          </Button>
        </div>
        <Button
          size="lg"
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => setTransferOpen(true)}
        >
          <Send className="mr-1 size-4" /> Pay a friend
        </Button>
      </header>

      <div className="px-5 pt-4">
        {lastReceipt && (
          <div className="mb-4">
            <ReceiptSlip receipt={lastReceipt} onClose={() => setLastReceipt(null)} />
          </div>
        )}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Transactions</h2>
          <span className="text-xs text-muted-foreground">{txns.length}</span>
        </div>
        {txns.length === 0 && (
          <Card className="mt-3 p-6 text-center">
            <Smartphone className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm">No transactions yet. Top up to start riding.</p>
          </Card>
        )}
        <ul className="mt-3 divide-y divide-border">
          {txns.map((t) => {
            const positive = Number(t.amount_lsm) > 0;
            return (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div
                  className={`grid size-10 place-items-center rounded-full ${positive ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}`}
                >
                  {positive ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.description ?? t.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </p>
                </div>
                <p className={`text-sm font-bold ${positive ? "text-success" : ""}`}>
                  {positive ? "+" : ""}
                  {LSM(Number(t.amount_lsm))}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "deposit" ? "Top up via M-Pesa" : "Withdraw to M-Pesa"}
            </DialogTitle>
            <DialogDescription>Demo mode — no real money moves.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="amt">Amount (LSM)</Label>
            <Input
              id="amt"
              inputMode="decimal"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={submit}>{open === "deposit" ? "Top up" : "Withdraw"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay a friend</DialogTitle>
            <DialogDescription>
              Send Maloti to another Palama user by their phone number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="phone">Friend's phone</Label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="+266 5X XXX XXX"
              value={toPhone}
              onChange={(e) => setToPhone(e.target.value)}
            />
            <Label htmlFor="tamt">Amount (LSM)</Label>
            <Input
              id="tamt"
              inputMode="decimal"
              placeholder="50.00"
              value={transferAmt}
              onChange={(e) => setTransferAmt(e.target.value)}
            />
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              placeholder="Lunch"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendToFriend}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
