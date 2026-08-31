/**
 * Notifications — the `32_Notification` frame: Unread and Earlier groups with count chips,
 * rows reading "**Name** did thing", and Reject / Accept on anything awaiting a decision.
 */
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';

import { AppBar, Button, Divider, EmptyState, Screen, Text, Thumb } from '@/components/ui';
import { useNotifications } from '@/data/queries';
import type { Notification } from '@/domain/types';
import { formatRelative } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, size, spacing } from '@/theme';

export default function NotificationsScreen() {
  const goBack = useGoBack('/(tabs)');
  const notifications = useNotifications();

  const all = notifications.data ?? [];
  const sections = [
    { title: 'Unread', data: all.filter((each) => !each.read) },
    { title: 'Earlier', data: all.filter((each) => each.read) },
  ].filter((section) => section.data.length > 0);

  return (
    <Screen>
      <AppBar title="Notifications" onBack={goBack} />

      {notifications.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="cardTitle">{section.title}</Text>
              <View style={styles.countChip}>
                <Text variant="metaStrong" color={colors.orangeDeep}>
                  {section.data.length}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => <Row notification={item} />}
          ItemSeparatorComponent={() => <Divider />}
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title="Nothing new"
              body="Join requests, challenges and booking confirmations land here."
            />
          }
        />
      )}
    </Screen>
  );
}

function Row({ notification }: { notification: Notification }) {
  return (
    <View style={styles.row}>
      <Thumb
        id={notification.id}
        name={notification.actorName}
        uri={notification.actorAvatarUrl}
        dimension={size.actionCircle}
        circular
      />
      <View style={styles.rowBody}>
        <Text variant="bodySmall">
          <Text variant="rowTitle">{notification.actorName}</Text> {notification.body}
        </Text>
        <Text variant="meta" color={colors.textSecondary}>
          {formatRelative(notification.createdAt)}
        </Text>

        {notification.decision ? (
          <View style={styles.decision}>
            <Button label="Reject" variant="secondary" style={styles.decisionButton} />
            <Button label="Accept" variant="accent" style={styles.decisionButton} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  loader: { marginTop: 48 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  countChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.orangeWash,
  },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  rowBody: { flex: 1, gap: 4 },
  decision: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  decisionButton: { flex: 1, height: 42 },
});
