import { ActivityType, GpsSignalQuality, LocationCoordinate } from '../types/tracking';

/**
 * Maximum acceptable accuracy in meters.
 * Coordinates with accuracy worse than this are filtered out from the route.
 */
export const MAX_ACCEPTABLE_ACCURACY_METERS = 35;

/**
 * Validates that GPS coordinate has valid numbers within geographic boundaries
 */
export function isValidCoordinate(coord: any): coord is LocationCoordinate {
  if (!coord || typeof coord !== 'object') return false;

  const { latitude, longitude, timestamp } = coord;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof timestamp !== 'number'
  ) {
    return false;
  }

  if (isNaN(latitude) || isNaN(longitude) || isNaN(timestamp)) {
    return false;
  }

  if (!isFinite(latitude) || !isFinite(longitude)) {
    return false;
  }

  // Latitude must be between -90 and 90 degrees
  if (latitude < -90 || latitude > 90) {
    return false;
  }

  // Longitude must be between -180 and 180 degrees
  if (longitude < -180 || longitude > 180) {
    return false;
  }

  return true;
}

/**
 * Checks whether GPS reading has acceptable accuracy (in meters)
 */
export function isGpsAccuracyAcceptable(
  accuracy: number | null | undefined,
  thresholdMeters: number = MAX_ACCEPTABLE_ACCURACY_METERS
): boolean {
  if (accuracy == null || isNaN(accuracy)) return false;
  if (accuracy <= 0) return false;
  return accuracy <= thresholdMeters;
}

/**
 * Determines GPS signal quality based on horizontal accuracy reading
 */
export function getGpsSignalQuality(
  accuracy: number | null | undefined
): GpsSignalQuality {
  if (accuracy == null || isNaN(accuracy) || accuracy <= 0) {
    return 'searching';
  }
  if (accuracy <= 10) {
    return 'strong';
  }
  if (accuracy <= 25) {
    return 'fair';
  }
  return 'poor';
}

/**
 * Checks if two consecutive coordinates are duplicates (same point or negligible movement)
 */
export function isDuplicateCoordinate(
  prev: LocationCoordinate,
  next: LocationCoordinate
): boolean {
  if (
    prev.latitude === next.latitude &&
    prev.longitude === next.longitude &&
    prev.timestamp === next.timestamp
  ) {
    return true;
  }

  const distKm = calculateDistance(prev, next);
  const timeDeltaSec = Math.abs(next.timestamp - prev.timestamp) / 1000;

  // Under 0.5 meters within 1.5 seconds is considered stationary duplicate jitter
  if (distKm < 0.0005 && timeDeltaSec < 1.5) {
    return true;
  }

  return false;
}

/**
 * Detects unrealistic GPS jump anomalies (e.g., GPS multi-path glitches, cell-tower hops)
 * Evaluates the implied speed between two consecutive readings against physical human limits.
 */
export function isUnrealisticGpsJump(
  prev: LocationCoordinate,
  next: LocationCoordinate,
  activityType: ActivityType
): { isJump: boolean; reason?: string } {
  const distKm = calculateDistance(prev, next);
  const distMeters = distKm * 1000;
  const timeDeltaSec = (next.timestamp - prev.timestamp) / 1000;

  // If time hasn't advanced or is negative, ignore point
  if (timeDeltaSec <= 0) {
    return { isJump: true, reason: 'Invalid non-positive timestamp interval' };
  }

  const speedKmh = (distKm / (timeDeltaSec / 3600));

  // Activity-based plausible speed ceilings
  let maxPlausibleSpeedKmh = 25; // default walking
  if (activityType === 'running') {
    maxPlausibleSpeedKmh = 45; // sprinting world record is ~44 km/h
  } else if (activityType === 'cycling') {
    maxPlausibleSpeedKmh = 100; // cycling downhill sprint
  }

  // Check 1: Speed exceeds human physical possibility for this activity
  if (speedKmh > maxPlausibleSpeedKmh) {
    return {
      isJump: true,
      reason: `Implied speed ${speedKmh.toFixed(1)} km/h exceeds maximum plausible ${maxPlausibleSpeedKmh} km/h for ${activityType}`,
    };
  }

  // Check 2: Sudden instant jump of over 70 meters in under 2 seconds
  if (distMeters > 70 && timeDeltaSec <= 2) {
    return {
      isJump: true,
      reason: `Sudden distance jump of ${distMeters.toFixed(0)}m in ${timeDeltaSec.toFixed(1)}s`,
    };
  }

  return { isJump: false };
}

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

  const baseCalories = met * userWeightKg * durationHours;
  return Math.round(Math.max(1, baseCalories));
}
