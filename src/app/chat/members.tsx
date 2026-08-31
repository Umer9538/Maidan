/**
 * Members — frame `38_Group Members`.
 *
 * Measured: 45pt rows from y128 on a 61pt pitch, so a 16pt gap, each starting at the 24
 * gutter. Same row height as the conversation list, which is deliberate — it is the same
 * kind of row.
 *
 * Reliability sits next to every name. It is the number a host reads before approving a
 * join request (docs/04 §4), so the roster is where it belongs.
 */
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppBar, Divider, EmptyState, NotFound, Screen, Text, Thumb } from '@/components/ui';
import { usePlayers, useThreads } from '@/data/queries';
import { CURRENT_USER_ID } from '@/data/seed';
import type { Player } from '@/domain/types';
import { useGoBack } from '@/lib/navigation';
import { colors, s, size, spacing } from '@/theme';

export default function ChatMembersScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const goBack = useGoBack('/(tabs)/chats');

  const threads = useThreads();
  const thread = (threads.data ?? []).find((candidate) => candidate.id === threadId);
  const members = usePlayers(thread?.memberIds ?? []);

  // Opened without an id — a stale link or a malformed deep link. Without one there is no
  // thread to find, and the list below would sit on its loading branch forever.
  if (!threadId) return <NotFound title="Members" record="conversation" onBack={goBack} />;

  const renderMember = (player: Player) => (
    <View style={styles.row}>
      <Thumb
        id={player.id}
        name={player.name}
        uri={player.avatarUrl}
        dimension={size.chatAvatar}
        circular
      />
      <View style={styles.rowText}>
        <Text variant="rowTitle" numberOfLines={1}>
          {player.id === CURRENT_USER_ID ? `${player.name} (you)` : player.name}
        </Text>
        <Text variant="meta" color={colors.textSecondary}>
          {player.gamesPlayed} games played
        </Text>
      </View>
      <View
        style={styles.reliability}
        accessible
        accessibilityLabel={`${player.reliability}% reliability`}
      >
        <Text
          variant="metaStrong"
          color={player.reliability >= 90 ? colors.orangeDeep : colors.textSecondary}
        >
          {player.reliability}%
        </Text>
        <Text variant="meta" color={colors.textSecondary}>
          reliable
        </Text>
      </View>
    </View>
  );

  return (
    <Screen>
      <AppBar title="Members" onBack={goBack} />

      {threads.isPending || members.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={members.data ?? []}
          keyExtractor={(player) => player.id}
          renderItem={({ item }) => renderMember(item)}
          ItemSeparatorComponent={() => <Divider />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="No members yet"
              body="Nobody has joined this conversation."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(48) },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, flexGrow: 1 },
  // Frame: 45pt rows on a 61pt pitch — the 16 comes from the padding either side.
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: s(8), gap: spacing.lg },
  rowText: { flex: 1, gap: s(3) },
  reliability: { alignItems: 'flex-end' },
});
