/**
 * My grounds — the owner's hub.
 *
 * Discovery only ever returns `live` venues, so without this screen an owner could register
 * a ground and then have nowhere to see it: invisible to players by design, and invisible to
 * them by omission.
 *
 * The status is the whole point of the screen. A ground under review cannot be booked — not
 * in the app and not at the owner's own counter — so what an owner needs first is to know
 * where their listing stands and what, if anything, is theirs to do next.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { AppBar, Button, EmptyState, PressableScale, Screen, Text } from '@/components/ui';
import { useMyVenues, usePublishVenue, useUnpublishVenue } from '@/data/queries';
import type { Venue } from '@/domain/types';
import { formatOpeningHours } from '@/lib/datetime';
import { formatPkrPerHour } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, spacing } from '@/theme';

/**
 * What each status means to the person reading it, in their terms rather than ours.
 *
 * `tone` is the chip colour and `next` is the sentence under it. A status with nothing for
 * the owner to do says so, because the alternative is a listing that looks stuck.
 */
const STATUS: Record<
  Venue['status'],
  { label: string; tone: string; ground: string; icon: IconName; next: string }
> = {
  pending: {
    label: 'In review',
    tone: colors.orangeDeep,
    ground: colors.orangeWashSolid,
    icon: 'clock',
    next: 'We are checking the details. Nothing can be booked yet — we will be in touch.',
  },
  rejected: {
    label: 'Needs changes',
    tone: colors.danger,
    ground: 'rgba(211, 69, 59, 0.12)',
    icon: 'clock',
    next: 'Make the changes below and we will look again.',
  },
  verified: {
    label: 'Approved',
    tone: colors.orangeDeep,
    ground: colors.orangeWashSolid,
    icon: 'tick',
    next: 'Approved. Go live when you are ready to take bookings.',
  },
  live: {
    label: 'Live',
    tone: colors.ink,
    ground: 'rgba(41, 214, 151, 0.20)',
    icon: 'tick',
    next: 'Taking bookings.',
  },
};

export default function MyVenuesScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');

  const venues = useMyVenues();
  const publish = usePublishVenue();
  const unpublish = useUnpublishVenue();

  const list = venues.data ?? [];

  return (
    <Screen>
      <AppBar
        title="My grounds"
        onBack={goBack}
        actions={[
          {
            icon: 'plus',
            accessibilityLabel: 'Register a ground',
            onPress: () => router.push('/owner/register'),
          },
        ]}
      />

      {list.length === 0 && !venues.isPending ? (
        <EmptyState
          icon="shield"
          title="No grounds yet"
          body="Register your ground and tell us what courts you have. We will check it over and get you live."
          actionLabel="Register a ground"
          onAction={() => router.push('/owner/register')}
          testID="no-venues"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {list.map((venue) => {
            const status = STATUS[venue.status];
            return (
              <View key={venue.id} style={styles.card} testID={`venue-${venue.id}`}>
                <View style={styles.head}>
                  <View style={styles.headText}>
                    <Text variant="cardTitle" numberOfLines={1}>
                      {venue.name}
                    </Text>
                    <Text variant="meta" color={colors.textSecondary}>
                      {venue.area} · {formatOpeningHours(venue.hours.opensAt, venue.hours.closesAt)}
                    </Text>
                  </View>

                  <View style={[styles.chip, { backgroundColor: status.ground }]}>
                    <Icon name={status.icon} size={s(12)} color={status.tone} bold />
                    <Text variant="metaStrong" color={status.tone}>
                      {status.label}
                    </Text>
                  </View>
                </View>

                <Text variant="meta" color={colors.textSecondary} style={styles.next}>
                  {status.next}
                </Text>

                {/* The reviewer's own words, so the owner knows exactly what to change. */}
                {venue.status === 'rejected' && venue.reviewNote ? (
                  <View style={styles.note}>
                    <Text variant="meta" color={colors.danger}>
                      {venue.reviewNote}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.facts}>
                  <Fact label="Courts" value={venue.sports.length > 0 ? 'Added' : 'None yet'} />
                  <Fact
                    label="From"
                    value={
                      venue.fromPricePerHour > 0
                        ? formatPkrPerHour(venue.fromPricePerHour)
                        : '—'
                    }
                  />
                </View>

                <View style={styles.actions}>
                  <Button
                    label="Edit"
                    variant="soft"
                    onPress={() =>
                      router.push({ pathname: '/owner/edit', params: { venueId: venue.id } })
                    }
                    style={styles.action}
                    testID={`edit-${venue.id}`}
                  />
                  <Button
                    label="Courts"
                    variant="soft"
                    onPress={() =>
                      router.push({ pathname: '/owner/courts', params: { venueId: venue.id } })
                    }
                    style={styles.action}
                    testID={`courts-${venue.id}`}
                  />

                  {/*
                    Only the states where the owner has something to do get a control. A
                    ground in review has nothing for them to press, and a button that only
                    ever fails is worse than no button.
                  */}
                  {venue.status === 'verified' ? (
                    <Button
                      label="Go live"
                      onPress={() => publish.mutate(venue.id)}
                      loading={publish.isPending}
                      style={styles.action}
                      testID={`publish-${venue.id}`}
                    />
                  ) : null}

                  {venue.status === 'live' ? (
                    <Button
                      label="Pause"
                      variant="soft"
                      onPress={() => unpublish.mutate(venue.id)}
                      loading={unpublish.isPending}
                      style={styles.action}
                      testID={`unpublish-${venue.id}`}
                    />
                  ) : null}

                  {venue.status === 'live' ? (
                    <Button
                      label="Day sheet"
                      onPress={() =>
                        router.push({
                          pathname: '/owner/dashboard',
                          params: { venueId: venue.id },
                        })
                      }
                      style={styles.action}
                    />
                  ) : null}
                </View>

                {publish.isError && publish.variables === venue.id ? (
                  <Text variant="meta" color={colors.danger} style={styles.next}>
                    {(publish.error as Error).message}
                  </Text>
                ) : null}
              </View>
            );
          })}

          <PressableScale
            onPress={() => router.push('/owner/register')}
            accessibilityLabel="Register another ground"
            style={styles.add}
          >
            <Icon name="plus" size={s(16)} color={colors.orangeInk} bold />
            <Text variant="metaStrong" color={colors.orangeInk}>
              Register another ground
            </Text>
          </PressableScale>
        </ScrollView>
      )}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="meta" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="metaStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1, gap: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(10),
    paddingVertical: s(5),
    borderRadius: radius.pill,
  },
  next: { lineHeight: s(18) },
  note: {
    backgroundColor: 'rgba(211, 69, 59, 0.08)',
    borderRadius: radius.thumb,
    padding: spacing.md,
  },
  facts: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
});
