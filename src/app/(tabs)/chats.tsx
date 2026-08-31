/**
 * Chats — ported from the `Chats` frame (node 1:141).
 *
 * Coordination stays in the app rather than moving to WhatsApp: phone numbers are never
 * exposed between players (docs/05 §6), and the activity is the product.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import {
  AppBar,
  CountBadge,
  Divider,
  EmptyState,
  PressableScale,
  Screen,
  SearchBar,
  Text,
  Thumb,
} from '@/components/ui';
import { useThreads } from '@/data/queries';
import type { ChatThread } from '@/domain/types';
import { formatRelative } from '@/lib/datetime';
import { colors, size, spacing } from '@/theme';

export default function ChatsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const threads = useThreads();

  const visible = (threads.data ?? []).filter((thread) =>
    `${thread.title} ${thread.lastMessage}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const renderRow = (thread: ChatThread) => (
    <PressableScale
      onPress={() => router.push(`/chat/${thread.id}`)}
      accessibilityLabel={`${thread.title}. ${thread.lastMessage}. ${formatRelative(thread.lastMessageAt)}`}
      accessibilityHint="Opens the conversation"
      style={styles.row}
      testID={`thread-${thread.id}`}
    >
      <Thumb
        id={thread.id}
        name={thread.title}
        uri={thread.avatarUrl}
        dimension={size.chatAvatar}
        circular
      />
      <View style={styles.rowBody}>
        <Text variant="rowTitle" numberOfLines={1}>
          {thread.title}
        </Text>
        <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
          {thread.lastMessage}
        </Text>
      </View>
      <View style={styles.rowMeta}>
        <Text variant="timestamp" color={colors.textSecondary}>
          {formatRelative(thread.lastMessageAt)}
        </Text>
        <CountBadge count={thread.unreadCount} label={`${thread.unreadCount} unread messages`} />
      </View>
    </PressableScale>
  );

  return (
    <Screen>
      <AppBar title="Chats" />

      <View style={styles.search}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          testID="chat-search"
        />
      </View>

      {threads.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(thread) => thread.id}
          renderItem={({ item }) => renderRow(item)}
          ItemSeparatorComponent={() => <Divider style={styles.divider} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title={query ? 'No matching chats' : 'No conversations yet'}
              body={
                query
                  ? 'Try a team name, a venue, or a sport.'
                  : 'Join a match or accept a challenge and the conversation starts here.'
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xl },
  rowBody: { flex: 1, marginLeft: spacing.lg, gap: 3 },
  rowMeta: { alignItems: 'flex-end', gap: spacing.sm },
  divider: { marginVertical: 0 },
  loader: { marginTop: 48 },
});
