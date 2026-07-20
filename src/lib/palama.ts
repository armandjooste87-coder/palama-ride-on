// Palama domain helpers (mock-friendly).

export const LSM = (n: number) =>
  `LSM ${n.toLocaleString("en-LS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Maseru-ish default coordinates (Lesotho capital).
export const DEFAULT_LOCATION = { lat: -29.3151, lng: 27.4869 };

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export type RideTypeKey = "palama_x" | "palama_xl" | "premium";

export const RIDE_TYPES: Record<
  RideTypeKey,
  {
    label: string;
    tagline: string;
    base: number;
    perKm: number;
    perMin: number;
    seats: number;
    emoji: string;
  }
> = {
  palama_x: {
    label: "PalamaX",
    tagline: "Affordable rides",
    base: 12,
    perKm: 6,
    perMin: 1.2,
    seats: 4,
    emoji: "🚗",
  },
  palama_xl: {
    label: "PalamaXL",
    tagline: "Extra space",
    base: 20,
    perKm: 9,
    perMin: 1.5,
    seats: 6,
    emoji: "🚙",
  },
  premium: {
    label: "Premium",
    tagline: "Top-rated drivers",
    base: 35,
    perKm: 14,
    perMin: 2.0,
    seats: 4,
    emoji: "✨",
  },
};

export function quoteFare(km: number, type: RideTypeKey) {
  const t = RIDE_TYPES[type];
  const minutes = Math.max(3, Math.round(km * 2.2));
  const fare = Math.max(t.base, t.base + km * t.perKm + minutes * t.perMin);
  return { fare: Math.round(fare * 100) / 100, minutes, km: Math.round(km * 100) / 100 };
}

// Pretend addresses for autocomplete.
export const MOCK_PLACES = [
  { label: "Pioneer Mall, Maseru", lat: -29.3261, lng: 27.4869 },
  { label: "Maseru Mall", lat: -29.3104, lng: 27.5128 },
  { label: "Moshoeshoe I Int'l Airport", lat: -29.4622, lng: 27.5524 },
  { label: "Lesotho Sun Hotel", lat: -29.3142, lng: 27.4811 },
  { label: "Sefika Mall", lat: -29.3175, lng: 27.5028 },
  { label: "National University of Lesotho", lat: -29.4664, lng: 27.7297 },
  { label: "Cathedral of Our Lady of Victory", lat: -29.3128, lng: 27.4858 },
  { label: "Setsoto Stadium", lat: -29.3192, lng: 27.4944 },
];

// Synthetic email/password derived from phone (mock OTP-less auth path).
export function phoneToEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `u${digits}@palama.app`;
}
export function phoneToPassword(phone: string) {
  // not secure - mock only
  return `palama-${phone.replace(/\D/g, "")}-mock-v1`;
}

// Generate stable mock nearby driver positions around a point.
export function mockDriverPositions(center: { lat: number; lng: number }, count = 6, t = 0) {
  const out: { id: string; lat: number; lng: number; heading: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + t * 0.0002 * (i + 1);
    const radius = 0.004 + (i % 3) * 0.0025;
    out.push({
      id: `drv-${i}`,
      lat: center.lat + Math.sin(angle) * radius,
      lng: center.lng + Math.cos(angle) * radius,
      heading: (angle * 180) / Math.PI,
    });
  }
  return out;
}
