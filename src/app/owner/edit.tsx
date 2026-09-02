/**
 * Edit a ground.
 *
 * Prices change, hours change, a ground adds floodlights. Without this an owner would have
 * to ask us to correct their own listing, which is the sort of thing that makes a venue
 * stop bothering with the app.
 *
 * Same form as registering, prefilled — one component, so the validation and the wording
 * cannot drift between the two.
 */
import { useLocalSearchParams } from 'expo-router';

import { AppBar, NotFound, Screen } from '@/components/ui';
import { useMyVenues, useUpdateVenue } from '@/data/queries';
import { VenueForm, toVenueInput } from '@/features/owner/venue-form';
import { useGoBack } from '@/lib/navigation';

export default function EditVenueScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const goBack = useGoBack('/owner/venues');

  const venues = useMyVenues();
  const update = useUpdateVenue();

  const venue = (venues.data ?? []).find((candidate) => candidate.id === venueId);

  // Either no id at all, or an id that is not one of ours. Both are the same dead end, and
  // the list this reads from is already scoped to the caller's own grounds.
  if (!venueId || (venues.isSuccess && !venue)) {
    return <NotFound title="Edit ground" record="ground" onBack={goBack} />;
  }

  return (
    <Screen>
      <AppBar title="Edit ground" onBack={goBack} />

      {venue ? (
        <VenueForm
          initial={{
            name: venue.name,
            city: venue.city,
            area: venue.area,
            opensAt: venue.hours.opensAt,
            closesAt: venue.hours.closesAt,
            phone: venue.phone,
            about: venue.about,
            amenities: venue.amenities,
          }}
          submitLabel="Save changes"
          busy={update.isPending}
          error={update.isError ? (update.error as Error).message : undefined}
          notice={
            venue.status === 'live'
              ? 'This ground is live. Changes show to players straight away.'
              : undefined
          }
          onSubmit={(values) =>
            update.mutate(
              { venueId, patch: toVenueInput(values) },
              { onSuccess: () => goBack() },
            )
          }
        />
      ) : null}
    </Screen>
  );
}
