import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './src/constants/theme';

// Import screens (placeholder for now)
import ScanScreen from './src/screens/ScanScreen';
import UploadScreen from './src/screens/UploadScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import AccountScreen from './src/screens/AccountScreen';

const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <NavigationContainer>
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
            <Tab.Screen name="Scan" component={ScanScreen} />
            <Tab.Screen name="Upload" component={UploadScreen} />
            <Tab.Screen name="Results" component={ResultsScreen} />
            <Tab.Screen name="Account" component={AccountScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
