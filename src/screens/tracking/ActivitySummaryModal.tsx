import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { ActivitySummaryData } from '../../types/tracking';
import { formatDuration, formatDistance, formatSpeed } from '../../utils/geo';
import { RouteMapVisualizer } from './RouteMapVisualizer';

interface ActivitySummaryModalProps {
  visible: boolean;
  summary: ActivitySummaryData | null;
  onClose: () => void;
}

export const ActivitySummaryModal: React.FC<ActivitySummaryModalProps> = ({
  visible,
  summary,
  onClose,
}) => {
  const [showJsonPayload, setShowJsonPayload] = useState<boolean>(false);

  if (!summary) return null;

  const formattedStartTime = new Date(summary.startTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedEndTime = new Date(summary.endTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = new Date(summary.startTime).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const activityBadgeColor =
    summary.activityType === 'running'
      ? '#10B981'
      : summary.activityType === 'cycling'
      ? '#38BDF8'
      : '#F59E0B';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.congratsBadge}>
              <Text style={styles.congratsEmoji}>🏁</Text>
              <Text style={styles.headerSubtitle}>WORKOUT COMPLETED</Text>
            </View>
            <Text style={styles.headerTitle}>Activity Summary</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>

          {/* Activity Type Badge */}
          <View style={styles.activityBadgeContainer}>
            <View
              style={[
                styles.activityBadge,
                { backgroundColor: `${activityBadgeColor}20`, borderColor: activityBadgeColor },
              ]}
            >
              <Text style={[styles.activityBadgeText, { color: activityBadgeColor }]}>
                {summary.activityType.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Main Primary Stat: Distance */}
          <View style={styles.primaryStatBox}>
            <Text style={styles.primaryStatLabel}>TOTAL DISTANCE</Text>
            <Text style={styles.primaryStatValue}>
              {formatDistance(summary.distance)}
            </Text>
          </View>

          {/* 2x2 Key Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>DURATION</Text>
              <Text style={styles.metricValue}>
                {formatDuration(summary.duration)}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>AVG SPEED</Text>
              <Text style={styles.metricValue}>
                {formatSpeed(summary.averageSpeed)}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>AVG PACE</Text>
              <Text style={styles.metricValue}>{summary.averagePace}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>EST. CALORIES</Text>
              <Text style={styles.metricValue}>
                {summary.caloriesBurned} kcal
              </Text>
            </View>
          </View>

          {/* Timeline Box */}
          <View style={styles.timelineBox}>
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>START TIME</Text>
              <Text style={styles.timelineValue}>{formattedStartTime}</Text>
            </View>
            <View style={styles.timelineDivider} />
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>END TIME</Text>
              <Text style={styles.timelineValue}>{formattedEndTime}</Text>
            </View>
            <View style={styles.timelineDivider} />
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>GPS WAYPOINTS</Text>
              <Text style={styles.timelineValue}>
                {summary.coordinates.length} pts
              </Text>
            </View>
          </View>

          {/* Anomaly filter notice */}
          {summary.discardedJumpCount != null && summary.discardedJumpCount > 0 && (
            <View style={styles.anomalyNotice}>
              <Text style={styles.anomalyNoticeText}>
                🛡️ Filtered {summary.discardedJumpCount} unrealistic GPS jump {summary.discardedJumpCount === 1 ? 'anomaly' : 'anomalies'} to preserve distance accuracy.
              </Text>
            </View>
          )}

          {/* GPS Route Map Visualizer */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recorded GPS Trail</Text>
          </View>
          <RouteMapVisualizer
            coordinates={summary.coordinates}
            currentLocation={
              summary.coordinates.length > 0
                ? summary.coordinates[summary.coordinates.length - 1]
                : null
            }
            status="finished"
            discardedJumpCount={summary.discardedJumpCount || 0}
          />

          {/* JSON Payload Inspection Toggle (Ready for Member 1 / Firebase) */}
          <TouchableOpacity
            style={styles.jsonToggleBtn}
            onPress={() => setShowJsonPayload((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.jsonToggleBtnText}>
              {showJsonPayload
                ? '▼ Hide Firebase Structured Payload'
                : '▶ Inspect Firebase Structured Payload (for Database)'}
            </Text>
          </TouchableOpacity>

          {showJsonPayload && (
            <View style={styles.jsonContainer}>
              <Text style={styles.jsonText}>
                {JSON.stringify(
                  {
                    id: summary.id,
                    activityType: summary.activityType,
                    distanceKm: summary.distance,
                    durationSeconds: summary.duration,
                    averageSpeedKmh: summary.averageSpeed,
                    averagePace: summary.averagePace,
                    caloriesBurned: summary.caloriesBurned,
                    startTime: summary.startTime,
                    endTime: summary.endTime,
                    createdAt: summary.createdAt,
                    coordinatesCount: summary.coordinates.length,
                    discardedJumpCount: summary.discardedJumpCount || 0,
                    sampleCoordinates: summary.coordinates.slice(0, 3),
                  },
                  null,
                  2
                )}
              </Text>
            </View>
          )}

          {/* Done Button */}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done & Save</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  congratsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  congratsEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  headerSubtitle: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  dateText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  activityBadgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  activityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  primaryStatBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  primaryStatLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  primaryStatValue: {
    color: '#38BDF8',
    fontSize: 40,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    width: '48%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  timelineBox: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  timelineItem: {
    flex: 1,
    alignItems: 'center',
  },
  timelineLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timelineValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  timelineDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#334155',
  },
  anomalyNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  anomalyNoticeText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 2,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  jsonToggleBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 12,
    alignItems: 'center',
  },
  jsonToggleBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  jsonContainer: {
    backgroundColor: '#020617',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  jsonText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  doneButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default ActivitySummaryModal;
