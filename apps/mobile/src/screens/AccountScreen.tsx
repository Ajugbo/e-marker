import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

export default function AccountScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>Credits: 50</Text>
      <View style={styles.buttonContainer}>
        <Button title="Buy Credits" onPress={() => {}} color="#2563eb" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'gray', marginBottom: 20 },
  buttonContainer: { width: 200 },
});
