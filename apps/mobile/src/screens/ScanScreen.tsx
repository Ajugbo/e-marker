import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function ScanScreen() {
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>Exam Marker</Text>
        <Text style={styles.subtitle}>AI-Powered Grading</Text>
      </View>

      {/* Camera Placeholder */}
      <View style={styles.cameraPlaceholder}>
        <Ionicons name="videocam" size={80} color="#2563eb" />
        <Text style={styles.cameraText}>Camera Feed</Text>
        <Text style={styles.cameraSubtext}>Point camera at script</Text>
      </View>

      {/* Instructions */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#2563eb" />
        <Text style={styles.infoText}>
          Video Scan: Record the entire script in one go. The AI will automatically detect pages and grade them.
        </Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity style={styles.scanButton}>
        <Ionicons name="play" size={24} color="#fff" />
        <Text style={styles.scanButtonText}>Start Video Scan</Text>
      </TouchableOpacity>

      {/* Secondary Action */}
      <TouchableOpacity style={styles.uploadButton}>
        <Ionicons name="cloud-upload" size={20} color="#2563eb" />
        <Text style={styles.uploadButtonText}>Upload Existing PDF/Images</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    alignItems: 'center',
  },
  header: {
    marginTop: 40,
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 5,
  },
  cameraPlaceholder: {
    width: width * 0.9,
    height: 250,
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  cameraText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 10,
  },
  cameraSubtext: {
    fontSize: 14,
    color: '#94a3b8',
  },
  infoCard: {
    width: width * 0.9,
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  scanButton: {
    width: width * 0.9,
    height: 56,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  uploadButton: {
    width: width * 0.9,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  uploadButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});
