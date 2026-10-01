import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityType,
  TrackingStatus,
  LocationCoordinate,
  ActivitySummaryData,
} from '../types/tracking';
import { locationService } from '../services/locationService';
import {
  calculateDistance,
  calculateAverageSpeed,
  calculateAveragePace,
  convertMpsToKmh,
  estimateCalories,
} from '../utils/geo';

export interface UseLocationTrackingReturn {
  activityType: ActivityType;
  status: TrackingStatus;
  coordinates: LocationCoordinate[];
  currentLocation: LocationCoordinate | null;
  distance: number; // km
  duration: number; // seconds
  currentSpeed: number; // km/h
  averageSpeed: number; // km/h
  averagePace: string; // "MM:SS /km"
  error: string | null;
  permissionGranted: boolean | null;
  summary: ActivitySummaryData | null;
  setActivityType: (type: ActivityType) => void;
  startTracking: () => Promise<void>;
  pauseTracking: () => Promise<void>;
  resumeTracking: () => Promise<void>;
  finishTracking: () => ActivitySummaryData | null;
  resetTracking: () => void;
  requestPermission: () => Promise<boolean>;
}

export function useLocationTracking(
  initialActivityType: ActivityType = 'running'
): UseLocationTrackingReturn {
  const [activityType, setActivityType] = useState<ActivityType>(initialActivityType);
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [coordinates, setCoordinates] = useState<LocationCoordinate[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinate | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<ActivitySummaryData | null>(null);

  // Refs to maintain current values inside callbacks and timer intervals
  const statusRef = useRef<TrackingStatus>('idle');
  statusRef.current = status;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const coordinatesRef = useRef<LocationCoordinate[]>([]);
  coordinatesRef.current = coordinates;

  const distanceRef = useRef<number>(0);
  distanceRef.current = distance;

  const durationRef = useRef<number>(0);
  durationRef.current = duration;

  // Check initial permission status
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const result = await locationService.checkPermission();
      if (isMounted) {
        setPermissionGranted(result.granted);
      }
    })();

    return () => {
      isMounted = false;
      stopTimer();
      locationService.stopLocationUpdates();
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await locationService.requestPermission();
      setPermissionGranted(result.granted);
      if (!result.granted) {
        setError('Location permission is required to track activities.');
      } else {
        setError(null);
      }
      return result.granted;
    } catch (err: any) {
      setError(err?.message || 'Failed to request location permission.');
      return false;
    }
  }, []);

  // Handle incoming GPS coordinates
  const handleLocationUpdate = useCallback((coord: LocationCoordinate) => {
    // Only record points if status is currently tracking
    if (statusRef.current !== 'tracking') return;

    setCurrentLocation(coord);
    const speedKmh = convertMpsToKmh(coord.speed);
    setCurrentSpeed(speedKmh);

    setCoordinates((prevCoords) => {
      const lastCoord = prevCoords[prevCoords.length - 1];
      if (lastCoord) {
        const increment = calculateDistance(lastCoord, coord);
        // Ignore tiny jitter under 1 meter
        if (increment > 0.001) {
          setDistance((prevDist) => prevDist + increment);
        }
      }
      return [...prevCoords, coord];
    });
  }, []);

  const handleLocationError = useCallback((err: Error) => {
    console.warn('Location tracking error:', err);
    setError(err.message || 'An error occurred while tracking GPS.');
  }, []);

  // START
  const startTracking = useCallback(async () => {
    setError(null);
    setSummary(null);

    // Ensure permission
    let granted = permissionGranted;
    if (!granted) {
      granted = await requestPermission();
      if (!granted) return;
    }

    try {
      // Clear past session data
      setCoordinates([]);
      setDistance(0);
      setDuration(0);
      setCurrentSpeed(0);

      startTimeRef.current = Date.now();
      setStatus('tracking');
      startTimer();

      await locationService.startLocationUpdates(
        handleLocationUpdate,
        handleLocationError
      );
    } catch (err: any) {
      stopTimer();
      setStatus('idle');
      setError(err?.message || 'Could not start GPS tracking.');
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
    if (status !== 'tracking') return;
    stopTimer();
    setStatus('paused');
    setCurrentSpeed(0);
    await locationService.stopLocationUpdates();
  }, [status, stopTimer]);

  // RESUME
  const resumeTracking = useCallback(async () => {
    if (status !== 'paused') return;
    setError(null);
    setStatus('tracking');
    startTimer();

    try {
      await locationService.startLocationUpdates(
        handleLocationUpdate,
        handleLocationError
      );
    } catch (err: any) {
      setError(err?.message || 'Could not resume GPS tracking.');
    }
  }, [status, startTimer, handleLocationUpdate, handleLocationError]);

  // FINISH
  const finishTracking = useCallback((): ActivitySummaryData | null => {
    stopTimer();
    locationService.stopLocationUpdates();

    const finalDuration = durationRef.current;
    const finalDistance = distanceRef.current;
    const finalCoords = [...coordinatesRef.current];
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
      createdAt: new Date().toISOString(),
    };

    setSummary(summaryData);
    setStatus('finished');
    setCurrentSpeed(0);

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
    setSummary(null);
  }, [stopTimer]);

  // Computed live metrics
  const averageSpeed = calculateAverageSpeed(distance, duration);
  const averagePace = calculateAveragePace(distance, duration);

  return {
    activityType,
    status,
    coordinates,
    currentLocation,
    distance,
    duration,
    currentSpeed,
    averageSpeed,
    averagePace,
    error,
    permissionGranted,
    summary,
    setActivityType,
    startTracking,
    pauseTracking,
    resumeTracking,
    finishTracking,
    resetTracking,
    requestPermission,
  };
}

export default useLocationTracking;
