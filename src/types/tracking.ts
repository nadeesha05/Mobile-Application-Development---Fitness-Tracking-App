export type ActivityType = 'walking' | 'running' | 'cycling';

export type TrackingStatus = 'idle' | 'tracking' | 'paused' | 'finished';

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null; // meters per second
  heading?: number | null;
  timestamp: number;
}

export interface ActivitySummaryData {
  id: string;
  activityType: ActivityType;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  distance: number; // in kilometers
  averageSpeed: number; // in km/h
  averagePace: string; // formatted "MM:SS /km"
  caloriesBurned: number; // estimated kcal
  coordinates: LocationCoordinate[];
  createdAt: string;
}

export interface TrackingState {
  activityType: ActivityType;
  status: TrackingStatus;
  coordinates: LocationCoordinate[];
  currentLocation: LocationCoordinate | null;
  distance: number; // in kilometers
  duration: number; // in seconds
  currentSpeed: number; // in km/h
  averageSpeed: number; // in km/h
  averagePace: string; // in "MM:SS /km"
  error: string | null;
  permissionGranted: boolean | null;
}
