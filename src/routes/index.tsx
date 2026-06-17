import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/palama/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { PassengerHome } from "@/components/palama/PassengerHome";
import { DriverHome } from "@/components/palama/DriverHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Palama — Home" },
      { name: "description", content: "Palama is the ride-hailing app built for Lesotho. Request a ride in seconds or go online to drive and earn — paid in Maloti, safe by default." },
      { property: "og:title", content: "Palama — Rides in Lesotho" },
      { property: "og:description", content: "Book a ride or drive to earn in Maseru and across Lesotho. Built mobile-first." },
      { property: "og:url", content: "https://palama-co-ls.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://palama-co-ls.lovable.app/" }],
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
