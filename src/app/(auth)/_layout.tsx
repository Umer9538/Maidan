import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="select-sports" />
      <Stack.Screen name="select-city" />
    </Stack>
  );
}
