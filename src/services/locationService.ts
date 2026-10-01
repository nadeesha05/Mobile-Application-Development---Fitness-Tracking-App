import * as Location from 'expo-location';
import { LocationCoordinate } from '../types/tracking';
import { isValidCoordinate } from '../utils/geo';

export interface LocationPermissionResult {
  granted: boolean;
  status: Location.PermissionStatus;
  canAskAgain: boolean;
}

export interface LocationServiceOptions {
  accuracy?: Location.Accuracy;
  timeInterval?: number;
  distanceInterval?: number;
}

export class LocationServiceError extends Error {
  code: 'PERMISSION_DENIED' | 'SERVICES_DISABLED' | 'GPS_UNAVAILABLE' | 'INVALID_COORDINATE' | 'UNKNOWN';

  constructor(
    message: string,
    code: 'PERMISSION_DENIED' | 'SERVICES_DISABLED' | 'GPS_UNAVAILABLE' | 'INVALID_COORDINATE' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'LocationServiceError';
    this.code = code;
  }
}

class LocationService {
  private subscription: Location.LocationSubscription | null = null;
  private isWatching: boolean = false;
  private isStarting: boolean = false;

  /**
   * Check if foreground location permission is currently granted
   */
  async checkPermission(): Promise<LocationPermissionResult> {
    try {
      const response = await Location.getForegroundPermissionsAsync();
      return {
        granted: response.granted,
        status: response.status,
        canAskAgain: response.canAskAgain,
      };
    } catch (error) {
      console.warn('[LocationService] Error checking location permission:', error);
      return {
        granted: false,
        status: Location.PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      };
    }
  }

  /**
   * Request foreground location permission from the user
   */
  async requestPermission(): Promise<LocationPermissionResult> {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      return {
        granted: response.granted,
        status: response.status,
        canAskAgain: response.canAskAgain,
      };
    } catch (error) {
      console.error('[LocationService] Error requesting location permission:', error);
      return {
        granted: false,
        status: Location.PermissionStatus.DENIED,
        canAskAgain: false,
      };
    }
  }

  /**
   * Verify if device location services (GPS hardware/toggle) are enabled
   */
  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.warn('[LocationService] Error checking if location services are enabled:', error);
      return false;
    }
  }

  /**
   * Fetch current GPS position once with validation
   */
  async getCurrentLocation(
    accuracy: Location.Accuracy = Location.Accuracy.High
  ): Promise<LocationCoordinate> {
    const isServiceOn = await this.isLocationServicesEnabled();
    if (!isServiceOn) {
      throw new LocationServiceError(
        'Location services are disabled on your device. Please turn on GPS in device settings.',
        'SERVICES_DISABLED'
      );
    }

    const perm = await this.checkPermission();
    if (!perm.granted) {
      const requested = await this.requestPermission();
      if (!requested.granted) {
        throw new LocationServiceError(
          'Location permission was denied. Please grant location access in app settings.',
          'PERMISSION_DENIED'
        );
      }
    }

    try {
      const location = await Location.getCurrentPositionAsync({ accuracy });
      const coord = this.mapExpoLocation(location);

      if (!isValidCoordinate(coord)) {
        throw new LocationServiceError(
          'Received invalid GPS coordinates from device sensor.',
          'INVALID_COORDINATE'
        );
      }

      return coord;
    } catch (err: any) {
      if (err instanceof LocationServiceError) throw err;
      throw new LocationServiceError(
        err?.message || 'GPS location currently unavailable. Please check your signal.',
        'GPS_UNAVAILABLE'
      );
    }
  }

  /**
   * Start listening to continuous GPS position updates.
   * Guarded against concurrent duplicate calls to prevent duplicate watchers.
   */
  async startLocationUpdates(
    onLocation: (coordinate: LocationCoordinate) => void,
    onError?: (error: LocationServiceError) => void,
    options?: LocationServiceOptions
  ): Promise<void> {
    // Prevent simultaneous start calls / race conditions
    if (this.isStarting) {
      return;
    }
    this.isStarting = true;

    try {
      // 1. Clean up any existing active subscription first to avoid duplicate callbacks
      await this.stopLocationUpdates();

      // 2. Check device location hardware toggle
      const serviceEnabled = await this.isLocationServicesEnabled();
      if (!serviceEnabled) {
        throw new LocationServiceError(
          'Location services are turned off on your device. Please turn on GPS.',
          'SERVICES_DISABLED'
        );
      }

      // 3. Ensure permission is granted
      let perm = await this.checkPermission();
      if (!perm.granted) {
        perm = await this.requestPermission();
        if (!perm.granted) {
          throw new LocationServiceError(
            'Location permission is required to track your GPS route.',
            'PERMISSION_DENIED'
          );
        }
      }

      const accuracy = options?.accuracy ?? Location.Accuracy.BestForNavigation;
      const timeInterval = options?.timeInterval ?? 1000; // 1 second
      const distanceInterval = options?.distanceInterval ?? 2; // 2 meters

      this.subscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval,
          distanceInterval,
        },
        (location) => {
          try {
            const coord = this.mapExpoLocation(location);
            if (isValidCoordinate(coord)) {
              onLocation(coord);
            } else {
              console.warn('[LocationService] Filtered out invalid coordinate:', coord);
            }
          } catch (callbackErr) {
            console.error('[LocationService] Error processing location update:', callbackErr);
          }
        }
      );

      this.isWatching = true;
    } catch (err: any) {
      this.isWatching = false;
      const locError =
        err instanceof LocationServiceError
          ? err
          : new LocationServiceError(
              err?.message || 'Failed to start GPS tracking.',
              'UNKNOWN'
            );

      if (onError) {
        onError(locError);
      } else {
        throw locError;
      }
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop watching GPS position updates safely and cleanly.
   */
  async stopLocationUpdates(): Promise<void> {
    try {
      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }
    } catch (removeErr) {
      console.warn('[LocationService] Warning during subscription removal:', removeErr);
    } finally {
      this.subscription = null;
      this.isWatching = false;
    }
  }

  /**
   * Returns whether location updates are actively running
   */
  isTrackingActive(): boolean {
    return this.isWatching;
  }

  /**
   * Helper to transform Expo LocationObject to clean LocationCoordinate
   */
  private mapExpoLocation(location: Location.LocationObject): LocationCoordinate {
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };
  }
}

export const locationService = new LocationService();
export default locationService;
