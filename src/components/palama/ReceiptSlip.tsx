import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Share2, Printer } from "lucide-react";
import { LSM } from "@/lib/palama";

export interface Receipt {
  title: string;
  reference: string;
  amount: number;
  method?: "wallet" | "cash" | "card_demo" | "transfer";
  lines?: Array<{ label: string; value: string }>;
  note?: string;
  timestamp?: string;
}

/**
 * Palama transaction slip — printable + shareable.
 * Purely presentational; caller supplies the data.
 */
export function ReceiptSlip({ receipt, onClose }: { receipt: Receipt; onClose?: () => void }) {
  const ts = receipt.timestamp ?? new Date().toLocaleString("en-GB", { timeZone: "Africa/Maseru" });
  async function share() {
    const text = `Palama slip · ${receipt.title}\nRef: ${receipt.reference}\nAmount: ${LSM(receipt.amount)}\n${ts}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Palama slip", text }); } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    }
  }
  return (
    <Card className="p-5 print:shadow-none">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-full bg-primary/20 text-primary">
          <Check className="size-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Palama slip</p>
          <h3 className="text-base font-bold">{receipt.title}</h3>
        </div>
      </div>
      <div className="mt-4 border-t border-dashed border-border pt-4">
        <p className="text-3xl font-bold">{LSM(receipt.amount)}</p>
        {receipt.method && (
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Paid via {receipt.method.replace("_", " ")}
          </p>
        )}
      </div>
      {receipt.lines && receipt.lines.length > 0 && (
        <dl className="mt-4 space-y-2 border-t border-dashed border-border pt-4 text-sm">
          {receipt.lines.map((l) => (
            <div key={l.label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd className="text-right font-medium">{l.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
        <p>Ref: <span className="font-mono">{receipt.reference}</span></p>
        <p className="mt-0.5">{ts}</p>
        {receipt.note && <p className="mt-2">{receipt.note}</p>}
      </div>
      <div className="mt-5 flex gap-2 print:hidden">
        <Button variant="outline" size="sm" className="flex-1" onClick={share}>
          <Share2 className="mr-1 size-4" /> Share
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => window.print()}>
          <Printer className="mr-1 size-4" /> Print
        </Button>
        {onClose && (
          <Button size="sm" className="flex-1" onClick={onClose}>Done</Button>
        )}
      </div>
    </Card>
  );
}