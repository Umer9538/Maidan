/**
 * Who can approve grounds.
 *
 * Admin rights used to be grantable only by hand in SQL, which meant every new person on
 * the team needed someone with database access and a spare minute. That is fine for one
 * admin and untenable for five.
 *
 * Granting is deliberate: search for a person, read their email to be sure it is the right
 * one, then confirm. With no search term the list is the current admins, which is the
 * question asked far more often — who has this.
 */
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { AppBar, Button, Screen, SearchBar, Text, Thumb } from '@/components/ui';
import { usePlayersForAdmin, useSetAdmin } from '@/data/queries';
import { useAuth } from '@/features/auth/context';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, shadow, size, spacing } from '@/theme';

export default function AdminsScreen() {
  const goBack = useGoBack('/admin');
  const { session } = useAuth();

  const [search, setSearch] = useState('');
  const people = usePlayersForAdmin(search.trim());
  const setAdmin = useSetAdmin();

  const list = people.data ?? [];
  const searching = search.trim().length > 0;

  const confirm = (playerId: string, name: string, grant: boolean) =>
    Alert.alert(
      grant ? `Make ${name} an admin?` : `Remove ${name}'s access?`,
      grant
        ? 'They will be able to approve and reject venue listings.'
        : 'They will no longer see the review queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: grant ? 'Make admin' : 'Remove',
          style: grant ? 'default' : 'destructive',
          onPress: () =>
            setAdmin.mutate(
              { playerId, isAdmin: grant },
              { onError: (error) => Alert.alert('Could not change that', (error as Error).message) },
            ),
        },
      ],
    );

  return (
    <Screen>
      <AppBar title="Admins" onBack={goBack} />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.search}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name to add someone"
            testID="admin-search"
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text variant="meta" color={colors.textSecondary}>
            {searching
              ? 'Anyone matching. Admins are listed first.'
              : 'Everyone who can approve grounds.'}
          </Text>

          {list.map((person) => {
            const isMe = person.id === session?.id;
            return (
              <View key={person.id} style={styles.row} testID={`person-${person.id}`}>
                <Thumb
                  id={person.id}
                  name={person.name}
                  uri={person.avatarUrl}
                  dimension={size.chatAvatar}
                  circular
                />

                <View style={styles.rowText}>
                  <Text variant="rowTitle" numberOfLines={1}>
                    {person.name}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  {/* The email is what tells two people with the same name apart. */}
                  <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                    {person.email ?? person.phone ?? '—'}
                  </Text>
                </View>

                {/*
                  An admin cannot remove their own access. Not a security property — they
                  could grant it back from another account — but it stops the last admin
                  locking the whole team out of the queue with one tap.
                */}
                {isMe ? (
                  <Text variant="metaStrong" color={colors.textSecondary}>
                    Admin
                  </Text>
                ) : (
                  <Button
                    label={person.isAdmin ? 'Remove' : 'Make admin'}
                    variant={person.isAdmin ? 'soft' : 'primary'}
                    onPress={() => confirm(person.id, person.name, !person.isAdmin)}
                    loading={setAdmin.isPending && setAdmin.variables?.playerId === person.id}
                    testID={`toggle-${person.id}`}
                  />
                )}
              </View>
            );
          })}

          {list.length === 0 && !people.isPending ? (
            <Text variant="body" color={colors.textSecondary} style={styles.empty}>
              {searching ? 'Nobody by that name.' : 'No admins yet.'}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    ...shadow.card,
  },
  rowText: { flex: 1, gap: 2 },
  empty: { marginTop: spacing.xl, textAlign: 'center' },
});
