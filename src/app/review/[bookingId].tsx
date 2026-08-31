/**
 * Rate a ground — frames `53/54_Event Review Popup`.
 *
 * Measured from the flattened export: a 326 x 412 card centred over a scrim, a 167pt photo
 * inset 10 from the card edge, the title beneath it, two lines of body copy, a centred row
 * of five stars at y485 spanning 158, and a pair of 105pt buttons at y540 — peach on the
 * left, orange on the right.
 *
 * Only a played booking can be rated, which is what makes reviews verified (docs/04,
 * Pillar 1). The API enforces it; this screen states it plainly if it comes back refused.
 */
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Button, PressableScale, Text } from '@/components/ui';
import { useBooking, useSubmitReview, useVenue } from '@/data/queries';
import { ApiError } from '@/data/api';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing, typography } from '@/theme';

const STARS = [1, 2, 3, 4, 5];

export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const goBack = useGoBack('/bookings');

  const booking = useBooking(bookingId);
  const venue = useVenue(booking.data?.venueId ?? '');
  const submit = useSubmitReview();

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const send = () => {
    if (rating === 0) return;
    setFailure(null);
    submit.mutate(
      { bookingId, rating, body },
      {
        onSuccess: goBack,
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'not_played') {
            setFailure('You can rate a ground once you have played there.');
            return;
          }
          if (error instanceof ApiError && error.code === 'already_reviewed') {
            setFailure('You have already rated this booking.');
            return;
          }
          setFailure('That did not send. Try again.');
        },
      },
    );
  };

  return (
    <View style={styles.scrim}>
      {/* Tapping the scrim is the "no thanks" the frame draws as a button. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={goBack} accessibilityLabel="Dismiss" />

      <View style={styles.card}>
        <Image
          source={{ uri: venue.data?.photos[0] }}
          style={styles.photo}
          contentFit="cover"
          transition={180}
          accessibilityIgnoresInvertColors
        />

        <Text variant="cardTitle" align="center" style={styles.title}>
          {venue.data?.name ?? 'This ground'}
        </Text>
        <Text variant="bodySmall" color={colors.textSecondary} align="center">
          How was it? Your rating helps other players pick a ground.
        </Text>

        <View
          style={styles.stars}
          accessibilityRole="adjustable"
          accessibilityLabel="Rating"
          accessibilityValue={{ min: 0, max: 5, now: rating }}
        >
          {STARS.map((star) => (
            <PressableScale
              key={star}
              onPress={() => setRating(star)}
              accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
              accessibilityState={{ selected: rating >= star }}
              testID={`star-${star}`}
            >
              <Icon
                name="star"
                size={s(30)}
                color={rating >= star ? colors.orange : colors.border}
                bold={rating >= star}
              />
            </PressableScale>
          ))}
        </View>

        {rating > 0 ? (
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Add a note for other players (optional)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            multiline
            maxLength={280}
            accessibilityLabel="Review note"
            testID="review-body"
          />
        ) : null}

        {failure ? (
          <Text variant="meta" color={colors.danger} align="center" style={styles.failure}>
            {failure}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="No thanks"
            variant="soft"
            style={styles.action}
            onPress={goBack}
            testID="review-dismiss"
          />
          <Button
            label="Rate"
            style={styles.action}
            disabled={rating === 0}
            loading={submit.isPending}
            onPress={send}
            testID="review-submit"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(32, 34, 44, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
  },
  // Frame: a 326-wide card, centred.
  card: {
    width: '100%',
    maxWidth: s(326),
    backgroundColor: colors.card,
    borderRadius: radius.sheet,
    padding: s(10),
    paddingBottom: s(20),
  },
  photo: {
    width: '100%',
    height: s(167),
    borderRadius: radius.card,
    backgroundColor: colors.surfaceMuted,
  },
  title: { marginTop: s(19), marginBottom: s(10), paddingHorizontal: s(14) },
  // Frame: a centred row of five stars.
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(8),
    marginTop: s(28),
  },
  input: {
    marginTop: spacing.xl,
    marginHorizontal: s(14),
    minHeight: s(72),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.bodySmall,
    lineHeight: undefined,
    color: colors.text,
    textAlignVertical: 'top',
  },
  failure: { marginTop: spacing.md },
  // Frame: two 105pt buttons at y540.
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(12),
    marginTop: s(30),
    paddingHorizontal: s(14),
  },
  action: { flex: 1, height: s(48) },
});
