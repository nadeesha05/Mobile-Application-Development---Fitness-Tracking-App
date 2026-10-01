import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import TrackingScreen from './src/screens/tracking/TrackingScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TrackingScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
});

