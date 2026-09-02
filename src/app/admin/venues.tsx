/**
 * The review queue — the MAIDAN side of venue onboarding.
 *
 * An owner registers a ground and it sits here until someone looks at it. Nothing on an
 * unapproved listing is bookable, in the app or at the owner's own counter, so this queue
 * is the gate between a stranger typing a name into a form and a real player turning up at
 * a real gate expecting a court.
 *
 * Rejecting requires a note. A rejection with no reason leaves an owner with a dead listing
 * and nothing to act on, and the next thing that happens is a phone call.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Button,
  EmptyState,
  Screen,
  Segmented,
  Text,
  TextField,
} from '@/components/ui';
import {
  useApproveVenue,
  useRejectVenue,
  useSuspendVenue,
  useVenuesForReview,
} from '@/data/queries';
import type { VenueStatus } from '@/data/api';
import { CITY_LABELS, SPORT_LABELS } from '@/domain/labels';
import { formatOpeningHours } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, spacing } from '@/theme';

const TABS: { value: VenueStatus; label: string }[] = [
  { value: 'pending', label: 'To review' },
  { value: 'rejected', label: 'Sent back' },
  { value: 'verified', label: 'Approved' },
  { value: 'live', label: 'Live' },
];

export default function ReviewQueueScreen() {
  const goBack = useGoBack('/admin');
  const { status: initialStatus } = useLocalSearchParams<{ status?: VenueStatus }>();
  const [tab, setTab] = useState<VenueStatus>(initialStatus ?? 'pending');
  /** Which card has its reject box open. Only one at a time — this is a decision, not a form. */
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const venues = useVenuesForReview(tab);
  const approve = useApproveVenue();
  const reject = useRejectVenue();
  const suspend = useSuspendVenue();

  /** Whether the note box is asking for a rejection or a suspension. */
  const [intent, setIntent] = useState<'reject' | 'suspend'>('reject');

  const list = venues.data ?? [];

  const submitNote = (venueId: string) => {
    if (note.trim().length === 0) return;
    const done = {
      onSuccess: () => {
        setRejecting(null);
        setNote('');
      },
    };
    const input = { venueId, note: note.trim() };
    if (intent === 'suspend') suspend.mutate(input, done);
    else reject.mutate(input, done);
  };

  const openNote = (venueId: string, why: 'reject' | 'suspend') => {
    setRejecting(venueId);
    setIntent(why);
    setNote('');
  };

  return (
    <Screen>
      <AppBar title="Venue review" onBack={goBack} />

      <View style={styles.tabs}>
        <Segmented
          options={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setRejecting(null);
          }}
          testID="review-tabs"
        />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {list.length === 0 && !venues.isPending ? (
          <EmptyState
            icon="tick"
            title={tab === 'pending' ? 'Nothing waiting' : 'Nothing here'}
            body={
              tab === 'pending'
                ? 'Every ground that has been sent in has been looked at.'
                : 'No grounds in this state.'
            }
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {list.map((venue) => (
              <View key={venue.id} style={styles.card} testID={`review-${venue.id}`}>
                <Text variant="cardTitle">{venue.name}</Text>
                <Text variant="meta" color={colors.textSecondary}>
                  {venue.area}, {CITY_LABELS[venue.city]}
                </Text>

                <View style={styles.facts}>
                  <Fact
                    icon="clock"
                    value={formatOpeningHours(venue.hours.opensAt, venue.hours.closesAt)}
                  />
                  {venue.phone ? <Fact icon="call" value={venue.phone} /> : null}
                  <Fact
                    icon="trophy"
                    value={
                      venue.sports.length > 0
                        ? venue.sports.map((sport) => SPORT_LABELS[sport]).join(', ')
                        : 'No courts added yet'
                    }
                  />
                </View>

                {venue.about ? (
                  <Text variant="meta" color={colors.textSecondary} style={styles.about}>
                    {venue.about}
                  </Text>
                ) : null}

                {/*
                  Said plainly on the card, because it is the one thing an approver has to
                  understand: approving does not put this in front of players. The owner
                  publishes when they are ready, and cannot until there is a court.
                */}
                {venue.sports.length === 0 ? (
                  <View style={styles.warn}>
                    <Text variant="meta" color={colors.orangeDeep}>
                      No courts yet. Approving is fine — they cannot go live until they add
                      one.
                    </Text>
                  </View>
                ) : null}

                {venue.reviewNote ? (
                  <Text variant="meta" color={colors.textSecondary} style={styles.about}>
                    Last note: {venue.reviewNote}
                  </Text>
                ) : null}

                {rejecting === venue.id ? (
                  <View style={styles.rejectBox}>
                    <TextField
                      value={note}
                      onChangeText={setNote}
                      placeholder={
                        intent === 'suspend'
                          ? 'Why is this ground coming off the board?'
                          : 'What does the owner need to fix?'
                      }
                      multiline
                      accessibilityLabel="Reason"
                      testID={`note-${venue.id}`}
                    />
                    <View style={styles.actions}>
                      <Button
                        label="Cancel"
                        variant="soft"
                        onPress={() => {
                          setRejecting(null);
                          setNote('');
                        }}
                        style={styles.action}
                      />
                      <Button
                        label={intent === 'suspend' ? 'Take it down' : 'Send back'}
                        onPress={() => submitNote(venue.id)}
                        loading={reject.isPending || suspend.isPending}
                        // The note is the whole point of this box: a refusal with no reason
                        // leaves an owner with a dead listing and nothing to act on.
                        disabled={note.trim().length === 0}
                        style={styles.action}
                        testID={`confirm-note-${venue.id}`}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    {/*
                      One control per state. A ground awaiting review can be approved or
                      sent back; an approved one is waiting on its owner and has nothing
                      for us to press; a live one can be taken down.
                    */}
                    {venue.status === 'pending' || venue.status === 'rejected' ? (
                      <>
                        <Button
                          label="Needs changes"
                          variant="soft"
                          onPress={() => openNote(venue.id, 'reject')}
                          style={styles.action}
                          testID={`reject-${venue.id}`}
                        />
                        <Button
                          label="Approve"
                          onPress={() => approve.mutate({ venueId: venue.id })}
                          loading={approve.isPending}
                          style={styles.action}
                          testID={`approve-${venue.id}`}
                        />
                      </>
                    ) : null}

                    {venue.status === 'verified' ? (
                      <Text variant="meta" color={colors.textSecondary}>
                        Approved. Waiting for the owner to go live.
                      </Text>
                    ) : null}

                    {venue.status === 'live' ? (
                      <Button
                        label="Take off the board"
                        variant="soft"
                        onPress={() => openNote(venue.id, 'suspend')}
                        style={styles.action}
                        testID={`suspend-${venue.id}`}
                      />
                    ) : null}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Fact({ icon, value }: { icon: 'clock' | 'call' | 'trophy'; value: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={s(14)} color={colors.orange} bold />
      <Text variant="meta" color={colors.textSecondary} style={styles.factText}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  facts: { gap: s(6), marginTop: spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  factText: { flex: 1 },
  about: { lineHeight: s(18), marginTop: spacing.xs },
  warn: {
    backgroundColor: colors.orangeWashSolid,
    borderRadius: radius.thumb,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  rejectBox: { gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
});
