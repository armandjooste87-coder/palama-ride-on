import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/palama/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Star, Phone, Car, Shield, ChevronRight, Bell, ShieldCheck, Wallet, Activity } from "lucide-react";
import { toast } from "sonner";
import { DocumentsCard } from "@/components/palama/DocumentsCard";
import { usePushSubscription } from "@/hooks/usePushSubscription";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Palama" },
      { name: "description", content: "Manage your Palama account: phone number, vehicle details, saved places, and account verification." },
      { property: "og:title", content: "Your profile — Palama" },
      { property: "og:description", content: "Update your Palama account, vehicle, and saved places." },
      { property: "og:url", content: "https://palama-co-ls.lovable.app/profile" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://palama-co-ls.lovable.app/profile" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, role, isAdmin, signOut, user } = useAuth();
  const nav = useNavigate();
  const enablePush = usePushSubscription(user?.id);

  async function handleSignOut() {
    await signOut();
    nav({ to: "/auth", replace: true });
  }

  async function handleEnablePush() {
    const res = await enablePush();
    if (res.ok) toast.success("Push notifications enabled");
    else if (res.reason === "denied") toast.error("Permission denied in browser");
    else if (res.reason === "unsupported") toast.error("This browser doesn't support push");
    else toast.error("Could not enable notifications");
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
            <Row icon={<Car className="size-4" />} label="Vehicle" value={profile?.vehicle_label ?? "Not set"} />
          )}
          <Row icon={<Shield className="size-4" />} label="Account" value="Verified" />
        </Card>

        {role === "driver" && (
          <div className="mt-4">
            <DocumentsCard />
          </div>
        )}

        <Card className="mt-4 divide-y divide-border p-0">
          <button className="flex w-full items-center gap-3 p-4 text-left" onClick={handleEnablePush}>
            <Bell className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Enable notifications</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
          <Link to="/wallet" className="flex w-full items-center gap-3 p-4 text-left">
            <Wallet className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Wallet</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <Link to="/activity" className="flex w-full items-center gap-3 p-4 text-left">
            <Activity className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Trip history</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          {isAdmin && (
            <Link to="/admin" className="flex w-full items-center gap-3 p-4 text-left">
              <ShieldCheck className="size-4 text-primary" />
              <span className="flex-1 text-sm font-medium">Admin dashboard</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          )}
          <a href="mailto:support@palama.co.ls?subject=Palama%20support" className="flex w-full items-center gap-3 p-4 text-left">
            <span className="flex-1 text-sm font-medium">Help & support</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </a>
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