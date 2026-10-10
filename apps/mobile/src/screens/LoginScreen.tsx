import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from '../constants/api';
import { theme } from '../constants/theme';
import { setUserToken } from '../utils/tokenStorage';

WebBrowser.maybeCompleteAuthSession();

type LoginScreenProps = {
  onAuthenticated: () => void;
};

type MobileLoginResponse = {
  token?: unknown;
  error?: string;
};

const googleRedirectUri = 'https://fuzzy-bassoon-r4vgj9w4vj75c5gj-8081.app.github.dev';

function GoogleSignIn({ onAuthenticated }: LoginScreenProps) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '146885349224-ies7rf9mur3114a6chuue7hnq3tu8jto.apps.googleusercontent.com',
    androidClientId: '146885349224-1sgjlsvnm1hmbgm701kdbmmgp3s82nit.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    redirectUri: googleRedirectUri,
  });

  useEffect(() => {
    if (!request) return;

    console.log('--- AuthRequest Object Loaded ---');
    console.log('Client ID configured:', request.clientId);
    console.log('Redirect URI configured:', request.redirectUri);
    if (!request.url) {
      console.error('AuthRequest loaded without a generated authorization URL.');
      return;
    }

    console.log('=== FULL GENERATED GOOGLE OAUTH URL ===');
    console.log(request.url);
  }, [request]);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const processedResponse = useRef<typeof response>(null);

  const handleManualWebLogin = () => {
    if (Platform.OS !== 'web') return;

    const clientId = '146885349224-ies7rf9mur3114a6chuue7hnq3tu8jto.apps.googleusercontent.com';
    const nonce = Math.random().toString(36).substring(2);
    const parameters = new URLSearchParams({
      client_id: clientId,
      redirect_uri: googleRedirectUri,
      response_type: 'id_token',
      scope: 'openid profile email',
      nonce,
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`;

    console.log('MANUAL AUTH URL:', authUrl);
    window.open(authUrl, 'GoogleLogin', 'width=500,height=600,noopener,noreferrer');
  };

  useEffect(() => {
    if (!response || processedResponse.current === response) return;
    processedResponse.current = response;
    if (response.type !== 'success') {
      if (response.type === 'error') console.error('LOGIN ERROR:', response.error);
      return;
    }

    const completeSignIn = async (result: AuthSessionResult) => {
      if (result.type !== 'success') return;
      console.log('LOGIN SUCCESS RESPONSE:', {
        type: result.type,
        params: Object.keys(result.params),
        authentication: result.authentication
          ? Object.keys(result.authentication)
          : [],
        hasIdToken: Boolean(result.authentication?.idToken ?? result.params.id_token),
      });
      setIsSigningIn(true);
      setErrorMessage('');
      try {
        const credential = result.authentication?.idToken ?? result.params.id_token;
        if (!credential) throw new Error('Google did not return an ID token.');

        const loginResponse = await fetch(`${API_BASE_URL}/api/auth/mobile-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
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
          console.log('REDIRECT URI CONFIGURED:', request?.redirectUri);
          const authorizationUrl = request?.url ? new URL(request.url) : null;
          const requestParameters = authorizationUrl
            ? Object.fromEntries(authorizationUrl.searchParams.entries())
            : null;
          if (requestParameters) {
            for (const key of Object.keys(requestParameters)) {
              if (/state|nonce|token|secret|verifier/i.test(key)) {
                requestParameters[key] = '[REDACTED]';
              }
            }
          }
          console.log('REQUEST OBJECT:', {
            authorizationEndpoint: authorizationUrl
              ? `${authorizationUrl.origin}${authorizationUrl.pathname}`
              : null,
            parameters: requestParameters,
          });
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
      {Platform.OS === 'web' && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleManualWebLogin}
          style={styles.manualWebButton}
        >
          <Text style={styles.manualWebButtonText}>Manual Web Login (Bypass Library)</Text>
        </TouchableOpacity>
      )}
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
        {platformClientId || Platform.OS === 'web' ? (
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
  manualWebButton: {
    width: '100%',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  manualWebButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
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
