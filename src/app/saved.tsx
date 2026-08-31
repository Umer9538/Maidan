/**
 * Saved grounds — frame `20_Wish List`.
 *
 * Measured: title at y73; empty, the illustration occupies y188–428 with the heading at
 * y493, body at y538, and EXPLORE at y722. Populated, it is the large media card from
 * frames 12 and 19 at full content width.
 *
 * The illustration is the frame's own artwork, cropped out of the flattened export at 2x
 * with the background keyed out.
 */
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppBar, EmptyState, MediaCard, Screen } from '@/components/ui';
import { useVenues } from '@/data/queries';
import { useSaved } from '@/features/saved/context';
import type { Venue } from '@/domain/types';
import { formatOpeningHours } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, s, spacing } from '@/theme';

export default function SavedScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');
  const venues = useVenues();
  const { savedIds, isSaved, toggle } = useSaved();

  const saved = (venues.data ?? []).filter((venue) => savedIds.includes(venue.id));

  const renderVenue = (venue: Venue) => (
    <MediaCard
      variant="full"
      title={venue.name}
      photoUri={venue.photos[0]}
      facts={[
        { icon: 'location', label: venue.area },
        { icon: 'clock', label: formatOpeningHours(venue.hours.opensAt, venue.hours.closesAt) },
      ]}
      avatarUris={venue.photos.slice(0, 3)}
      footerLabel={`${formatPkr(venue.fromPricePerHour)}/hr`}
      actionLabel="Book now"
      onPress={() => router.push(`/venue/${venue.id}`)}
      onToggleSaved={() => toggle(venue.id)}
      saved={isSaved(venue.id)}
      testID={`saved-${venue.id}`}
    />
  );

  return (
    <Screen>
      <AppBar title="Wish List" onBack={goBack} />

      {venues.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(venue) => venue.id}
          renderItem={({ item }) => renderVenue(item)}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              art={require('@/assets/images/empty/no-saved.png')}
              title="Nothing saved yet"
              body="Tap the heart on any ground and it lands here, ready to book when you are."
              actionLabel="Explore grounds"
              onAction={() => router.push('/grounds')}
              testID="saved-empty"
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, flexGrow: 1 },
  gap: { height: s(14) },
  loader: { marginTop: s(48) },
});
