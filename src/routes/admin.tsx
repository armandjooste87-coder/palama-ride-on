import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/palama/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Users, FileSearch, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LSM } from "@/lib/palama";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Palama" },
      { name: "description", content: "Palama admin: review driver documents, set commission, manage verification." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

interface DriverRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  rating: number;
  commission_pct: number;
  verification_level: string;
  pending_docs: number;
  approved_docs: number;
  total_earnings: number;
}
interface DocReview {
  id: string;
  driver_id: string;
  doc_type: string;
  storage_path: string;
  status: string;
  admin_note: string | null;
  driver_name?: string | null;
}

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [pending, setPending] = useState<DocReview[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const { count } = await supabase
        .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
      setAdminExists((count ?? 0) > 0);
    })();
  }, []);

  async function refresh() {
    const [{ data: ds }, { data: docs }, { data: ledger }] = await Promise.all([
      supabase.rpc("admin_list_drivers"),
      supabase.from("driver_documents").select("id,driver_id,doc_type,storage_path,status,admin_note").eq("status", "pending"),
      supabase.from("platform_ledger").select("amount_lsm"),
    ]);
    setDrivers((ds ?? []) as DriverRow[]);
    setPending((docs ?? []) as DocReview[]);
    setLedgerTotal((ledger ?? []).reduce((s, r) => s + Number(r.amount_lsm), 0));
  }

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth", replace: true }); return; }
    if (isAdmin) void refresh();
  }, [user, isAdmin, loading, nav]);

  async function bootstrap() {
    const { error } = await supabase.rpc("bootstrap_admin");
    if (error) { toast.error(error.message); return; }
    toast.success("You're now an admin. Reloading…");
    window.location.reload();
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>;
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="px-5 pt-12">
          <Card className="p-6 text-center">
            <ShieldCheck className="mx-auto size-10 text-primary" />
            <h1 className="mt-3 text-lg font-bold">Admin only</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You don't have admin access.
            </p>
            {adminExists === false && (
              <>
                <p className="mt-4 text-xs text-muted-foreground">
                  No admin exists yet. You can claim the first admin seat.
                </p>
                <Button className="mt-3" onClick={bootstrap}>Make me the first admin</Button>
              </>
            )}
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="palama-gradient px-5 pt-10 pb-6 safe-top">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Palama</p>
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
      </header>

      <div className="px-5 pt-4 pb-24">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Users className="size-4" />} label="Drivers" value={String(drivers.length)} />
          <Stat icon={<FileSearch className="size-4" />} label="Pending docs" value={String(pending.length)} />
          <Stat icon={<Coins className="size-4" />} label="Commission" value={LSM(ledgerTotal)} />
        </div>

        <Tabs defaultValue="drivers" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="docs">Doc reviews ({pending.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="space-y-3 pt-4">
            {drivers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No drivers yet.</p>
            )}
            {drivers.map((d) => (
              <DriverEditor key={d.id} driver={d} onChanged={refresh} />
            ))}
          </TabsContent>

          <TabsContent value="docs" className="space-y-3 pt-4">
            {pending.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No pending documents.</p>
            )}
            {pending.map((doc) => (
              <DocReviewCard key={doc.id} doc={doc} onChanged={refresh} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function DriverEditor({ driver, onChanged }: { driver: DriverRow; onChanged: () => void }) {
  const [pct, setPct] = useState<number>(Number(driver.commission_pct));
  const [level, setLevel] = useState<string>(driver.verification_level);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const a = await supabase.rpc("admin_set_commission", { _driver_id: driver.id, _pct: pct });
    const b = await supabase.rpc("admin_set_verification", { _driver_id: driver.id, _level: level });
    setSaving(false);
    if (a.error || b.error) { toast.error(a.error?.message || b.error?.message || "Failed"); return; }
    toast.success("Driver updated");
    onChanged();
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{driver.full_name || "Unnamed driver"}</p>
          <p className="text-xs text-muted-foreground">{driver.phone}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">★ {Number(driver.rating).toFixed(2)}</Badge>
            <Badge variant="outline">{LSM(Number(driver.total_earnings))} earned</Badge>
            {driver.pending_docs > 0 && <Badge>{driver.pending_docs} pending</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Commission</span>
          <span className="font-mono font-bold">{pct.toFixed(2)}%</span>
        </div>
        <Slider
          value={[pct]} min={2} max={35} step={0.5}
          onValueChange={(v) => setPct(v[0])}
          className="mt-2"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Hints — unverified: 35% · basic: 25% · verified: 15% · premium: 5%
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-1 text-sm text-muted-foreground">Verification level</p>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unverified">Unverified</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button className="mt-4 w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </Card>
  );
}

function DocReviewCard({ doc, onChanged }: { doc: DocReview; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.storage.from("driver-docs").createSignedUrl(doc.storage_path, 300);
      setPreviewUrl(data?.signedUrl ?? null);
    })();
  }, [doc.storage_path]);

  async function decide(status: "approved" | "rejected") {
    setBusy(true);
    const { error } = await supabase.rpc("admin_review_document", {
      _doc_id: doc.id, _status: status, _note: note || "",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Approved" : "Rejected");
    onChanged();
  }

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold">{doc.doc_type.replace(/_/g, " ")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Driver: {doc.driver_id.slice(0, 8)}…</p>
      {previewUrl ? (
      <a href={previewUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg bg-surface-2">
          {/\.(png|jpe?g|webp|gif)$/i.test(doc.storage_path)
            ? <img src={previewUrl} alt="" className="h-40 w-full object-cover" />
            : <div className="p-6 text-center text-sm">Open file ↗</div>}
        </a>
      ) : <p className="mt-3 text-xs text-muted-foreground">Loading preview…</p>}
      <Textarea
        className="mt-3" placeholder="Optional note for driver"
        value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
      />
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => decide("rejected")} disabled={busy}>Reject</Button>
        <Button className="flex-1" onClick={() => decide("approved")} disabled={busy}>Approve</Button>
      </div>
    </Card>
  );
}