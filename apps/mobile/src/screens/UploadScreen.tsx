import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function UploadScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Script</Text>
      <Text style={styles.subtitle}>Select files to upload.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subtitle: { fontSize: 16, color: 'gray' },
});
