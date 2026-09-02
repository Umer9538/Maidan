/**
 * A ground's photos.
 *
 * The first one is the card thumbnail everywhere in the app, so it is labelled rather than
 * left as an ordering an owner has to infer — "make this the cover" is a real request, and
 * without it the only way to change the hero is to delete everything in front of it.
 *
 * Uploading is deliberately eager: the file goes up as soon as it is picked, and the venue
 * is saved separately. Abandoning the form then leaves an orphaned file on the server
 * rather than a listing that says it has a photo which was never stored.
 */
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Photo, PressableScale, Text } from '@/components/ui';
import { useApi } from '@/data/provider';
import { colors, radius, s, spacing } from '@/theme';

export interface PhotoStripProps {
  venueId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
}

/** Room for a hero and a handful of angles. Past that nobody scrolls. */
const MAX_PHOTOS = 8;

export function PhotoStrip({ venueId, photos, onChange }: PhotoStripProps) {
  const api = useApi();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    // Asked at the moment of use, with the reason obvious from what was just tapped, rather
    // than in a burst at first launch that people refuse out of habit.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photos are off',
        'Allow photo access in Settings to add pictures of your ground.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (result.canceled) return;

    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        uploaded.push(
          await api.uploadVenuePhoto(venueId, {
            uri: asset.uri,
            mimeType: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? 'photo.jpg',
          }),
        );
      }
      onChange([...photos, ...uploaded].slice(0, MAX_PHOTOS));
    } catch (error) {
      // One at a time, so a rejected file says which rule it broke — too large, not an
      // image — rather than the whole batch failing as "upload failed".
      Alert.alert('Could not add that photo', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const makeCover = (index: number) =>
    onChange([photos[index], ...photos.filter((_, at) => at !== index)]);

  const removeAt = (index: number) => onChange(photos.filter((_, at) => at !== index));

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.item} testID={`photo-${index}`}>
            <Photo uri={uri} name="" id={uri} style={styles.image} monogramSize={0} />

            {index === 0 ? (
              <View style={styles.cover}>
                <Text variant="meta" color={colors.textOnOrange}>
                  Cover
                </Text>
              </View>
            ) : (
              <PressableScale
                onPress={() => makeCover(index)}
                accessibilityLabel="Make this the cover photo"
                style={styles.makeCover}
                testID={`cover-${index}`}
              >
                <Text variant="meta" color={colors.orangeInk}>
                  Make cover
                </Text>
              </PressableScale>
            )}

            <PressableScale
              onPress={() => removeAt(index)}
              accessibilityLabel="Remove this photo"
              style={styles.remove}
              testID={`remove-photo-${index}`}
            >
              <Icon name="more-vertical" size={s(14)} color={colors.white} />
            </PressableScale>
          </View>
        ))}

        {photos.length < MAX_PHOTOS ? (
          <PressableScale
            onPress={pick}
            disabled={busy}
            accessibilityLabel="Add photos"
            style={styles.add}
            testID="add-photo"
          >
            <Icon name="plus" size={s(20)} color={colors.orangeInk} bold />
            <Text variant="meta" color={colors.orangeInk}>
              {busy ? 'Uploading…' : 'Add'}
            </Text>
          </PressableScale>
        ) : null}
      </ScrollView>

      <Text variant="meta" color={colors.textSecondary}>
        The first photo is what players see on the card. Wide shots of the courts do better
        than the entrance.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  strip: { gap: spacing.sm, paddingVertical: spacing.xs },
  item: { width: s(140), gap: s(6) },
  image: { width: s(140), height: s(96), borderRadius: radius.thumb },
  cover: {
    alignSelf: 'flex-start',
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    paddingHorizontal: s(10),
    paddingVertical: s(3),
  },
  makeCover: { paddingVertical: s(3) },
  remove: {
    position: 'absolute',
    top: s(6),
    right: s(6),
    width: s(26),
    height: s(26),
    borderRadius: s(13),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32, 34, 44, 0.55)',
  },
  add: {
    width: s(140),
    height: s(96),
    borderRadius: radius.thumb,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
  },
});
