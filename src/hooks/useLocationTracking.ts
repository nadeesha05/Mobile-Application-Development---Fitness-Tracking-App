import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ActivityType,
  TrackingStatus,
  LocationCoordinate,
  ActivitySummaryData,
  GpsSignalQuality,
} from '../types/tracking';
import { locationService, LocationServiceError } from '../services/locationService';
import {
  calculateDistance,
  calculateAverageSpeed,
  calculateAveragePace,
  convertMpsToKmh,
  estimateCalories,
  isGpsAccuracyAcceptable,
  getGpsSignalQuality,
  isDuplicateCoordinate,
  isUnrealisticGpsJump,
  MAX_ACCEPTABLE_ACCURACY_METERS,
} from '../utils/geo';

export interface UseLocationTrackingReturn {
  activityType: ActivityType;
  status: TrackingStatus;
  statusMessage: string;
  gpsSignalQuality: GpsSignalQuality;
  accuracyWarning: string | null;
  coordinates: LocationCoordinate[];
  currentLocation: LocationCoordinate | null;
  distance: number; // km
  duration: number; // seconds
  currentSpeed: number; // km/h
  averageSpeed: number; // km/h
  averagePace: string; // "MM:SS /km"
  error: string | null;
  permissionGranted: boolean | null;
  isServicesDisabled: boolean;
  discardedJumpCount: number;
  summary: ActivitySummaryData | null;
  setActivityType: (type: ActivityType) => void;
  startTracking: () => Promise<void>;
  pauseTracking: () => Promise<void>;
  resumeTracking: () => Promise<void>;
  finishTracking: () => ActivitySummaryData | null;
  resetTracking: () => void;
  requestPermission: () => Promise<boolean>;
  clearError: () => void;
}

export function useLocationTracking(
  initialActivityType: ActivityType = 'running'
): UseLocationTrackingReturn {
  const [activityType, setActivityType] = useState<ActivityType>(initialActivityType);
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [gpsSignalQuality, setGpsSignalQuality] = useState<GpsSignalQuality>('searching');
  const [accuracyWarning, setAccuracyWarning] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<LocationCoordinate[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinate | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isServicesDisabled, setIsServicesDisabled] = useState<boolean>(false);
  const [discardedJumpCount, setDiscardedJumpCount] = useState<number>(0);
  const [summary, setSummary] = useState<ActivitySummaryData | null>(null);

  // Synchronous refs to prevent race conditions and stale closures
  const statusRef = useRef<TrackingStatus>('idle');
  statusRef.current = status;

  const isStartingRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const coordinatesRef = useRef<LocationCoordinate[]>([]);
  coordinatesRef.current = coordinates;

  const distanceRef = useRef<number>(0);
  distanceRef.current = distance;

  const durationRef = useRef<number>(0);
  durationRef.current = duration;

  const discardedJumpsRef = useRef<number>(0);
  discardedJumpsRef.current = discardedJumpCount;

  const activityTypeRef = useRef<ActivityType>(activityType);
  activityTypeRef.current = activityType;

  // Cleanup helper for timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Timer starter
  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, [stopTimer]);

  // Initial diagnostics on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const [permResult, servicesEnabled] = await Promise.all([
        locationService.checkPermission(),
        locationService.isLocationServicesEnabled(),
      ]);

      if (isMounted) {
        setPermissionGranted(permResult.granted);
        setIsServicesDisabled(!servicesEnabled);
        if (!permResult.granted) {
          setGpsSignalQuality('unavailable');
        } else if (!servicesEnabled) {
          setGpsSignalQuality('unavailable');
          setError('Location services are turned off on your device.');
        } else {
          setGpsSignalQuality('searching');
        }
      }
    })();

    // Robust unmount cleanup to prevent memory leaks and dangling subscriptions
    return () => {
      isMounted = false;
      stopTimer();
      locationService.stopLocationUpdates();
    };
  }, [stopTimer]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await locationService.requestPermission();
      setPermissionGranted(result.granted);
      if (!result.granted) {
        setError('Location permission is required to track activities.');
        setGpsSignalQuality('unavailable');
      } else {
        setError(null);
        setGpsSignalQuality('searching');
      }
      return result.granted;
    } catch (err: any) {
      setError(err?.message || 'Failed to request location permission.');
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Handle incoming GPS coordinates with accuracy filtering & jump protection
  const handleLocationUpdate = useCallback((coord: LocationCoordinate) => {
    if (statusRef.current !== 'tracking') return;

    // 1. Update current location telemetry regardless of accuracy so user sees device readout
    setCurrentLocation(coord);
    const speedKmh = convertMpsToKmh(coord.speed);
    setCurrentSpeed(speedKmh);

    // 2. Evaluate GPS Signal Quality
    const quality = getGpsSignalQuality(coord.accuracy);
    setGpsSignalQuality(quality);

    // 3. Accuracy Filter (Requirement 1): Discard inaccurate coordinates
    if (!isGpsAccuracyAcceptable(coord.accuracy, MAX_ACCEPTABLE_ACCURACY_METERS)) {
      const acc = coord.accuracy ? Math.round(coord.accuracy) : 'unknown';
      setAccuracyWarning(`GPS signal weak (±${acc}m). Waiting for better accuracy...`);
      return;
    }

    // Clear warning when accuracy is good
    setAccuracyWarning(null);

    const prevCoords = coordinatesRef.current;
    const lastCoord = prevCoords[prevCoords.length - 1];

    if (lastCoord) {
      // 4. Duplicate Check (Requirement 4): Prevent duplicate points
      if (isDuplicateCoordinate(lastCoord, coord)) {
        return;
      }

      // 5. Jump Filter (Requirement 6): Discard unrealistic teleportations
      const jumpCheck = isUnrealisticGpsJump(
        lastCoord,
        coord,
        activityTypeRef.current
      );

      if (jumpCheck.isJump) {
        console.warn('[GPS Filter] Discarded unrealistic jump:', jumpCheck.reason);
        setDiscardedJumpCount((prev) => prev + 1);
        return;
      }

      // 6. Valid increment: add distance
      const increment = calculateDistance(lastCoord, coord);
      if (increment > 0.001) {
        setDistance((prevDist) => prevDist + increment);
      }
    }

    // 7. Append safe coordinate to route
    setCoordinates((prev) => [...prev, coord]);
  }, []);

  const handleLocationError = useCallback((err: LocationServiceError | Error) => {
    console.warn('[LocationTracking] Error:', err);
    if (err instanceof LocationServiceError) {
      if (err.code === 'SERVICES_DISABLED') {
        setIsServicesDisabled(true);
        setGpsSignalQuality('unavailable');
        setError('Location services are disabled on your device. Please turn on GPS.');
      } else if (err.code === 'PERMISSION_DENIED') {
        setPermissionGranted(false);
        setGpsSignalQuality('unavailable');
        setError('Location permission was denied. Please allow location access in settings.');
      } else {
        setError(err.message || 'GPS signal lost. Searching for satellites...');
        setGpsSignalQuality('poor');
      }
    } else {
      setError(err?.message || 'An error occurred while receiving GPS updates.');
      setGpsSignalQuality('poor');
    }
  }, []);

  // START
  const startTracking = useCallback(async () => {
    // Prevent duplicate starts or calls while starting
    if (isStartingRef.current || statusRef.current === 'tracking') {
      return;
    }
    isStartingRef.current = true;

    setError(null);
    setAccuracyWarning(null);
    setSummary(null);

    // Permission check
    let granted = permissionGranted;
    if (!granted) {
      granted = await requestPermission();
      if (!granted) {
        isStartingRef.current = false;
        return;
      }
    }

    // Device GPS service check
    const servicesOn = await locationService.isLocationServicesEnabled();
    if (!servicesOn) {
      setIsServicesDisabled(true);
      setError('Location services are turned off. Please enable GPS in device settings.');
      setGpsSignalQuality('unavailable');
      isStartingRef.current = false;
      return;
    }
    setIsServicesDisabled(false);

    try {
      // Ensure previous session watchers and stats are fully reset
      await locationService.stopLocationUpdates();
      stopTimer();

      setCoordinates([]);
      setDistance(0);
      setDuration(0);
      setCurrentSpeed(0);
      setDiscardedJumpCount(0);

      startTimeRef.current = Date.now();
      setStatus('tracking');
      setGpsSignalQuality('searching');
      startTimer();

      await locationService.startLocationUpdates(
        handleLocationUpdate,
        handleLocationError
      );
    } catch (err: any) {
      stopTimer();
      setStatus('idle');
      setError(err?.message || 'Could not start GPS tracking.');
    } finally {
      isStartingRef.current = false;
    }
  }, [
    permissionGranted,
    requestPermission,
    startTimer,
    stopTimer,
    handleLocationUpdate,
    handleLocationError,
  ]);

  // PAUSE
  const pauseTracking = useCallback(async () => {
    if (statusRef.current !== 'tracking') return;
    stopTimer();
    setStatus('paused');
    setCurrentSpeed(0);
    setAccuracyWarning(null);
    // Explicitly stop GPS subscription when paused to save battery and prevent spurious points
    await locationService.stopLocationUpdates();
  }, [stopTimer]);

  // RESUME
  const resumeTracking = useCallback(async () => {
    if (statusRef.current !== 'paused') return;
    setError(null);
    setAccuracyWarning(null);
    setStatus('tracking');
    setGpsSignalQuality('searching');
    startTimer();

    try {
      await locationService.startLocationUpdates(
        handleLocationUpdate,
        handleLocationError
      );
    } catch (err: any) {
      setError(err?.message || 'Could not resume GPS tracking.');
    }
  }, [startTimer, handleLocationUpdate, handleLocationError]);

  // FINISH
  const finishTracking = useCallback((): ActivitySummaryData | null => {
    stopTimer();
    locationService.stopLocationUpdates();

    const finalDuration = durationRef.current;
    const finalDistance = distanceRef.current;
    const finalCoords = [...coordinatesRef.current];
    const finalJumps = discardedJumpsRef.current;
    const endTime = Date.now();
    const startTime = startTimeRef.current || endTime - finalDuration * 1000;

    const avgSpeed = calculateAverageSpeed(finalDistance, finalDuration);
    const avgPace = calculateAveragePace(finalDistance, finalDuration);
    const calories = estimateCalories(activityType, finalDistance, finalDuration);

    const summaryData: ActivitySummaryData = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      activityType,
      startTime,
      endTime,
      duration: finalDuration,
      distance: Number(finalDistance.toFixed(3)),
      averageSpeed: Number(avgSpeed.toFixed(2)),
      averagePace: avgPace,
      caloriesBurned: calories,
      coordinates: finalCoords,
      discardedJumpCount: finalJumps,
      createdAt: new Date().toISOString(),
    };

    setSummary(summaryData);
    setStatus('finished');
    setCurrentSpeed(0);
    setAccuracyWarning(null);

    return summaryData;
  }, [activityType, stopTimer]);

  // RESET
  const resetTracking = useCallback(() => {
    stopTimer();
    locationService.stopLocationUpdates();
    setStatus('idle');
    setCoordinates([]);
    setCurrentLocation(null);
    setDistance(0);
    setDuration(0);
    setCurrentSpeed(0);
    setError(null);
    setAccuracyWarning(null);
    setSummary(null);
    setDiscardedJumpCount(0);
    setGpsSignalQuality(permissionGranted ? 'searching' : 'unavailable');
  }, [stopTimer, permissionGranted]);

  // Computed live metrics
  const averageSpeed = calculateAverageSpeed(distance, duration);
  const averagePace = calculateAveragePace(distance, duration);

  // Requirement 3: User-friendly status message
  const statusMessage = useMemo(() => {
    if (permissionGranted === false) {
      return 'Location permission required';
    }
    if (isServicesDisabled) {
      return 'Location services disabled';
    }
    if (status === 'idle') {
      return 'GPS Ready';
    }
    if (status === 'paused') {
      return 'Paused';
    }
    if (status === 'finished') {
      return 'Finished';
    }
    if (status === 'tracking') {
      if (gpsSignalQuality === 'poor' || accuracyWarning !== null) {
        return 'GPS signal weak';
      }
      return 'Tracking';
    }
    return 'GPS Ready';
  }, [status, permissionGranted, isServicesDisabled, gpsSignalQuality, accuracyWarning]);

  return {
    activityType,
    status,
    statusMessage,
    gpsSignalQuality,
    accuracyWarning,
    coordinates,
    currentLocation,
    distance,
    duration,
    currentSpeed,
    averageSpeed,
    averagePace,
    error,
    permissionGranted,
    isServicesDisabled,
    discardedJumpCount,
    summary,
    setActivityType,
    startTracking,
    pauseTracking,
    resumeTracking,
    finishTracking,
    resetTracking,
    requestPermission,
    clearError,
  };
}

export default useLocationTracking;
