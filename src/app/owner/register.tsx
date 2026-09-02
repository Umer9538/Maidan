/**
 * Register a ground.
 *
 * The first half of owner onboarding: who you are and where. Courts — how much space there
 * actually is — come next, on their own screen, because asking for both at once produces a
 * form nobody finishes on a phone.
 *
 * The notice says plainly what happens after submitting. A listing goes into review and
 * nothing on it can be booked until MAIDAN approves it; an owner expecting to trade the
 * same evening would otherwise think the app was broken.
 */
import { useRouter } from 'expo-router';

import { AppBar, Screen } from '@/components/ui';
import { useCreateVenue } from '@/data/queries';
import { BLANK_VENUE, VenueForm, toVenueInput } from '@/features/owner/venue-form';
import { useGoBack } from '@/lib/navigation';

/**
 * Lahore's centre.
 *
 * A rough pin the owner can correct beats making them find one before they can submit —
 * and the map picker that would replace this is not built. The area they type is what
 * players actually navigate by.
 */
const LAHORE = { latitude: 31.5204, longitude: 74.3587 };

export default function RegisterVenueScreen() {
  const router = useRouter();
  const goBack = useGoBack('/owner/venues');
  const create = useCreateVenue();

  return (
    <Screen>
      <AppBar title="Register a ground" onBack={goBack} />

      <VenueForm
        initial={BLANK_VENUE}
        submitLabel="Send for review"
        busy={create.isPending}
        error={create.isError ? (create.error as Error).message : undefined}
        notice="We check every ground before it goes live. Nothing can be booked until then — usually a day or two."
        onSubmit={(values) =>
          create.mutate(
            { ...toVenueInput(values), ...LAHORE },
            {
              // Straight on to courts. A ground with no courts cannot go live, so stopping
              // here would leave every new owner one step short without saying so.
              onSuccess: (venue) =>
                router.replace({ pathname: '/owner/courts', params: { venueId: venue.id } }),
            },
          )
        }
      />
    </Screen>
  );
}
