import * as Location from 'expo-location';
import { LocationCoordinate } from '../types/tracking';

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

class LocationService {
  private subscription: Location.LocationSubscription | null = null;
  private isWatching: boolean = false;

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
      console.warn('Error checking location permission:', error);
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
      console.error('Error requesting location permission:', error);
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
      console.warn('Error checking if location services are enabled:', error);
      return false;
    }
  }

  /**
   * Fetch current GPS position once
   */
  async getCurrentLocation(
    accuracy: Location.Accuracy = Location.Accuracy.High
  ): Promise<LocationCoordinate> {
    const isServiceOn = await this.isLocationServicesEnabled();
    if (!isServiceOn) {
      throw new Error(
        'GPS / Location service is turned off on your device. Please enable GPS in device settings.'
      );
    }

    const perm = await this.checkPermission();
    if (!perm.granted) {
      const requested = await this.requestPermission();
      if (!requested.granted) {
        throw new Error('Location permission was denied.');
      }
    }

    const location = await Location.getCurrentPositionAsync({ accuracy });
    return this.mapExpoLocation(location);
  }

  /**
   * Start listening to continuous GPS position updates
   */
  async startLocationUpdates(
    onLocation: (coordinate: LocationCoordinate) => void,
    onError?: (error: Error) => void,
    options?: LocationServiceOptions
  ): Promise<void> {
    try {
      // 1. Check device location hardware toggle
      const serviceEnabled = await this.isLocationServicesEnabled();
      if (!serviceEnabled) {
        throw new Error(
          'Location services are disabled on your device. Please turn on GPS.'
        );
      }

      // 2. Ensure permission
      let perm = await this.checkPermission();
      if (!perm.granted) {
        perm = await this.requestPermission();
        if (!perm.granted) {
          throw new Error(
            'Location permission is required to track your GPS route.'
          );
        }
      }

      // 3. Stop any existing watcher before starting a new one
      await this.stopLocationUpdates();

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
          const coord = this.mapExpoLocation(location);
          onLocation(coord);
        }
      );

      this.isWatching = true;
    } catch (err: any) {
      this.isWatching = false;
      const error = err instanceof Error ? err : new Error(String(err));
      if (onError) {
        onError(error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Stop watching GPS position updates
   */
  async stopLocationUpdates(): Promise<void> {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isWatching = false;
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
