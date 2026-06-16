import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/palama/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Star, Phone, Car, Shield, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Palama" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, role, signOut } = useAuth();
  const nav = useNavigate();

  async function handleSignOut() {
    await signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <header className="palama-gradient px-5 pt-10 pb-12 safe-top">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {profile?.full_name?.[0] ?? "P"}
          </div>
          <div>
            <h1 className="text-xl font-bold">{profile?.full_name ?? "Palama user"}</h1>
            <p className="text-sm text-muted-foreground">{profile?.phone}</p>
            <p className="mt-1 flex items-center gap-1 text-xs">
              <Star className="size-3 fill-primary text-primary" />
              {(profile?.rating ?? 5).toFixed(2)} · {role}
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 pt-4">
        <Card className="divide-y divide-border p-0">
          <Row icon={<Phone className="size-4" />} label="Phone" value={profile?.phone ?? "—"} />
          {role === "driver" && (
            <>
              <Row icon={<Car className="size-4" />} label="Vehicle" value={profile?.vehicle_label ?? "Not set"} />
              <Row icon={<FileText className="size-4" />} label="Documents" value="Pending review" />
            </>
          )}
          <Row icon={<Shield className="size-4" />} label="Account" value="Verified" />
        </Card>

        <Card className="mt-4 divide-y divide-border p-0">
          <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => toast("Saved places coming soon")}>
            <span className="flex-1 text-sm font-medium">Saved places</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
          <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => toast("Help & support")}>
            <span className="flex-1 text-sm font-medium">Help & support</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
          <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => toast("Settings")}>
            <span className="flex-1 text-sm font-medium">Settings</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </Card>

        <Button variant="outline" className="mt-6 w-full" onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Palama · Made for Lesotho · v0.1
        </p>
      </div>
    </AppShell>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted-foreground">{icon}</div>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  );
}