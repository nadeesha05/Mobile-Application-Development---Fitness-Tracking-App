import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { ActivityType } from '../../types/tracking';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import { formatDuration, formatDistance, formatSpeed } from '../../utils/geo';
import { RouteMapVisualizer } from './RouteMapVisualizer';
import { ActivitySummaryModal } from './ActivitySummaryModal';

export const TrackingScreen: React.FC = () => {
  const {
    activityType,
    status,
    coordinates,
    currentLocation,
    distance,
    duration,
    currentSpeed,
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
  } = useLocationTracking('running');

  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);

  const handleFinish = () => {
    Alert.alert(
      'Finish Activity?',
      'Are you sure you want to end this workout session?',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Finish Workout',
          style: 'destructive',
          onPress: () => {
            const result = finishTracking();
            if (result) {
              setShowSummaryModal(true);
            }
          },
        },
      ]
    );
  };

  const handleSummaryClose = () => {
    setShowSummaryModal(false);
    resetTracking();
  };

  const activities: { type: ActivityType; label: string; icon: string; color: string }[] = [
    { type: 'walking', label: 'Walking', icon: '🚶', color: '#F59E0B' },
    { type: 'running', label: 'Running', icon: '🏃', color: '#10B981' },
    { type: 'cycling', label: 'Cycling', icon: '🚴', color: '#38BDF8' },
  ];

  const currentActivityInfo = activities.find((a) => a.type === activityType) || activities[1];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1120" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.appTitle}>FitTrack</Text>
            <Text style={styles.screenSubtitle}>GPS Activity Tracker (Member 2)</Text>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusPill,
              status === 'tracking'
                ? styles.statusPillTracking
                : status === 'paused'
                ? styles.statusPillPaused
                : styles.statusPillIdle,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                status === 'tracking'
                  ? styles.statusTextTracking
                  : status === 'paused'
                  ? styles.statusTextPaused
                  : styles.statusTextIdle,
              ]}
            >
              {status === 'tracking'
                ? 'RECORDING'
                : status === 'paused'
                ? 'PAUSED'
                : 'READY'}
            </Text>
          </View>
        </View>

        {/* Error / Permission Warning Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {permissionGranted === false && (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>GPS Permission Needed</Text>
            <Text style={styles.permissionText}>
              Enable location permissions so FitTrack can map your route and measure pace.
            </Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionBtnText}>Allow Location Access</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Activity Selection Carousel (Enabled when idle) */}
        {status === 'idle' && (
          <View style={styles.activitySelectorSection}>
            <Text style={styles.sectionLabel}>SELECT ACTIVITY</Text>
            <View style={styles.activityTabs}>
              {activities.map((act) => {
                const isSelected = activityType === act.type;
                return (
                  <TouchableOpacity
                    key={act.type}
                    style={[
                      styles.activityTab,
                      isSelected && {
                        backgroundColor: '#1E293B',
                        borderColor: act.color,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setActivityType(act.type)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.activityTabIcon}>{act.icon}</Text>
                    <Text
                      style={[
                        styles.activityTabLabel,
                        isSelected && { color: act.color, fontWeight: '800' },
                      ]}
                    >
                      {act.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Live Tracking HUD */}
        <View style={styles.liveHudCard}>
          {/* Active Activity Indicator */}
          <View style={styles.hudActivityRow}>
            <Text style={styles.hudActivityIcon}>{currentActivityInfo.icon}</Text>
            <Text
              style={[
                styles.hudActivityTitle,
                { color: currentActivityInfo.color },
              ]}
            >
              {currentActivityInfo.label.toUpperCase()}
            </Text>
          </View>

          {/* Large Duration Timer */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>DURATION</Text>
            <Text style={styles.timerValue}>{formatDuration(duration)}</Text>
          </View>

          {/* 3-Column Metrics Row */}
          <View style={styles.metricsRow}>
            {/* Distance */}
            <View style={styles.metricColumn}>
              <Text style={styles.metricLabel}>DISTANCE</Text>
              <Text style={styles.metricLargeNumber}>
                {distance >= 1 ? distance.toFixed(2) : (distance * 1000).toFixed(0)}
              </Text>
              <Text style={styles.metricUnit}>{distance >= 1 ? 'km' : 'meters'}</Text>
            </View>

            <View style={styles.metricDivider} />

            {/* Current Speed */}
            <View style={styles.metricColumn}>
              <Text style={styles.metricLabel}>SPEED</Text>
              <Text style={styles.metricLargeNumber}>
                {Math.max(0, currentSpeed).toFixed(1)}
              </Text>
              <Text style={styles.metricUnit}>km/h</Text>
            </View>

            <View style={styles.metricDivider} />

            {/* Average Pace */}
            <View style={styles.metricColumn}>
              <Text style={styles.metricLabel}>AVG PACE</Text>
              <Text style={styles.metricLargeNumber}>
                {averagePace.split(' ')[0]}
              </Text>
              <Text style={styles.metricUnit}>min/km</Text>
            </View>
          </View>
        </View>

        {/* GPS Map & Breadcrumb Visualizer */}
        <RouteMapVisualizer
          coordinates={coordinates}
          currentLocation={currentLocation}
          status={status}
        />

        {/* Bottom Action Controls */}
        <View style={styles.controlsContainer}>
          {/* IDLE State -> START */}
          {status === 'idle' && (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: currentActivityInfo.color },
              ]}
              onPress={startTracking}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>
                START {currentActivityInfo.label.toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}

          {/* TRACKING State -> PAUSE & FINISH */}
          {status === 'tracking' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.pauseBtn]}
                onPress={pauseTracking}
                activeOpacity={0.8}
              >
                <Text style={styles.pauseBtnText}>⏸ PAUSE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.finishBtn]}
                onPress={handleFinish}
                activeOpacity={0.8}
              >
                <Text style={styles.finishBtnText}>⏹ FINISH</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PAUSED State -> RESUME & FINISH */}
          {status === 'paused' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.resumeBtn]}
                onPress={resumeTracking}
                activeOpacity={0.8}
              >
                <Text style={styles.resumeBtnText}>▶ RESUME</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.finishBtn]}
                onPress={handleFinish}
                activeOpacity={0.8}
              >
                <Text style={styles.finishBtnText}>⏹ FINISH</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Summary Modal on Finish */}
      <ActivitySummaryModal
        visible={showSummaryModal}
        summary={summary}
        onClose={handleSummaryClose}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    padding: 18,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusPillIdle: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  statusPillTracking: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  statusPillPaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusTextIdle: {
    color: '#94A3B8',
  },
  statusTextTracking: {
    color: '#10B981',
  },
  statusTextPaused: {
    color: '#F59E0B',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 16,
  },
  permissionTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  permissionText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  permissionBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  permissionBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  activitySelectorSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  activityTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityTab: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activityTabIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  activityTabLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  liveHudCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  hudActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  hudActivityIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  hudActivityTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  timerLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  timerValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metricLargeNumber: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#334155',
  },
  controlsContainer: {
    marginTop: 8,
  },
  primaryBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#0B1120',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  pauseBtn: {
    backgroundColor: '#F59E0B',
  },
  pauseBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resumeBtn: {
    backgroundColor: '#10B981',
  },
  resumeBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  finishBtn: {
    backgroundColor: '#EF4444',
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default TrackingScreen;
