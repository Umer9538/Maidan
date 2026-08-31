/**
 * Root layout: fonts, providers, and the navigation stack.
 *
 * The app has three gates, and they are declared here rather than inside screens so a deep
 * link into any route is gated too — a screen-level redirect only guards its own screen.
 *
 *   1. onboarding   — first launch, the three-slide intro
 *   2. auth         — phone + OTP, then sports and city
 *   3. the app      — tabs and everything reachable from them
 */
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SplashView } from '@/components/splash-view';
import { DataProvider } from '@/data/provider';
import { AuthProvider, useAuth } from '@/features/auth/context';
import { OnboardingProvider, useOnboarding } from '@/features/onboarding/context';
import { PaymentsProvider } from '@/features/payments/context';
import { SavedProvider } from '@/features/saved/context';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable in this environment. Not fatal.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    // Hide on error too: a missing font must not leave the user staring at a splash.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataProvider>
          <OnboardingProvider>
            <AuthProvider>
              <SavedProvider>
                <PaymentsProvider>
                  <RootNavigator />
                </PaymentsProvider>
              </SavedProvider>
            </AuthProvider>
          </OnboardingProvider>
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const onboarding = useOnboarding();
  const auth = useAuth();

  // Our own splash, not a blank frame, while the two gates resolve from storage.
  if (onboarding.status === 'loading' || auth.status === 'loading') return <SplashView />;

  const needsOnboarding = onboarding.status === 'pending';
  const needsAuth = !needsOnboarding && auth.status !== 'signed_in';
  const inApp = !needsOnboarding && auth.status === 'signed_in';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={needsAuth}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[venueId]" />
        <Stack.Screen name="booking/slots" />
        <Stack.Screen name="booking/checkout" />
        <Stack.Screen name="booking/[bookingId]" />
        <Stack.Screen name="booking/ticket" />
        <Stack.Screen name="booking/cancel" />
        <Stack.Screen name="match/[matchId]" />
        <Stack.Screen name="venue/gallery" />
        <Stack.Screen name="chat/[threadId]" />
        <Stack.Screen name="chat/details" />
        <Stack.Screen name="chat/members" />
        <Stack.Screen name="match/invite" />
        <Stack.Screen name="match/create" />
        <Stack.Screen name="team/[teamId]" />
        <Stack.Screen name="team/create" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="challenge/create" />
        <Stack.Screen name="challenge/report" />
        <Stack.Screen name="search" />
        <Stack.Screen name="map" />
        <Stack.Screen name="grounds" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="owner/[ownerId]" />
        <Stack.Screen name="owner/dashboard" />
        <Stack.Screen name="owner/walk-in" />
        <Stack.Screen name="payment/methods" />
        <Stack.Screen name="payment/add-card" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="schedule" />
        <Stack.Screen
          name="review/[bookingId]"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen name="notifications" />
      </Stack.Protected>
    </Stack>
  );
}
