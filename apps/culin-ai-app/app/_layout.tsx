import React, { useState, useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import AuthScreen from '@/src/screens/AuthScreen';
import OnboardingScreen from '@/src/screens/OnboardingScreen';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useAppFonts } from '@/src/design/fonts';

// Silence all console output in production builds
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  // Keep console.error for crash reporting tools (Sentry, etc.)
}

export const unstable_settings = {
  anchor: '(tabs)',
};

const LOADING_TIMEOUT_MS = 12_000;

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { currentUser, userData, loading, logout } = useAuth();
  const fontsLoaded = useAppFonts();
  const [timedOut, setTimedOut] = useState(false);

  const isBlocked = loading || !fontsLoaded || (currentUser && !userData);

  useEffect(() => {
    if (!isBlocked) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isBlocked]);

  if (isBlocked) {
    if (timedOut) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>
            Something went wrong loading your profile.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setTimedOut(false);
              logout();
            }}
          >
            <Text style={styles.retryButtonText}>Sign in again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <Animated.View 
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#63C63F" />
      </Animated.View>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  if (currentUser && userData?.onboardingCompleted === false) {
    return <OnboardingScreen />;
  }
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          // Smooth fade transition between screens
          animation: 'fade',
          animationDuration: 300,
        }}
      >
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            // Smooth slide animation for tab navigation
            animation: 'slide_from_right',
            animationDuration: 250,
          }} 
        />
        <Stack.Screen 
          name="modal" 
          options={{ 
            presentation: 'modal',
            title: 'Modal',
            // Smooth modal animation
            animation: 'slide_from_bottom',
            animationDuration: 300,
          }} 
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f7f8',
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: '#63C63F',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
