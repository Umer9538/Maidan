/**
 * Booked details — frame `15_Event Booked Details`.
 *
 * Measured from the flattened export: a 400pt hero, a white action card of three circular
 * buttons overlapping it at y295 (x24–350), the title row at y417 with a status chip, the
 * fact line at y478, the owner row at y547, a "Description" label at y614 with body copy
 * to y702, and a dark Messages bar at y738 (74 tall).
 *
 * The frame's actions are Call / Directions / My Ticket, and all three are wired: the
 * venue's counter number, a maps handoff from its coordinates, and the ticket screen
 * (frame 45). Player numbers are still never exposed — this is the venue's own public
 * line, which is how bookings happen today (docs/01 §6).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import {
  Divider,
  NotFound,
  Photo,
  PressableScale,
  Screen,
  Text,
  Thumb,
} from '@/components/ui';
import { useBooking, useCourts, usePlayer, useVenue } from '@/data/queries';
import { formatOpeningHours, formatSlotShort } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, size, spacing } from '@/theme';

export default function BookedDetailsScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/bookings');

  const booking = useBooking(bookingId);
  const venue = useVenue(booking.data?.venueId ?? '');
  const courts = useCourts(booking.data?.venueId ?? '');
  const owner = usePlayer(venue.data?.ownerId);

  if (booking.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  // A real id that resolves to nothing — a cancelled or deleted booking. Same dead end
  // as a missing id, so it gets the same screen and the same way out.
  if (!booking.data) return <NotFound title="Booking" record="booking" onBack={goBack} />;

  const data = booking.data;
  const court = (courts.data ?? []).find((candidate) => candidate.id === data.courtId);
  const cancelled = data.status === 'cancelled';

  const call = () => {
    if (venue.data?.phone) Linking.openURL(`tel:${venue.data.phone}`).catch(() => {});
  };

  const directions = () => {
    const geo = venue.data?.geo;
    if (!geo) return;
    const label = encodeURIComponent(venue.data?.name ?? 'Venue');
    // Apple Maps on iOS, Google Maps elsewhere — both accept a coordinate and a label.
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?ll=${geo.latitude},${geo.longitude}&q=${label}`
        : `geo:${geo.latitude},${geo.longitude}?q=${geo.latitude},${geo.longitude}(${label})`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen edgeToEdge statusBarStyle="light" background={colors.ink}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.heroWrap}>
          <Photo
            uri={venue.data?.photos[0]}
            name={venue.data?.name ?? ''}
            id={data.venueId}
            style={styles.hero}
            monogramSize={s(64)}
          />
          <View style={styles.scrim} />
          <PressableScale onPress={goBack} accessibilityLabel="Go back" style={styles.back}>
            <Icon name="arrow-left" size={s(16)} color={colors.white} />
          </PressableScale>
        </View>

        <View style={styles.actionCard}>
          <Action
            icon="call"
            label="Call"
            onPress={venue.data?.phone ? call : undefined}
            testID="action-call"
          />
          <Action
            icon="location"
            label="Directions"
            onPress={venue.data?.geo ? directions : undefined}
            testID="action-directions"
          />
          <Action
            icon="tick"
            label="My ticket"
            onPress={() => router.push({ pathname: '/booking/ticket', params: { bookingId } })}
            testID="action-ticket"
          />
          {/* An upcoming booking can be opened to other players — docs/04, Pillar 2. */}
          {data.status === 'confirmed' ? (
            <Action
              icon="users"
              label="Open match"
              onPress={() => router.push({ pathname: '/match/create', params: { bookingId } })}
              testID="action-open-match"
            />
          ) : null}
          {data.status === 'confirmed' ? (
            <Action
              icon="timer"
              label="Cancel"
              onPress={() => router.push({ pathname: '/booking/cancel', params: { bookingId } })}
              testID="action-cancel"
            />
          ) : null}
          {/* Only a played booking can be rated — docs/04, Pillar 1. */}
          {data.status === 'completed' ? (
            <Action
              icon="trophy"
              label="Rate"
              onPress={() => router.push(`/review/${bookingId}`)}
              testID="action-rate"
            />
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="cardTitle" style={styles.title}>
              {venue.data?.name ?? ''}
            </Text>
            <View style={[styles.chip, cancelled && styles.chipCancelled]}>
              <Text
                variant="metaStrong"
                color={cancelled ? colors.danger : colors.orangeDeep}
                uppercase
              >
                {cancelled ? 'Cancelled' : 'Booked'}
              </Text>
            </View>
          </View>

          <View style={styles.factRow}>
            <Icon name="location" size={s(12)} color={colors.orange} bold />
            <Text variant="meta" color={colors.textSecondary}>
              {venue.data?.area ?? ''}
            </Text>
            <View style={styles.factGap} />
            <Icon name="clock" size={s(12)} color={colors.orange} bold />
            <Text variant="meta" color={colors.textSecondary}>
              {formatSlotShort(data.startAt)}
            </Text>
          </View>

          <View style={styles.summary}>
            <SummaryCell label="Court" value={court?.name ?? '—'} />
            <SummaryCell label="Code" value={data.code} />
            <SummaryCell
              label={data.dueAtVenue > 0 ? 'Due at venue' : 'Paid'}
              value={formatPkr(data.dueAtVenue > 0 ? data.dueAtVenue : data.paidOnline)}
              emphasis={data.dueAtVenue > 0}
            />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.owner}>
            <Thumb
              id={venue.data?.ownerId ?? 'owner'}
              name={owner.data?.name ?? 'Venue owner'}
              uri={owner.data?.avatarUrl}
              dimension={size.actionCircle}
              circular
            />
            <View style={styles.ownerText}>
              <Text variant="bodySmall">{owner.data?.name ?? 'Venue owner'}</Text>
              <Text variant="meta" color={colors.textSecondary}>
                Venue owner · Verified by Maidan
              </Text>
            </View>
          </View>

          <Text variant="cardTitle" style={styles.sectionTitle}>
            About the ground
          </Text>
          <Text variant="bodySmall" color={colors.textSecondary}>
            {venue.data?.about ?? ''}
          </Text>
          <Text variant="meta" color={colors.textSecondary} style={styles.hours}>
            {venue.data
              ? formatOpeningHours(venue.data.hours.opensAt, venue.data.hours.closesAt)
              : ''}
          </Text>
        </View>
      </ScrollView>

      {/* Frame: the dark Messages bar, 74 tall, pinned to the bottom edge. */}
      <PressableScale
        onPress={() => router.push(`/chat/thread-venue-${data.venueId}`)}
        accessibilityLabel={`Message ${venue.data?.name ?? 'the venue'}`}
        style={styles.messages}
        testID="booked-messages"
      >
        <Icon name="chat" size={s(18)} color={colors.surfaceOnDark} bold />
        <Text variant="button" color={colors.textOnDark} uppercase>
          Messages
        </Text>
      </PressableScale>
    </Screen>
  );
}

function Action({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  testID?: string;
}) {
  // No handler, no button: the frame draws three, but one with nothing behind it would
  // still take focus and announce itself.
  if (!onPress) return null;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={styles.action}
      testID={testID}
    >
      <View style={styles.actionCircle}>
        <Icon name={icon} size={s(20)} color={colors.textOnOrange} bold />
      </View>
      <Text variant="meta" color={colors.textSecondary}>
        {label}
      </Text>
    </PressableScale>
  );
}

function SummaryCell({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="meta" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="cardTitle" color={emphasis ? colors.orangeInk : colors.ink} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const MESSAGES_HEIGHT = 74;

const styles = StyleSheet.create({
  loader: { marginTop: s(64) },
  // The screen's own ground is ink so the hero can run under the status bar; everything
  // below the photo needs the light surface back, or the ink text renders on ink.
  scroll: {
    backgroundColor: colors.background,
    paddingBottom: s(MESSAGES_HEIGHT) + spacing.xxl,
  },

  heroWrap: { height: s(400) },
  hero: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  back: {
    position: 'absolute',
    top: s(56),
    left: spacing.gutter,
    width: size.actionCircle,
    height: size.actionCircle,
    borderRadius: size.actionCircle / 2,
    backgroundColor: colors.glassOnPhoto,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Frame: the card overlaps the hero, spanning the 327 content column.
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: s(-105),
    marginHorizontal: spacing.gutter,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  action: { alignItems: 'center', gap: s(8) },
  actionCircle: {
    width: s(46),
    height: s(46),
    borderRadius: s(23),
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.gutter,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  chip: {
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: radius.chip,
    backgroundColor: colors.orangeWash,
  },
  chipCancelled: { backgroundColor: 'rgba(211, 69, 59, 0.12)' },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: spacing.md },
  factGap: { width: spacing.lg },

  summary: { flexDirection: 'row', marginTop: spacing.xl },
  cell: { flex: 1, gap: s(4) },
  divider: { marginVertical: spacing.xl },

  owner: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ownerText: { flex: 1, gap: s(3) },

  sectionTitle: { marginTop: spacing.gutter, marginBottom: spacing.md },
  hours: { marginTop: spacing.md },

  messages: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: s(MESSAGES_HEIGHT),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.ink,
  },
});
