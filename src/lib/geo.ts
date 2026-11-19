import type { Coordinates } from "@/types";

/**
 * Geographic helpers for the location screens.
 *
 * The prototype has no map provider, so distances are computed from the
 * seeded coordinates with the haversine formula. They are approximate and the
 * UI says so — a live route service replaces them in the production release.
 */

const EARTH_RADIUS_KM = 6371;

/** The average road distance is longer than the straight line. */
const ROAD_DISTANCE_FACTOR = 1.3;

/** A rough average speed in Dhaka traffic, in km/h. */
const AVERAGE_SPEED_KMH = 24;

/**
 * The great-circle distance between two coordinates, in kilometres.
 */
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;

  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * centralAngle;
}

/**
 * The estimated road distance in kilometres.
 *
 * The straight line is multiplied by a detour factor so the number reads like
 * a real road distance rather than an as-the-crow-flies figure.
 */
export function roadDistanceKm(from: Coordinates, to: Coordinates): number {
  return haversineKm(from, to) * ROAD_DISTANCE_FACTOR;
}

/**
 * The estimated travel time in minutes.
 *
 * This is a coarse estimate from the average speed. The prototype never
 * presents it as a live travel time — the queue engine keeps travel times
 * unknown unless they were supplied.
 */
export function estimatedTravelMinutes(
  from: Coordinates,
  to: Coordinates,
): number {
  const distance = roadDistanceKm(from, to);
  return Math.max(1, Math.round((distance / AVERAGE_SPEED_KMH) * 60));
}

/** Format a distance for display. */
export function formatDistance(kilometres: number): string {
  if (kilometres < 1) {
    return `${Math.round(kilometres * 1000)} m`;
  }
  return `${kilometres.toFixed(1)} km`;
}
