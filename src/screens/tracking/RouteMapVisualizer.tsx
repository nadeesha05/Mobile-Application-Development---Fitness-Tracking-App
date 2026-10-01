import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LocationCoordinate, TrackingStatus } from '../../types/tracking';

interface RouteMapVisualizerProps {
  coordinates: LocationCoordinate[];
  currentLocation: LocationCoordinate | null;
  status: TrackingStatus;
}

export const RouteMapVisualizer: React.FC<RouteMapVisualizerProps> = ({
  coordinates,
  currentLocation,
  status,
}) => {
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 180;
  const PADDING = 24;

  // Project lat/lng coordinates to 2D view canvas coordinates
  const projectedPoints = useMemo(() => {
    if (coordinates.length === 0) return [];

    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLng = coordinates[0].longitude;
    let maxLng = coordinates[0].longitude;

    for (const c of coordinates) {
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
    }

    const latSpan = Math.max(maxLat - minLat, 0.0001);
    const lngSpan = Math.max(maxLng - minLng, 0.0001);

    const usableWidth = CANVAS_WIDTH - PADDING * 2;
    const usableHeight = CANVAS_HEIGHT - PADDING * 2;

    return coordinates.map((c) => {
      // longitude maps to X (left to right)
      const x = PADDING + ((c.longitude - minLng) / lngSpan) * usableWidth;
      // latitude maps to Y (inverted: higher latitude is North / top)
      const y = PADDING + (1 - (c.latitude - minLat) / latSpan) * usableHeight;
      return { x, y };
    });
  }, [coordinates]);

  const latestPoint = projectedPoints[projectedPoints.length - 1];
  const startPoint = projectedPoints[0];

  return (
    <View style={styles.container}>
      {/* Header bar with GPS status indicator */}
      <View style={styles.header}>
        <View style={styles.statusDotRow}>
          <View
            style={[
              styles.statusDot,
              status === 'tracking'
                ? styles.statusDotActive
                : status === 'paused'
                ? styles.statusDotPaused
                : styles.statusDotIdle,
            ]}
          />
          <Text style={styles.headerText}>
            {status === 'tracking'
              ? 'GPS TRACKING ACTIVE'
              : status === 'paused'
              ? 'GPS PAUSED'
              : 'GPS READY'}
          </Text>
        </View>

        <Text style={styles.pointsCount}>
          {coordinates.length} {coordinates.length === 1 ? 'point' : 'points'}
        </Text>
      </View>

      {/* Visual Route Canvas */}
      <View style={styles.canvas}>
        {/* Subtle grid lines background */}
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineVertical} />

        {projectedPoints.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.radarCircleOuter}>
              <View style={styles.radarCircleInner}>
                <View style={styles.radarDot} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>
              {status === 'tracking'
                ? 'Acquiring GPS Signal...'
                : 'Route Preview'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {status === 'tracking'
                ? 'Move outdoors for better satellite visibility'
                : 'Start an activity to record your GPS trail'}
            </Text>
          </View>
        ) : (
          <View style={StyleSheet.absoluteFill}>
            {/* Draw connection trails between consecutive projected points */}
            {projectedPoints.map((pt, index) => {
              if (index === 0) return null;
              const prev = projectedPoints[index - 1];
              const dx = pt.x - prev.x;
              const dy = pt.y - prev.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={`seg-${index}`}
                  style={[
                    styles.trailSegment,
                    {
                      left: prev.x,
                      top: prev.y,
                      width: Math.max(length, 2),
                      transform: [
                        { translateX: 0 },
                        { translateY: -1.5 },
                        { rotate: `${angle}deg` },
                      ],
                    },
                  ]}
                />
              );
            })}

            {/* Breadcrumb waypoint dots (rendered every few points to keep performant) */}
            {projectedPoints.map((pt, index) => {
              const isFirst = index === 0;
              const isLast = index === projectedPoints.length - 1;
              if (!isFirst && !isLast && index % 2 !== 0) return null;

              return (
                <View
                  key={`pt-${index}`}
                  style={[
                    styles.breadcrumbDot,
                    { left: pt.x - 3, top: pt.y - 3 },
                  ]}
                />
              );
            })}

            {/* Start point marker */}
            {startPoint && (
              <View
                style={[
                  styles.startMarker,
                  { left: startPoint.x - 7, top: startPoint.y - 7 },
                ]}
              >
                <Text style={styles.markerText}>S</Text>
              </View>
            )}

            {/* Latest point / current position marker */}
            {latestPoint && (
              <View
                style={[
                  styles.currentMarkerPulse,
                  { left: latestPoint.x - 12, top: latestPoint.y - 12 },
                ]}
              >
                <View style={styles.currentMarkerInner} />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Coordinate Telemetry Bar */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>LAT</Text>
          <Text style={styles.telemetryValue}>
            {currentLocation ? currentLocation.latitude.toFixed(5) : '--.-----'}
          </Text>
        </View>

        <View style={styles.telemetryDivider} />

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>LON</Text>
          <Text style={styles.telemetryValue}>
            {currentLocation ? currentLocation.longitude.toFixed(5) : '--.-----'}
          </Text>
        </View>

        <View style={styles.telemetryDivider} />

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>ACCURACY</Text>
          <Text style={styles.telemetryValue}>
            {currentLocation?.accuracy
              ? `±${Math.round(currentLocation.accuracy)}m`
              : 'Ready'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotPaused: {
    backgroundColor: '#F59E0B',
  },
  statusDotIdle: {
    backgroundColor: '#94A3B8',
  },
  headerText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pointsCount: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  canvas: {
    width: '100%',
    height: 180,
    backgroundColor: '#0B1120',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  radarCircleOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  radarCircleInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  emptyTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  trailSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#38BDF8',
    borderRadius: 1.5,
    transformOrigin: 'left center',
  },
  breadcrumbDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  startMarker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  currentMarkerPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  currentMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#38BDF8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  telemetryItem: {
    alignItems: 'center',
  },
  telemetryLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  telemetryValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  telemetryDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#334155',
  },
});

export default RouteMapVisualizer;
