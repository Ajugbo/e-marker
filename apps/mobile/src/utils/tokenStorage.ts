import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const tokenKey = 'userToken';

export async function getUserToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(tokenKey);
  }
  return SecureStore.getItemAsync(tokenKey);
}

export async function setUserToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(tokenKey, token);
    return;
  }
  await SecureStore.setItemAsync(tokenKey, token);
}
