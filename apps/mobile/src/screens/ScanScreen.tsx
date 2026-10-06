import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { theme } from '../constants/theme';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90;

type ScriptResponse = {
  script: {
    status: string;
    grade: { totalScore: number; feedback: string | null } | null;
  };
  error?: string;
};

export default function ScanScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [studentName, setStudentName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [grade, setGrade] = useState<ScriptResponse['script']['grade']>(null);

  const pollForGrade = async (scriptId: string) => {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const response = await fetch(`${API_BASE_URL}/api/scripts/${scriptId}`, {
        credentials: 'include',
      });
      const result = await response.json() as ScriptResponse;
      if (!response.ok) throw new Error(result.error ?? 'Could not check grading status.');

      if (result.script.status === 'graded' && result.script.grade) {
        setGrade(result.script.grade);
        setStatusMessage('Grading complete');
        return;
      }
      if (result.script.status === 'failed') {
        throw new Error('Processing failed. Please upload the recording again.');
      }
      setStatusMessage(result.script.status === 'processing' ? 'Reading the script…' : 'Preparing the grade…');
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error('Grading is taking longer than expected. Check Results later.');
  };

  const uploadAndPoll = async (uri: string) => {
    if (!studentName.trim() || !matricNumber.trim() || !studentClass.trim()) {
      throw new Error('Enter the student name, matric number, and class before recording.');
    }

    setIsUploading(true);
    setGrade(null);
    setErrorMessage('');
    setStatusMessage('Uploading video…');
    try {
      const formData = new FormData();
      formData.append('studentName', studentName.trim());
      formData.append('matricNumber', matricNumber.trim());
      formData.append('class', studentClass.trim());
      const fileName = uri.split('/').pop() || 'exam-script.mp4';
      formData.append('file', {
        uri,
        name: fileName,
        type: fileName.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
      } as unknown as Blob);

      const response = await fetch(`${API_BASE_URL}/api/scripts/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? 'Video upload failed.');
      await pollForGrade(result.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload this recording.');
      setStatusMessage('');
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setErrorMessage('Camera access is required to record a script.');
        return;
      }
    }
    if (!studentName.trim() || !matricNumber.trim() || !studentClass.trim()) {
      setErrorMessage('Enter the student name, matric number, and class before recording.');
      return;
    }
    if (!cameraRef.current) {
      setErrorMessage('Camera is not ready yet. Try again in a moment.');
      return;
    }

    setErrorMessage('');
    setGrade(null);
    setStatusMessage('Recording…');
    setIsRecording(true);
    try {
      const recording = await cameraRef.current.recordAsync({ maxDuration: 180 });
      if (recording?.uri) await uploadAndPoll(recording.uri);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not record the script.');
      setStatusMessage('');
    } finally {
      setIsRecording(false);
    }
  };

  const onRecordPress = () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }
    void startRecording();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>E-Marker</Text>
        <Text style={styles.subtitle}>Record a script for grading</Text>
      </View>

      <View style={styles.cameraPlaceholder}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="video" videoQuality="720p" />
        ) : (
          <View style={styles.permissionPrompt}>
            <Ionicons name="videocam" size={44} color={theme.colors.primary} />
            <Text style={styles.cameraText}>Camera access needed</Text>
            <TouchableOpacity onPress={() => void requestPermission()} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Student details</Text>
        <TextInput
          accessibilityLabel="Student name"
          autoCapitalize="words"
          onChangeText={setStudentName}
          placeholder="Student name"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={studentName}
        />
        <TextInput
          accessibilityLabel="Matric number"
          onChangeText={setMatricNumber}
          placeholder="Matric number"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={matricNumber}
        />
        <TextInput
          accessibilityLabel="Class"
          onChangeText={setStudentClass}
          placeholder="Class"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={studentClass}
        />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        disabled={isUploading}
        onPress={onRecordPress}
        style={[styles.scanButton, isRecording && styles.stopButton, isUploading && styles.disabledButton]}
      >
        {isUploading ? <ActivityIndicator color="#fff" /> : <Ionicons name={isRecording ? 'stop' : 'videocam'} size={22} color="#fff" />}
        <Text style={styles.scanButtonText}>{isUploading ? 'Processing script' : isRecording ? 'Stop and upload' : 'Start video scan'}</Text>
      </TouchableOpacity>

      {!!statusMessage && <Text accessibilityLiveRegion="polite" style={styles.statusText}>{statusMessage}</Text>}
      {!!errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}

      {grade && (
        <View style={styles.gradeCard}>
          <Text style={styles.gradeLabel}>Final score</Text>
          <Text style={styles.gradeScore}>{grade.totalScore}</Text>
          <Text style={styles.feedbackTitle}>Feedback</Text>
          <Text style={styles.feedbackText}>{grade.feedback || 'No feedback provided.'}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    marginTop: 14,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
  },
  cameraPlaceholder: {
    width: '100%',
    height: 260,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  camera: {
    flex: 1,
  },
  permissionPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
  },
  permissionButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  form: {
    marginBottom: 18,
  },
  sectionTitle: {
    marginBottom: 10,
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    height: 48,
    marginBottom: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    backgroundColor: '#fff',
    color: '#1e293b',
  },
  scanButton: {
    width: '100%',
    height: 56,
    backgroundColor: theme.colors.primary,
    borderRadius: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#c74739',
  },
  disabledButton: {
    opacity: 0.65,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 9,
  },
  statusText: {
    marginTop: 14,
    textAlign: 'center',
    color: '#475569',
  },
  errorText: {
    marginTop: 14,
    textAlign: 'center',
    color: '#b42318',
  },
  gradeCard: {
    width: '100%',
    marginTop: 18,
    padding: 18,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe3eb',
  },
  gradeLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  gradeScore: {
    marginTop: 4,
    color: '#1e293b',
    fontSize: 34,
    fontWeight: '700',
  },
  feedbackTitle: {
    marginTop: 14,
    color: '#1e293b',
    fontWeight: '700',
  },
  feedbackText: {
    marginTop: 5,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
});
