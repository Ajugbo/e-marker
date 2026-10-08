import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { API_BASE_URL } from '../constants/api';
import { theme } from '../constants/theme';
import type { ProcessingResult, RootStackParamList } from '../types/navigation';

const FRAME_TIMES_MS = [250, 750, 1500];

type Recording = { uri: string };
type Rubric = { id: string; title: string };

export default function ScanScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState('');
  const [isRubricPickerOpen, setIsRubricPickerOpen] = useState(false);
  const [isLoadingRubric, setIsLoadingRubric] = useState(true);
  const [rubricError, setRubricError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [segmentCount, setSegmentCount] = useState(0);
  const holdPressedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const segmentTaskRef = useRef<Promise<void> | null>(null);
  const segmentUrisRef = useRef<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadRubrics = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/exams`, { credentials: 'include' });
        const data = await response.json() as { exams?: unknown; error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Could not load your grading rubrics.');
        if (!Array.isArray(data.exams)) throw new Error('The grading rubrics response was invalid.');
        const loadedRubrics = data.exams.flatMap((exam): Rubric[] => {
          if (typeof exam !== 'object' || exam === null || !('id' in exam) || !('title' in exam)) return [];
          return typeof exam.id === 'string' && typeof exam.title === 'string'
            ? [{ id: exam.id, title: exam.title }]
            : [];
        });
        if (isMounted) setRubrics(loadedRubrics);
      } catch (error) {
        if (isMounted) {
          setRubricError(error instanceof Error ? error.message : 'Could not load your grading rubrics.');
        }
      } finally {
        if (isMounted) setIsLoadingRubric(false);
      }
    };

    void loadRubrics();
    return () => {
      isMounted = false;
    };
  }, []);

  const requestCameraAndMicrophonePermissions = async () => {
    await Promise.all([requestPermission(), requestMicrophonePermission()]);
  };

  const startHoldRecording = async () => {
    if (isUploading || holdPressedRef.current) return;
    holdPressedRef.current = true;

    const pendingSegment = segmentTaskRef.current;
    if (pendingSegment) await pendingSegment;
    if (!holdPressedRef.current) return;

    const camera = cameraRef.current;
    if (!camera) {
      holdPressedRef.current = false;
      setErrorMessage('Camera is not ready yet. Try again in a moment.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('Recording this page…');
    isRecordingRef.current = true;
    setIsRecording(true);

    const task = camera.recordAsync({ maxDuration: 180 })
      .then((recording: Recording | undefined) => {
        if (!recording?.uri) throw new Error('The camera did not save this page recording.');
        segmentUrisRef.current.push(recording.uri);
        setSegmentCount(segmentUrisRef.current.length);
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'Could not record this page.');
        setStatusMessage('');
      })
      .finally(() => {
        isRecordingRef.current = false;
        setIsRecording(false);
        if (segmentTaskRef.current === task) segmentTaskRef.current = null;
      });

    segmentTaskRef.current = task;
    await task;
  };

  const releaseHold = () => {
    holdPressedRef.current = false;
    if (isRecordingRef.current) cameraRef.current?.stopRecording();
  };

  const extractFrames = async () => {
    const frames: { type: 'metadata' | 'content'; image: string }[] = [];

    for (const [segmentIndex, uri] of segmentUrisRef.current.entries()) {
      const type = segmentIndex === 0 ? 'metadata' : 'content';
      let segmentFrameCount = 0;

      for (const time of FRAME_TIMES_MS) {
        let thumbnail: VideoThumbnails.VideoThumbnailsResult;
        try {
          thumbnail = await VideoThumbnails.getThumbnailAsync(uri, { time, quality: 0.85 });
        } catch (error) {
          if (time === FRAME_TIMES_MS[0]) {
            throw new Error(`Could not extract a frame from page ${segmentIndex + 1}: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
          continue;
        }
        const image = await FileSystem.readAsStringAsync(thumbnail.uri, { encoding: FileSystem.EncodingType.Base64 });
        frames.push({ type, image: `data:image/jpeg;base64,${image}` });
        segmentFrameCount += 1;
      }

      if (segmentFrameCount === 0) {
        throw new Error(`Could not extract frames from page ${segmentIndex + 1}.`);
      }
    }

    return frames;
  };

  const finishScan = async () => {
    if (!selectedRubricId) {
      setErrorMessage('Please create a rubric on the web dashboard first.');
      return;
    }
    if (segmentUrisRef.current.length === 0) {
      setErrorMessage('Hold the scan button to record at least one page.');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setStatusMessage('Extracting page frames…');
    try {
      if (isRecordingRef.current) {
        holdPressedRef.current = false;
        cameraRef.current?.stopRecording();
      }
      await segmentTaskRef.current;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const frames = await extractFrames();
      setStatusMessage('Sending pages for grading…');
      const response = await fetch(`${API_BASE_URL}/api/grading/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rubricId: selectedRubricId, frames }),
      });
      const result = await response.json() as ProcessingResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not process this scan.');
      navigation.navigate('Result', { result, rubricId: selectedRubricId });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to process this scan.');
      setStatusMessage('');
    } finally {
      setIsUploading(false);
      holdPressedRef.current = false;
    }
  };

  const retake = () => {
    segmentUrisRef.current = [];
    setSegmentCount(0);
    setErrorMessage('');
    setStatusMessage('');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>E-Marker</Text>
        <Text style={styles.subtitle}>Hold to record each page, then release to turn it</Text>
      </View>

      <View style={styles.cameraPlaceholder}>
        {permission?.granted && microphonePermission?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="video" videoQuality="720p" />
        ) : (
          <View style={styles.permissionPrompt}>
            <Ionicons name="videocam" size={44} color={theme.colors.primary} />
            <Text style={styles.cameraText}>Camera and microphone access needed</Text>
            <TouchableOpacity onPress={() => void requestCameraAndMicrophonePermissions()} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Allow access</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!isLoadingRubric && !rubricError && rubrics.length === 0 && (
        <Text accessibilityRole="alert" style={styles.rubricBanner}>
          Please create a rubric on the web dashboard first.
        </Text>
      )}
      {!!rubricError && <Text accessibilityRole="alert" style={styles.errorText}>{rubricError}</Text>}
      {isLoadingRubric ? (
        <View style={styles.rubricLoading}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.rubricLoadingText}>Loading...</Text>
        </View>
      ) : rubrics.length > 0 ? (
        <View style={styles.rubricPicker}>
          <Text style={styles.rubricLabel}>Grading rubric</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: isRubricPickerOpen }}
            disabled={isUploading}
            onPress={() => setIsRubricPickerOpen((isOpen) => !isOpen)}
            style={styles.rubricPickerButton}
          >
            <Text style={[styles.rubricPickerText, !selectedRubricId && styles.rubricPlaceholder]}>
              {rubrics.find((rubric) => rubric.id === selectedRubricId)?.title ?? 'Choose a rubric'}
            </Text>
            <Ionicons name={isRubricPickerOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
          </TouchableOpacity>
          {isRubricPickerOpen && (
            <View style={styles.rubricOptions}>
              {rubrics.map((rubric) => (
                <TouchableOpacity
                  key={rubric.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: rubric.id === selectedRubricId }}
                  onPress={() => {
                    setSelectedRubricId(rubric.id);
                    setIsRubricPickerOpen(false);
                    setErrorMessage('');
                  }}
                  style={[styles.rubricOption, rubric.id === selectedRubricId && styles.selectedRubricOption]}
                >
                  <Text style={[styles.rubricOptionText, rubric.id === selectedRubricId && styles.selectedRubricOptionText]}>
                    {rubric.title}
                  </Text>
                  {rubric.id === selectedRubricId && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Release to pause page recording' : 'Hold to record a page'}
        disabled={!permission?.granted || !microphonePermission?.granted || isUploading}
        onPressIn={() => void startHoldRecording()}
        onPressOut={releaseHold}
        style={[styles.scanButton, isRecording && styles.recordingButton, (!permission?.granted || !microphonePermission?.granted || isUploading) && styles.disabledButton]}
      >
        {isRecording ? <Ionicons name="radio-button-on" size={22} color="#fff" /> : <Ionicons name="videocam" size={22} color="#fff" />}
        <Text style={styles.scanButtonText}>{isRecording ? 'Recording — release to pause' : 'Hold to Scan'}</Text>
      </TouchableOpacity>

      <Text style={styles.pageCount}>{segmentCount} {segmentCount === 1 ? 'page' : 'pages'} recorded</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={isLoadingRubric || !selectedRubricId || isUploading || segmentCount === 0}
          onPress={() => void finishScan()}
          style={[styles.doneButton, (isLoadingRubric || !selectedRubricId || isUploading || segmentCount === 0) && styles.disabledButton]}
        >
          {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanButtonText}>Done</Text>}
        </TouchableOpacity>
        <TouchableOpacity disabled={isUploading || segmentCount === 0} onPress={retake} style={styles.retakeButton}>
          <Text style={styles.retakeText}>Retake</Text>
        </TouchableOpacity>
      </View>

      {!!statusMessage && <Text accessibilityLiveRegion="polite" style={styles.statusText}>{statusMessage}</Text>}
      {!!errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}
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
  rubricBanner: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f3d38a',
    borderRadius: 9,
    backgroundColor: '#fff8e6',
    color: '#805b00',
    textAlign: 'center',
  },
  rubricLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  rubricLoadingText: {
    color: '#64748b',
  },
  rubricPicker: {
    marginBottom: 12,
  },
  rubricLabel: {
    marginBottom: 6,
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  rubricPickerButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  rubricPickerText: {
    color: '#1e293b',
    fontSize: 15,
  },
  rubricPlaceholder: {
    color: '#94a3b8',
  },
  rubricOptions: {
    maxHeight: 190,
    marginTop: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  rubricOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  selectedRubricOption: {
    backgroundColor: '#eff6ff',
  },
  rubricOptionText: {
    color: '#334155',
    fontSize: 14,
  },
  selectedRubricOptionText: {
    color: theme.colors.primary,
    fontWeight: '600',
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
  recordingButton: {
    backgroundColor: '#c74739',
  },
  disabledButton: {
    opacity: 0.55,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 9,
  },
  pageCount: {
    marginTop: 10,
    textAlign: 'center',
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  doneButton: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButton: {
    minWidth: 100,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
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
});
