import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ResultsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Results</Text>
      <Text style={styles.subtitle}>List of graded scripts.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subtitle: { fontSize: 16, color: 'gray' },
});
