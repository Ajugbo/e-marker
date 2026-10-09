import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import { API_BASE_URL } from '../constants/api';
import { theme } from '../constants/theme';
import { setUserToken } from '../utils/tokenStorage';

type LoginScreenProps = {
  onAuthenticated: () => void;
};

type GoogleProfile = {
  email?: unknown;
  name?: unknown;
  picture?: unknown;
};

type MobileLoginResponse = {
  token?: unknown;
  error?: string;
};

const googleUserInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo';

function GoogleSignIn({ onAuthenticated }: LoginScreenProps) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: '146885349224-j6ulre7mnjrvi80oq2hri7bvllta730q.apps.googleusercontent.com',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const processedResponse = useRef<typeof response>(null);

  useEffect(() => {
    if (!response || processedResponse.current === response) return;
    processedResponse.current = response;
    if (response.type !== 'success') return;

    const completeSignIn = async (result: AuthSessionResult) => {
      if (result.type !== 'success') return;
      setIsSigningIn(true);
      setErrorMessage('');
      try {
        const credential = result.authentication?.idToken ?? result.params.id_token;
        const accessToken = result.authentication?.accessToken ?? result.params.access_token;
        if (!credential || !accessToken) {
          throw new Error('Google did not return the credentials needed to sign in.');
        }

        const profileResponse = await fetch(googleUserInfoUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!profileResponse.ok) throw new Error('Could not retrieve your Google profile.');
        const profile = await profileResponse.json() as GoogleProfile;
        if (typeof profile.email !== 'string' || typeof profile.name !== 'string') {
          throw new Error('Google did not return a valid account profile.');
        }

        const loginResponse = await fetch(`${API_BASE_URL}/api/auth/mobile-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential,
            email: profile.email,
            name: profile.name,
            ...(typeof profile.picture === 'string' ? { picture: profile.picture } : {}),
          }),
        });
        const loginResult = await loginResponse.json() as MobileLoginResponse;
        if (!loginResponse.ok) {
          throw new Error(loginResult.error ?? 'Could not sign in to E-Marker.');
        }
        if (typeof loginResult.token !== 'string' || !loginResult.token) {
          throw new Error('The sign-in response did not include a session token.');
        }

        await setUserToken(loginResult.token);
        onAuthenticated();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
      } finally {
        setIsSigningIn(false);
      }
    };

    void completeSignIn(response);
  }, [onAuthenticated, response]);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={!request || isSigningIn}
        onPress={() => {
          setErrorMessage('');
          void promptAsync();
        }}
        style={[styles.googleButton, (!request || isSigningIn) && styles.disabledButton]}
      >
        {isSigningIn ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </>
        )}
      </TouchableOpacity>
      {!!errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}
    </>
  );
}

export default function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const platformClientId = Platform.select({
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image accessibilityLabel="E-Marker logo" source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Welcome to E-Marker</Text>
        <Text style={styles.subtitle}>Sign in to access your rubrics and grade exams.</Text>
        {platformClientId ? (
          <GoogleSignIn onAuthenticated={onAuthenticated} />
        ) : (
          <Text accessibilityRole="alert" style={styles.errorText}>
            Google Sign-In is not configured for this platform.
          </Text>
        )}
        <Text style={styles.privacyText}>Your account is protected with secure sign-in.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f1f5f9',
  },
  card: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 18,
    backgroundColor: '#fff',
    elevation: 3,
  },
  logo: {
    width: 92,
    height: 92,
    marginBottom: 20,
    borderRadius: 20,
  },
  title: {
    color: '#1e293b',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 26,
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  googleButton: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  googleIcon: {
    marginRight: 10,
    color: '#4285f4',
    fontSize: 19,
    fontWeight: '700',
  },
  googleButtonText: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorText: {
    marginTop: 16,
    color: '#b42318',
    fontSize: 14,
    textAlign: 'center',
  },
  privacyText: {
    marginTop: 22,
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
});
