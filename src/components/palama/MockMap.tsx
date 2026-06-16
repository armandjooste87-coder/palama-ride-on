import { useEffect, useRef, useState } from "react";
import { Navigation2 } from "lucide-react";
import { mockDriverPositions, DEFAULT_LOCATION } from "@/lib/palama";

interface Props {
  center?: { lat: number; lng: number };
  pickup?: { lat: number; lng: number } | null;
  dropoff?: { lat: number; lng: number } | null;
  driver?: { lat: number; lng: number } | null;
  showNearbyDrivers?: boolean;
  routeProgress?: number; // 0..1, animates a moving marker along pickup→dropoff
}

/** A stylized non-API "map" — soft grid + animated routes + driver pins. */
export function MockMap({
  center = DEFAULT_LOCATION,
  pickup,
  dropoff,
  driver,
  showNearbyDrivers = true,
  routeProgress,
}: Props) {
  const [tick, setTick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  // Project lat/lng to 0..100 viewport %, centered on `center`.
  const project = (p: { lat: number; lng: number }) => {
    const scale = 1200; // degrees -> %
    return {
      x: 50 + (p.lng - center.lng) * scale,
      y: 50 - (p.lat - center.lat) * scale,
    };
  };

  const drivers = showNearbyDrivers ? mockDriverPositions(center, 6, tick * 1000) : [];

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden bg-[oklch(0.22_0.03_260)]"
      aria-label="Map preview"
    >
      {/* gradient sky */}
      <div className="absolute inset-0 palama-gradient opacity-80" />
      {/* grid */}
      <svg className="absolute inset-0 h-full w-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="1" />
          </pattern>
          <pattern id="grid-lg" width="160" height="160" patternUnits="userSpaceOnUse">
            <path d="M 160 0 L 0 0 0 160" fill="none" stroke="oklch(1 0 0 / 0.1)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#grid-lg)" />
        {/* fake roads */}
        <path d="M -20 60% Q 50% 40%, 120% 70%" stroke="oklch(1 0 0 / 0.15)" strokeWidth="14" fill="none" />
        <path d="M 40% -20 Q 55% 50%, 30% 120%" stroke="oklch(1 0 0 / 0.12)" strokeWidth="10" fill="none" />
        <path d="M -20 30% L 120% 35%" stroke="oklch(1 0 0 / 0.08)" strokeWidth="6" fill="none" />
      </svg>

      {/* route line */}
      {pickup && dropoff && (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line
            x1={project(pickup).x}
            y1={project(pickup).y}
            x2={project(dropoff).x}
            y2={project(dropoff).y}
            stroke="oklch(0.88 0.19 130)"
            strokeWidth="0.8"
            strokeDasharray="2 1.5"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* nearby drivers */}
      {drivers.map((d) => {
        const p = project(d);
        return (
          <div
            key={d.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-linear"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) rotate(${d.heading}deg)` }}
          >
            <div className="rounded-full bg-foreground/90 p-1.5 shadow-lg">
              <Navigation2 className="size-3 text-background" />
            </div>
          </div>
        );
      })}

      {/* pickup pin */}
      {pickup && <Pin pos={project(pickup)} color="bg-foreground" label="A" />}
      {/* dropoff pin */}
      {dropoff && <Pin pos={project(dropoff)} color="bg-primary" label="B" />}

      {/* live driver pin */}
      {driver && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${project(driver).x}%`, top: `${project(driver).y}%` }}
        >
          <div className="rounded-full bg-primary p-2 glow-primary animate-pulse">
            <Navigation2 className="size-4 text-primary-foreground" />
          </div>
        </div>
      )}

      {/* user current location dot */}
      {!pickup && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: "50%", top: "50%" }}
        >
          <span className="absolute inline-flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-accent opacity-40" />
          <div className="relative size-4 rounded-full border-2 border-background bg-accent" />
        </div>
      )}

      {/* moving marker along route */}
      {pickup && dropoff && typeof routeProgress === "number" && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
          style={{
            left: `${project(pickup).x + (project(dropoff).x - project(pickup).x) * routeProgress}%`,
            top: `${project(pickup).y + (project(dropoff).y - project(pickup).y) * routeProgress}%`,
          }}
        >
          <div className="rounded-full bg-primary p-2 glow-primary">
            <Navigation2 className="size-4 text-primary-foreground" />
          </div>
        </div>
      )}
    </div>
  );
}

function Pin({ pos, color, label }: { pos: { x: number; y: number }; color: string; label: string }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-background shadow-lg ${color}`}>
        {label}
      </div>
      <div className={`mx-auto h-2 w-2 -translate-y-1 rotate-45 ${color}`} />
    </div>
  );
}
