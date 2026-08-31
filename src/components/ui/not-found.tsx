/**
 * What a screen shows when the record it was opened for is not there.
 *
 * Several screens take their id from the query string rather than the path — `/booking/
 * cancel?bookingId=…`, `/match/create?bookingId=…`. Their queries are declared
 * `enabled: Boolean(id)` so an empty id makes no pointless request, but a disabled React
 * Query never leaves `pending`: the screen's `isPending` guard then holds forever and the
 * player watches a spinner that will never resolve, with no way out but the OS back
 * button. A missing id is not a slow load, and it should not look like one.
 */
import { AppBar } from '@/components/ui/app-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

export interface NotFoundProps {
  /** The screen's own title, so the bar does not change under the player. */
  title: string;
  /** What could not be found, lowercase: "booking", "ground", "conversation". */
  record: string;
  onBack: () => void;
}

export function NotFound({ title, record, onBack }: NotFoundProps) {
  return (
    <Screen>
      <AppBar title={title} onBack={onBack} />
      <EmptyState
        icon="search"
        title={`This ${record} is not here`}
        body={`The link may be out of date, or the ${record} may have been removed.`}
        actionLabel="Go back"
        onAction={onBack}
        testID="not-found"
      />
    </Screen>
  );
}
