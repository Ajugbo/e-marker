import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { API_BASE_URL } from '../constants/api';
import { theme } from '../constants/theme';
import type { RootStackParamList, ScriptMetadata } from '../types/navigation';

const metadataFields: { key: keyof ScriptMetadata; label: string }[] = [
  { key: 'studentName', label: 'Student name' },
  { key: 'examNumber', label: 'ID / exam number' },
  { key: 'institution', label: 'Institution' },
  { key: 'class', label: 'Class' },
  { key: 'term', label: 'Term' },
  { key: 'course', label: 'Course' },
];

export default function ResultScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Result'>>();
  const [metadata, setMetadata] = useState(route.params.result.metadata);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { score, maxScore, feedback, breakdown } = route.params.result;

  const updateMetadata = (key: keyof ScriptMetadata, value: string) => {
    setMetadata((current) => ({ ...current, [key]: value }));
  };

  const acceptAndSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/grading/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rubricId: route.params.rubricId,
          metadata,
          grade: { score, maxScore, feedback, breakdown },
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not save this grade.');
      setIsSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save this grade.');
    } finally {
      setIsSaving(false);
    }
  };

  const retake = () => {
    navigation.navigate('Main', { screen: 'Scan', params: { resetToken: Date.now() } });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Grading result</Text>
      <Text style={styles.subtitle}>Review the extracted details and grade before saving.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Page 1 details</Text>
        {metadataFields.map(({ key, label }) => (
          <View key={key} style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              accessibilityLabel={label}
              onChangeText={(value) => updateMetadata(key, value)}
              placeholder={`Enter ${label.toLowerCase()}`}
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={metadata[key] ?? ''}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI grade</Text>
        <Text style={styles.score}>{score} <Text style={styles.maxScore}>/ {maxScore}</Text></Text>
        <Text style={styles.fieldLabel}>Feedback</Text>
        <Text style={styles.bodyText}>{feedback || 'No feedback provided.'}</Text>
        <Text style={[styles.fieldLabel, styles.breakdownLabel]}>Breakdown</Text>
        <Text style={styles.bodyText}>{JSON.stringify(breakdown, null, 2)}</Text>
      </View>

      {!!errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}
      {isSaved && <Text accessibilityLiveRegion="polite" style={styles.savedText}>Grade saved successfully.</Text>}

      <TouchableOpacity
        accessibilityRole="button"
        disabled={isSaving || isSaved}
        onPress={() => void acceptAndSave()}
        style={[styles.saveButton, (isSaving || isSaved) && styles.disabledButton]}
      >
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isSaved ? 'Accepted & Saved' : 'Accept & Save'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity disabled={isSaving} onPress={retake} style={styles.retakeButton}>
        <Text style={styles.retakeText}>Retake</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#f8fafc',
  },
  title: {
    marginTop: 14,
    color: '#1e293b',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 5,
    marginBottom: 18,
    color: '#64748b',
    fontSize: 15,
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe3eb',
    backgroundColor: '#fff',
  },
  sectionTitle: {
    marginBottom: 14,
    color: '#1e293b',
    fontSize: 17,
    fontWeight: '700',
  },
  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    marginBottom: 5,
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    color: '#1e293b',
  },
  score: {
    marginBottom: 14,
    color: theme.colors.primary,
    fontSize: 36,
    fontWeight: '700',
  },
  maxScore: {
    color: '#64748b',
    fontSize: 20,
    fontWeight: '500',
  },
  bodyText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  breakdownLabel: {
    marginTop: 16,
  },
  errorText: {
    marginBottom: 12,
    color: '#b42318',
    textAlign: 'center',
  },
  savedText: {
    marginBottom: 12,
    color: '#15803d',
    textAlign: 'center',
  },
  saveButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  retakeButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  retakeText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
});
