import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from './src/constants/theme';

import LoginScreen from './src/screens/LoginScreen';
import ScanScreen from './src/screens/ScanScreen';
import UploadScreen from './src/screens/UploadScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import AccountScreen from './src/screens/AccountScreen';
import ResultScreen from './src/screens/ResultScreen';
import type { MainTabParamList, RootStackParamList } from './src/types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          if (route.name === 'Scan') {
            iconName = focused ? 'camera' : 'camera-outline';
          } else if (route.name === 'Upload') {
            iconName = focused ? 'cloud-upload' : 'cloud-upload-outline';
          } else if (route.name === 'Results') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Scan">
        {({ route }) => <ScanScreen key={route.params?.resetToken ?? 'initial'} />}
      </Tab.Screen>
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen name="Results" component={ResultsScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [authError, setAuthError] = React.useState('');

  const checkAuthentication = React.useCallback(async () => {
    setAuthError('');
    try {
      const token = await SecureStore.getItemAsync('userToken');
      setIsAuthenticated(Boolean(token));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not check your sign-in status.');
    }
  }, []);

  React.useEffect(() => {
    void checkAuthentication();
  }, [checkAuthentication]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {isAuthenticated === null ? (
          <View style={authStyles.container}>
            {authError ? (
              <>
                <Text style={authStyles.errorText}>{authError}</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => void checkAuthentication()}>
                  <Text style={authStyles.retryText}>Try again</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator color={theme.colors.primary} size="large" />
            )}
          </View>
        ) : (
          <NavigationContainer>
            <Stack.Navigator>
              {isAuthenticated ? (
                <>
                  <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
                  <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Grading Result' }} />
                </>
              ) : (
                <Stack.Screen name="Login" options={{ headerShown: false }}>
                  {() => <LoginScreen onAuthenticated={() => setIsAuthenticated(true)} />}
                </Stack.Screen>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  errorText: {
    marginBottom: 16,
    color: '#b42318',
    textAlign: 'center',
  },
  retryText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
