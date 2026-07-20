import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wallet, Banknote, CreditCard, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export type PaymentMethod = "wallet" | "cash" | "card_demo";

const OPTIONS: Array<{ key: PaymentMethod; label: string; sub: string; icon: React.ReactNode }> = [
  {
    key: "wallet",
    label: "Palama Wallet",
    sub: "Pay from your Maloti balance",
    icon: <Wallet className="size-5" />,
  },
  {
    key: "cash",
    label: "Cash",
    sub: "Pay the driver in hand at drop-off",
    icon: <Banknote className="size-5" />,
  },
  {
    key: "card_demo",
    label: "Card (demo)",
    sub: "Simulated card charge",
    icon: <CreditCard className="size-5" />,
  },
];

export function PaymentMethodSheet({
  rideId,
  current,
  disabled,
  onChanged,
}: {
  rideId: string;
  current: PaymentMethod;
  disabled?: boolean;
  onChanged?: (m: PaymentMethod) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const cur = OPTIONS.find((o) => o.key === current) ?? OPTIONS[0];

  async function pick(m: PaymentMethod) {
    if (m === current) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("ride_set_payment_method", {
      _ride_id: rideId,
      _method: m,
    } as never);
    setSaving(false);
    if (error) {
      logger.warn("payment_method_change_failed", { rideId, m, err: error.message });
      toast.error(error.message);
      return;
    }
    logger.info("payment_method_changed", { rideId, method: m });
    onChanged?.(m);
    setOpen(false);
    toast.success("Payment method updated");
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <SheetTrigger asChild>
        <button
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left disabled:opacity-60"
        >
          <div className="grid size-10 place-items-center rounded-full bg-card text-primary">
            {cur.icon}
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Paying with</p>
            <p className="text-sm font-semibold">{cur.label}</p>
          </div>
          {!disabled && <span className="text-xs text-primary">Change</span>}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-0">
        <SheetHeader>
          <SheetTitle>Choose payment method</SheetTitle>
          <SheetDescription>
            Applies to this trip only. You can switch until the ride is completed.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => pick(o.key)}
              disabled={saving}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                current === o.key ? "border-primary bg-primary/10" : "border-border bg-surface-2"
              }`}
            >
              <div className="grid size-10 place-items-center rounded-full bg-card text-primary">
                {o.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{o.label}</p>
                <p className="text-xs text-muted-foreground">{o.sub}</p>
              </div>
              {current === o.key && <Check className="size-5 text-primary" />}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="mt-3 w-full" onClick={() => setOpen(false)}>
          Close
        </Button>
      </SheetContent>
    </Sheet>
  );
}
