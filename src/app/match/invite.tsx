/**
 * Invite players — frames `46/47_Invite Friend`.
 *
 * Measured from the flattened export: a bottom sheet with a drag handle, a centred title,
 * a 54pt search field, then 45pt avatar rows on a 61pt pitch with a ~105 x 40 action on
 * the right — solid orange to invite, peach once sent.
 *
 * The frame's secondary line is a follower count. Ours is reliability: it is the number a
 * host reads before deciding whether to pull someone into a game (docs/04 §4), and this
 * screen is exactly that decision. Follower counts do not exist in this product.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Divider,
  EmptyState,
  PressableScale,
  Screen,
  SearchBar,
  Text,
  Thumb,
} from '@/components/ui';
import { useSearchPlayers } from '@/data/queries';
import type { Player } from '@/domain/types';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

export default function InviteScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const goBack = useGoBack('/(tabs)/matches');

  const [query, setQuery] = useState('');
  const [invited, setInvited] = useState<string[]>([]);

  const players = useSearchPlayers(query);

  const renderPlayer = (player: Player) => {
    const sent = invited.includes(player.id);
    return (
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
            {player.name}
          </Text>
          <Text variant="meta" color={colors.textSecondary}>
            {player.reliability}% reliable · {player.gamesPlayed} games
          </Text>
        </View>

        <PressableScale
          onPress={() =>
            setInvited((current) =>
              current.includes(player.id)
                ? current.filter((id) => id !== player.id)
                : [...current, player.id],
            )
          }
          accessibilityLabel={sent ? `Invite sent to ${player.name}` : `Invite ${player.name}`}
          accessibilityState={{ selected: sent }}
          style={[styles.action, sent && styles.actionSent]}
          testID={`invite-${player.id}`}
        >
          {sent ? <Icon name="tick" size={s(14)} color={colors.orangeDeep} /> : null}
          <Text variant="metaStrong" color={sent ? colors.orangeDeep : colors.textOnOrange}>
            {sent ? 'Sent' : 'Invite'}
          </Text>
        </PressableScale>
      </View>
    );
  };

  return (
    <Screen>
      <AppBar
        title="Invite players"
        onBack={goBack}
        actions={
          invited.length > 0
            ? [{ icon: 'tick', accessibilityLabel: 'Done inviting', onPress: goBack }]
            : []
        }
      />

      <View style={styles.search}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search players"
          testID="invite-search"
        />
      </View>

      {matchId ? (
        <Text variant="meta" color={colors.textSecondary} style={styles.hint}>
          Invited players get a notification. Their number is never shown to you, and yours is never
          shown to them.
        </Text>
      ) : null}

      {players.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={players.data ?? []}
          keyExtractor={(player) => player.id}
          renderItem={({ item }) => renderPlayer(item)}
          ItemSeparatorComponent={() => <Divider />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="No players found"
              body={
                query ? `Nobody matches “${query}”. Try another name.` : 'Nobody to invite yet.'
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
  hint: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg, lineHeight: s(16) },
  loader: { marginTop: s(48) },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, flexGrow: 1 },
  // Frame: 45pt rows on a 61pt pitch.
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: s(8) },
  rowText: { flex: 1, gap: s(3) },
  // Frame: a ~105 x 40 action, solid to invite and peach once sent.
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    width: s(96),
    height: s(40),
    borderRadius: radius.chip,
    backgroundColor: colors.orange,
  },
  actionSent: { backgroundColor: colors.orangeWash },
});
