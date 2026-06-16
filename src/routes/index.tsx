import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/palama/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { PassengerHome } from "@/components/palama/PassengerHome";
import { DriverHome } from "@/components/palama/DriverHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Palama — Home" },
      { name: "description", content: "Request a ride or go online to drive with Palama." },
    ],
  }),
  component: Home,
});

function Home() {
  const { role, user } = useAuth();
  return (
    <AppShell>
      {user ? (role === "driver" ? <DriverHome /> : <PassengerHome />) : null}
    </AppShell>
  );
}
