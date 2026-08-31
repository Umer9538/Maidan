/**
 * Filter — frame `25_Filter`.
 *
 * Layout from the export: category chips at y127 (52 tall), a "Time and Date" label at
 * y204, day pills at y241 (42 tall), a field row at y299 (57), a "Location" label at y381,
 * a second field at y418, the price block at y508, and RESET / APPLY at y722.
 *
 * The frame's categories are Design / Art / Sports / Music and its location is Dhaka;
 * ours are the three sports and the Lahore areas the seed actually covers.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, FieldRow, PillGroup, PriceSlider, Sheet, Text } from '@/components/ui';
import { SPORT_LABELS } from '@/domain/labels';
import type { Sport } from '@/domain/types';
import { colors, s, spacing } from '@/theme';

export type DateWindow = 'today' | 'tomorrow' | 'week';

export interface DiscoveryFilters {
  sport: Sport | null;
  when: DateWindow | null;
  area: string | null;
  maxPricePerHour: number;
}

export const PRICE_FLOOR = 500;
export const PRICE_CEILING = 8000;

export const EMPTY_FILTERS: DiscoveryFilters = {
  sport: null,
  when: null,
  area: null,
  maxPricePerHour: PRICE_CEILING,
};

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  value: DiscoveryFilters;
  onApply: (filters: DiscoveryFilters) => void;
  /** Prices in the unfiltered result set, drawn behind the slider. */
  distribution?: number[];
}

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

const WINDOWS: { value: DateWindow; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'This week' },
];

export function FilterSheet({ visible, onClose, value, onApply, distribution }: FilterSheetProps) {
  // Edits are local until Apply, so dismissing the sheet discards them — which is what a
  // Reset/Apply pair implies.
  const [draft, setDraft] = useState<DiscoveryFilters>(value);

  const patch = (next: Partial<DiscoveryFilters>) =>
    setDraft((current) => ({ ...current, ...next }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filter"
      footer={
        <>
          <Button
            label="Reset"
            variant="soft"
            style={styles.reset}
            onPress={() => setDraft(EMPTY_FILTERS)}
            testID="filter-reset"
          />
          <Button
            label="Apply"
            style={styles.apply}
            onPress={() => onApply(draft)}
            testID="filter-apply"
          />
        </>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PillGroup
          options={SPORTS}
          value={draft.sport}
          onChange={(sport) => patch({ sport: draft.sport === sport ? null : sport })}
          testID="filter-sport"
        />

        <Text variant="cardTitle" style={styles.label}>
          Time and date
        </Text>
        <PillGroup
          options={WINDOWS}
          value={draft.when}
          onChange={(when) => patch({ when: draft.when === when ? null : when })}
          testID="filter-when"
        />

        <Text variant="cardTitle" style={styles.label}>
          Area
        </Text>
        {/*
          No handler: choosing an area needs the area picker, which is not built yet. The
          row shows the current value as plain content rather than pretending to be a
          control that leads nowhere.
        */}
        <FieldRow icon="location" value={draft.area ?? ''} placeholder="Anywhere in Lahore" />

        <View style={styles.price}>
          <PriceSlider
            min={PRICE_FLOOR}
            max={PRICE_CEILING}
            value={draft.maxPricePerHour}
            onChange={(maxPricePerHour) => patch({ maxPricePerHour })}
            distribution={distribution}
            testID="filter-price"
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** True when the filters differ from the empty set — drives the badge on the filter button. */
export function isFiltered(filters: DiscoveryFilters): boolean {
  return (
    filters.sport !== null ||
    filters.when !== null ||
    filters.area !== null ||
    filters.maxPricePerHour < PRICE_CEILING
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.lg },
  label: { marginTop: spacing.gutter, marginBottom: spacing.md, color: colors.ink },
  price: { marginTop: spacing.gutter },
  // Frame: RESET is the peach button at 128 wide, APPLY the dark one filling the rest.
  reset: { width: s(128) },
  apply: { flex: 1 },
});
