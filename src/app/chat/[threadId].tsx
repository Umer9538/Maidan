/**
 * Conversation — frame `35_Chat`.
 *
 * Measured from the flattened export: an 80pt header at y50 carrying the avatar, name,
 * online dot and subtitle; a centred date divider at y142; then runs of 42pt bubbles with
 * one timestamp printed above each run — mine ending at x350, theirs starting at x24.
 *
 * The frame prints one time per run rather than per bubble; `groupMessages` computes those
 * runs. The tab bar is hidden while a conversation is open, as the frame shows.
 *
 * Bubble text is ink on both sides. White on the brand orange is 2.97:1, and a message is
 * the longest-lived text in the app.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/icons';
import { NotFound, PressableScale, Screen, Text, Thumb } from '@/components/ui';
import { useMessages, useSendMessage, useThreads } from '@/data/queries';
import { formatClock, formatSlotShort } from '@/lib/datetime';
import { groupMessages, type MessageGroup } from '@/lib/messages';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing, typography } from '@/theme';

export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/chats');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const threads = useThreads();
  const messages = useMessages(threadId);
  const send = useSendMessage(threadId);

  const thread = (threads.data ?? []).find((candidate) => candidate.id === threadId);
  const sections = useMemo(() => groupMessages(messages.data ?? []), [messages.data]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft('');
    send.mutate(body, {
      onSuccess: () => scrollRef.current?.scrollToEnd({ animated: true }),
      // Put the text back rather than losing what the user typed.
      onError: () => setDraft(body),
    });
  };

  // A thread id matching nothing — a stale notification, or a conversation since removed.
  // Without this the screen draws a composer over an identity it invented ("Chat") and
  // lets someone type into a conversation that does not exist.
  if (threads.isSuccess && !thread) {
    return <NotFound title="Chat" record="conversation" onBack={goBack} />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <PressableScale onPress={goBack} accessibilityLabel="Go back">
          <Icon name="arrow-left" size={s(22)} color={colors.ink} />
        </PressableScale>

        <PressableScale
          onPress={() => router.push({ pathname: '/chat/details', params: { threadId } })}
          accessibilityLabel={`${thread?.title ?? 'Conversation'} details`}
          style={styles.headerIdentity}
          testID="open-details"
        >
          <Thumb
            id={threadId}
            name={thread?.title ?? 'Chat'}
            uri={thread?.avatarUrl}
            dimension={s(40)}
            circular
          />
          <View style={styles.headerText}>
            <Text variant="rowTitle" numberOfLines={1}>
              {thread?.title ?? 'Chat'}
            </Text>
            {thread?.subtitle ? (
              <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                {thread.subtitle}
              </Text>
            ) : null}
          </View>
        </PressableScale>

        <PressableScale
          onPress={() => router.push({ pathname: '/chat/details', params: { threadId } })}
          accessibilityLabel="Conversation options"
        >
          <Icon name="more-vertical" size={s(22)} color={colors.ink} />
        </PressableScale>
      </View>

      {/*
        `padding` on both platforms. Leaving Android on `undefined` relies on the window
        resizing under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does —
        the composer ended up behind the keyboard with no sight of what was being typed.
      */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={12}>
        {messages.isPending ? (
          <ActivityIndicator style={styles.loader} color={colors.orange} />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {sections.map((section) => (
              <View key={section.day}>
                <View style={styles.dateRow}>
                  <Text variant="meta" color={colors.textSecondary}>
                    {formatSlotShort(section.day).split(',')[0]}
                  </Text>
                </View>
                {section.groups.map((group) => (
                  <Group key={group.id} group={group} />
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            multiline
            accessibilityLabel="Message"
            testID="composer"
          />
          <PressableScale
            onPress={submit}
            disabled={!draft.trim() || send.isPending}
            accessibilityLabel="Send message"
            style={styles.send}
            testID="send"
          >
            <Icon name="arrow-left" size={s(18)} color={colors.textOnOrange} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Group({ group }: { group: MessageGroup }) {
  return (
    <View style={styles.group}>
      <Text
        variant="meta"
        color={colors.textSecondary}
        align={group.mine ? 'right' : 'left'}
        style={styles.groupTime}
      >
        {group.mine
          ? formatClock(group.sentAt)
          : `${group.authorName} · ${formatClock(group.sentAt)}`}
      </Text>

      {group.messages.map((message, index) => {
        const last = index === group.messages.length - 1;
        return (
          <View key={message.id} style={[styles.bubbleRow, group.mine && styles.bubbleRowMine]}>
            <View
              style={[
                styles.bubble,
                group.mine ? styles.bubbleMine : styles.bubbleTheirs,
                // The frame squares the corner nearest the screen edge on the last of a run.
                last && (group.mine ? styles.tailMine : styles.tailTheirs),
              ]}
            >
              <Text variant="body" color={colors.ink}>
                {message.body}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Frame: an 80pt header band.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: s(64),
    paddingHorizontal: spacing.gutter,
  },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: s(2) },

  loader: { marginTop: s(48) },
  thread: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  dateRow: { alignItems: 'center', paddingVertical: spacing.lg },

  group: { marginBottom: s(22) },
  groupTime: { marginBottom: s(7) },
  bubbleRow: { flexDirection: 'row', marginBottom: s(2) },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    minHeight: s(42),
    justifyContent: 'center',
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: s(10),
  },
  bubbleMine: { backgroundColor: colors.orangeWash },
  bubbleTheirs: { backgroundColor: colors.card },
  tailMine: { borderBottomRightRadius: s(2) },
  tailTheirs: { borderBottomLeftRadius: s(2) },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: size.fieldHeight,
    maxHeight: s(120),
    borderRadius: radius.search,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: s(12),
    paddingBottom: s(12),
    ...typography.body,
    // The shared line height clips descenders inside a TextInput.
    lineHeight: undefined,
    color: colors.text,
  },
  send: {
    width: size.fieldHeight,
    height: size.fieldHeight,
    borderRadius: size.fieldHeight / 2,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    // The arrow glyph points left; rotating it gives send without a near-identical path.
    transform: [{ rotate: '180deg' }],
  },
});
