/**
 * The Remember Me switch from frame `06_Sign in`: a 44 x 24 track that fills brand orange
 * when on, with a white knob.
 *
 * Not React Native's `Switch` — that renders the platform control, which is blue on iOS
 * and green on Android, and would be the only element on the screen ignoring the palette.
 */
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { colors, s } from '@/theme';

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  testID?: string;
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const KNOB = 18;

export function Toggle({ value, onValueChange, accessibilityLabel, testID }: ToggleProps) {
  return (
    <PressableScale
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
      testID={testID}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: {
    width: s(TRACK_WIDTH),
    height: s(TRACK_HEIGHT),
    borderRadius: s(TRACK_HEIGHT / 2),
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.orange },
  trackOff: { backgroundColor: colors.surfaceMuted },
  knob: {
    width: s(KNOB),
    height: s(KNOB),
    borderRadius: s(KNOB / 2),
    backgroundColor: colors.white,
  },
  knobOn: { alignSelf: 'flex-end', marginRight: s(3) },
  knobOff: { alignSelf: 'flex-start', marginLeft: s(3) },
});
