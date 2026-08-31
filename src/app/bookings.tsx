/**
 * My Bookings — the kit's Upcoming / Past split applied to the player's own bookings,
 * showing what is still owed at the counter and routing back into the ticket.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppBar, EmptyState, ListCard, Screen, Segmented } from '@/components/ui';
import { useBookings, useVenues } from '@/data/queries';
import { formatSlotShort } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, spacing } from '@/theme';

type Tab = 'upcoming' | 'past';

export default function BookingsScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');
  const [tab, setTab] = useState<Tab>('upcoming');

  const bookings = useBookings();
  const venues = useVenues();

  // Captured once per mount rather than read during every render: the split between
  // upcoming and past must not shift under the user while they are looking at the list.
  const [now] = useState(() => Date.now());
  const visible = (bookings.data ?? []).filter((booking) =>
    tab === 'upcoming'
      ? new Date(booking.startAt).getTime() >= now && booking.status !== 'cancelled'
      : new Date(booking.startAt).getTime() < now || booking.status === 'cancelled',
  );

  const venueById = new Map((venues.data ?? []).map((venue) => [venue.id, venue]));

  return (
    <Screen>
      <AppBar title="My bookings" onBack={goBack} />

      <View style={styles.filters}>
        <Segmented<Tab>
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {bookings.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(booking) => booking.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const venue = venueById.get(item.venueId);
            return (
              <ListCard
                id={item.id}
                title={venue?.name ?? 'Booking'}
                metaLeft={formatSlotShort(item.startAt)}
                metaRight={item.status === 'cancelled' ? 'Cancelled' : item.code}
                photoUri={venue?.photos[0]}
                price={item.dueAtVenue > 0 ? `${formatPkr(item.dueAtVenue)} due` : 'Paid'}
                // A played booking is the only one that can be rated, so that is the
                // action it offers.
                action={item.status === 'completed' ? 'Rate' : 'View'}
                onPress={() =>
                  router.push(
                    item.status === 'completed' ? `/review/${item.id}` : `/booking/${item.id}`,
                  )
                }
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              art={require('@/assets/images/empty/no-bookings.png')}
              title={tab === 'upcoming' ? 'No upcoming bookings' : 'Nothing played yet'}
              body={
                tab === 'upcoming'
                  ? 'Find a ground and book a slot — it takes about thirty seconds.'
                  : 'Your completed and cancelled bookings will show up here.'
              }
              actionLabel={tab === 'upcoming' ? 'Find a ground' : undefined}
              onAction={tab === 'upcoming' ? () => router.push('/(tabs)') : undefined}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, flexGrow: 1 },
  gap: { height: 14 },
  loader: { marginTop: 48 },
});
