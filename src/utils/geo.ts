import { ActivityType, LocationCoordinate } from '../types/tracking';

/**
 * Calculates distance between two GPS coordinates using the Haversine formula
 * @param coord1 First GPS coordinate {latitude, longitude}
 * @param coord2 Second GPS coordinate {latitude, longitude}
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: { latitude: number; longitude: number },
  coord2: { latitude: number; longitude: number }
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const EARTH_RADIUS_KM = 6371;

  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates total distance of an array of GPS coordinates
 * @param coordinates Array of GPS coordinates
 * @returns Total distance in kilometers
 */
export function calculateTotalDistance(
  coordinates: { latitude: number; longitude: number }[]
): number {
  if (coordinates.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const dist = calculateDistance(coordinates[i - 1], coordinates[i]);
    // Filter out micro-jitter under 1 meter (0.001 km) if needed
    if (dist > 0.001) {
      totalDistance += dist;
    }
  }

  return totalDistance;
}

/**
 * Calculates average speed in km/h
 * @param distanceKm Distance in kilometers
 * @param durationSeconds Duration in seconds
 * @returns Speed in km/h
 */
export function calculateAverageSpeed(
  distanceKm: number,
  durationSeconds: number
): number {
  if (durationSeconds <= 0 || distanceKm <= 0) return 0;
  const hours = durationSeconds / 3600;
  return distanceKm / hours;
}

/**
 * Calculates average pace formatted as "MM:SS /km"
 * @param distanceKm Distance in kilometers
 * @param durationSeconds Duration in seconds
 * @returns Formatted pace string
 */
export function calculateAveragePace(
  distanceKm: number,
  durationSeconds: number
): string {
  if (distanceKm <= 0 || durationSeconds <= 0) return '--:-- /km';

  const paceMinutesPerKm = durationSeconds / 60 / distanceKm;
  if (!isFinite(paceMinutesPerKm) || paceMinutesPerKm > 999) {
    return '--:-- /km';
  }

  const minutes = Math.floor(paceMinutesPerKm);
  const seconds = Math.round((paceMinutesPerKm - minutes) * 60);

  if (seconds === 60) {
    return `${(minutes + 1).toString().padStart(2, '0')}:00 /km`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')} /km`;
}

/**
 * Formats duration in seconds to "HH:MM:SS" or "MM:SS"
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const paddedMins = mins.toString().padStart(2, '0');
  const paddedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const paddedHrs = hrs.toString().padStart(2, '0');
    return `${paddedHrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${paddedMins}:${paddedSecs}`;
}

/**
 * Formats distance nicely (e.g. "1.45 km" or "750 m")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Formats speed nicely (e.g. "14.2 km/h")
 */
export function formatSpeed(speedKmh: number): string {
  return `${Math.max(0, speedKmh).toFixed(1)} km/h`;
}

/**
 * Converts meters per second to kilometers per hour
 */
export function convertMpsToKmh(mps: number | null | undefined): number {
  if (!mps || mps < 0) return 0;
  return mps * 3.6;
}

/**
 * Estimates burned calories based on activity type, distance, and duration
 * Using standard Metabolic Equivalent of Task (MET) values:
 * Walking: ~3.5 MET, Running: ~8.0 MET, Cycling: ~6.0 MET
 * Formula: Calories = MET * weight(kg, default 70kg) * duration(hours)
 */
export function estimateCalories(
  activityType: ActivityType,
  distanceKm: number,
  durationSeconds: number,
  userWeightKg: number = 70
): number {
  if (durationSeconds <= 0) return 0;

  const durationHours = durationSeconds / 3600;
  let met = 3.5; // default walking

  if (activityType === 'running') {
    met = 8.0;
  } else if (activityType === 'cycling') {
    met = 6.0;
  }

  // Adjust by distance if active
  const baseCalories = met * userWeightKg * durationHours;
  return Math.round(Math.max(1, baseCalories));
}
