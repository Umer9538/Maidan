// @testing-library/react-native v14 renders asynchronously, so every render is awaited.
import { render, screen } from '@testing-library/react-native';

import { ListCard } from '../list-card';

describe('ListCard', () => {
  it('announces the whole row as one label, so a screen reader does not read four fragments', async () => {
    await render(
      <ListCard
        id="challenge-1"
        title="Gulberg Gladiators"
        metaLeft="Futsal 5v5 · W12–L3"
        metaRight="Sat, 9 PM"
        price="Accept"
        action="Split cost"
      />,
    );

    expect(
      screen.getByLabelText(
        'Gulberg Gladiators, Futsal 5v5 · W12–L3, Sat, 9 PM, Accept, Split cost',
      ),
    ).toBeTruthy();
  });

  it('truncates the meta line rather than letting it collide with the date', async () => {
    await render(
      <ListCard
        id="challenge-2"
        title="Model Town Tigers"
        metaLeft="Box Cricket · W16–L8 · a very long record that would overflow the column"
        metaRight="Tue, 11 PM"
      />,
    );

    // The frame's own cards overlap here; both halves must stay on one line each.
    expect(screen.getByText(/Box Cricket/).props.numberOfLines).toBe(1);
    expect(screen.getByText('Tue, 11 PM').props.numberOfLines).toBe(1);
  });

  it('omits the right column entirely when there is no price or action', async () => {
    await render(
      <ListCard id="v1" title="Padel Republic DHA" metaLeft="Padel" metaRight="DHA Phase 5" />,
    );
    expect(screen.queryByText('Join now')).toBeNull();
  });
});
