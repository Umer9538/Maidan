/**
 * Admin — the MAIDAN side of the app.
 *
 * A hub rather than a dashboard. The one number that matters is how many grounds are
 * waiting, because a ground sitting in review is an owner who signed up and cannot trade,
 * and every day it waits is a day they wonder whether this was worth it.
 *
 * Deliberately narrow. An admin approves listings; they are not a superuser, and there is
 * nothing here for reading a player's bookings or a venue's takings.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { AppBar, Divider, PressableScale, Screen, Text } from '@/components/ui';
import { usePlayersForAdmin, useVenuesForReview } from '@/data/queries';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, spacing } from '@/theme';

export default function AdminHomeScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');

  const pending = useVenuesForReview('pending');
  const live = useVenuesForReview('live');
  const admins = usePlayersForAdmin('');

  const waiting = pending.data?.length ?? 0;

  return (
    <Screen>
      <AppBar title="Admin" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PressableScale
          onPress={() => router.push('/admin/venues')}
          accessibilityLabel={`Venue review, ${waiting} waiting`}
          style={styles.headline}
          testID="queue-card"
        >
          <View style={styles.headlineText}>
            <Text variant="screenTitle" color={colors.textOnOrange}>
              {waiting}
            </Text>
            <Text variant="body" color={colors.textOnOrange}>
              {waiting === 1 ? 'ground waiting for review' : 'grounds waiting for review'}
            </Text>
          </View>
          <Icon name="chevron-right" size={s(20)} color={colors.textOnOrange} bold />
        </PressableScale>

        {waiting > 0 ? (
          <Text variant="meta" color={colors.textSecondary} style={styles.urgency}>
            Each one is an owner who has signed up and cannot take a booking yet.
          </Text>
        ) : null}

        <Divider />

        <Row
          icon="tick"
          label="Venue review"
          detail={`${waiting}`}
          onPress={() => router.push('/admin/venues')}
        />
        <Row
          icon="home"
          label="Live grounds"
          detail={`${live.data?.length ?? 0}`}
          onPress={() => router.push({ pathname: '/admin/venues', params: { status: 'live' } })}
        />
        <Row
          icon="shield"
          label="Admins"
          detail={`${admins.data?.length ?? 0}`}
          onPress={() => router.push('/admin/admins')}
        />
      </ScrollView>
    </Screen>
  );
}

function Row({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.row}>
      <Icon name={icon} size={20} color={colors.orange} bold />
      <Text variant="bodySmall" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="meta" color={colors.textSecondary}>
        {detail}
      </Text>
      <Icon name="chevron-right" size={s(16)} color={colors.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Ink on the orange fill, never white — #F76B10 carries 2.97:1 against it.
    backgroundColor: colors.orange,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadow.card,
  },
  headlineText: { flex: 1, gap: 2 },
  urgency: { lineHeight: s(18) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowLabel: { flex: 1 },
});
