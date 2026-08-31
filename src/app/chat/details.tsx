/**
 * Conversation details — frame `37_Group Deatils`.
 *
 * Measured from the flattened export: a 96pt circular avatar centred at y128, the name at
 * y247 (20/600, centred), a Members row at y307 (label, avatar stack, then VIEW ALL /
 * INVITE in orange), a "Photos and videos" label at y354, and a three-column grid of
 * ~101pt tiles from y391 with a 13pt gutter.
 *
 * The frame's grid is the event's media. Ours is the ground's photos, which is the only
 * imagery a match thread actually has — players do not upload to a booking thread.
 */
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppBar, AvatarStack, NotFound, PressableScale, Screen, Text, Thumb } from '@/components/ui';
import { usePlayers, useThreads, useVenue } from '@/data/queries';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

const GRID_COLUMNS = 3;
const GRID_GAP = 13;

export default function ChatDetailsScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/chats');

  const threads = useThreads();
  const thread = (threads.data ?? []).find((candidate) => candidate.id === threadId);
  const members = usePlayers(thread?.memberIds ?? []);
  const venue = useVenue(thread?.venueId ?? '');

  // Opened without an id — a stale link or a malformed deep link. The query behind this
  // screen is disabled without one, and a disabled query stays pending forever, so the
  // spinner below would never clear.
  if (!threadId) return <NotFound title="Details" record="conversation" onBack={goBack} />;

  if (threads.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  if (!thread) {
    return (
      <Screen>
        <AppBar title="Details" onBack={goBack} />
        <Text variant="cardTitle" align="center" style={styles.loader}>
          That conversation is no longer available
        </Text>
      </Screen>
    );
  }

  const photos = venue.data?.photos ?? [];
  const avatars = (members.data ?? [])
    .map((player) => player.avatarUrl)
    .filter((url): url is string => Boolean(url));
  const overflow = Math.max(0, (thread.memberIds.length ?? 0) - 4);

  return (
    <Screen>
      <AppBar title="Details" onBack={goBack} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.identity}>
          <Thumb
            id={thread.id}
            name={thread.title}
            uri={thread.avatarUrl}
            dimension={s(96)}
            circular
          />
          <Text variant="screenTitle" align="center" style={styles.name}>
            {thread.title}
          </Text>
          {thread.subtitle ? (
            <Text variant="bodySmall" color={colors.textSecondary} align="center">
              {thread.subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.membersRow}>
          <Text variant="cardTitle">Members</Text>
          <View style={styles.stack}>
            <AvatarStack uris={avatars} overflowLabel={overflow > 0 ? `${overflow}+` : undefined} />
          </View>
          <PressableScale
            onPress={() => router.push({ pathname: '/chat/members', params: { threadId } })}
            accessibilityLabel={`View all ${thread.memberIds.length} members`}
            testID="view-members"
          >
            <Text variant="metaStrong" color={colors.orangeInk} uppercase>
              View all
            </Text>
          </PressableScale>
        </View>

        {photos.length > 0 ? (
          <>
            <Text variant="cardTitle" style={styles.sectionTitle}>
              Photos
            </Text>
            <View style={styles.grid}>
              {photos.map((uri, index) => (
                <PressableScale
                  key={`${uri}-${index}`}
                  onPress={() =>
                    thread.venueId
                      ? router.push({
                          pathname: '/venue/gallery',
                          params: { venueId: thread.venueId },
                        })
                      : undefined
                  }
                  accessibilityLabel={`Photo ${index + 1} of ${venue.data?.name ?? 'the ground'}`}
                  style={styles.tile}
                >
                  <Image
                    source={{ uri }}
                    style={styles.tileImage}
                    contentFit="cover"
                    transition={160}
                    accessibilityIgnoresInvertColors
                  />
                </PressableScale>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(64) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  identity: { alignItems: 'center', paddingTop: s(37), gap: s(12) },
  name: { marginTop: s(11) },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: s(42),
  },
  stack: { flex: 1 },
  sectionTitle: { marginTop: s(25), marginBottom: s(23) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(GRID_GAP) },
  tile: {
    // Three across the 327 content column with two 13pt gutters.
    width: (size.contentWidth - s(GRID_GAP) * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
    aspectRatio: 1,
  },
  tileImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.card,
    backgroundColor: colors.surfaceMuted,
  },
});
