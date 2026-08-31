import type { Message } from '@/domain/types';
import { groupMessages } from '../messages';

const at = (isoLocal: string) => `${isoLocal}+05:00`;

function message(id: string, authorId: string, sentAt: string, mine = false): Message {
  return {
    id,
    threadId: 't1',
    authorId,
    authorName: authorId,
    body: id,
    sentAt: at(sentAt),
    mine,
  };
}

describe('groupMessages', () => {
  it('returns nothing for an empty thread', () => {
    expect(groupMessages([])).toEqual([]);
  });

  it('runs consecutive messages from one person into a single group', () => {
    const sections = groupMessages([
      message('a', 'ali', '2026-09-02T21:00:00'),
      message('b', 'ali', '2026-09-02T21:01:00'),
      message('c', 'ali', '2026-09-02T21:03:00'),
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0].groups).toHaveLength(1);
    expect(sections[0].groups[0].messages.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('starts a new group when the author changes', () => {
    const sections = groupMessages([
      message('a', 'ali', '2026-09-02T21:00:00'),
      message('b', 'me', '2026-09-02T21:01:00', true),
      message('c', 'ali', '2026-09-02T21:02:00'),
    ]);

    expect(sections[0].groups).toHaveLength(3);
    expect(sections[0].groups[1].mine).toBe(true);
  });

  it('breaks a run when the same person returns much later', () => {
    const sections = groupMessages([
      message('a', 'ali', '2026-09-02T21:00:00'),
      message('b', 'ali', '2026-09-02T21:20:00'),
    ]);

    expect(sections[0].groups).toHaveLength(2);
  });

  it('splits across calendar days in Pakistan time', () => {
    const sections = groupMessages([
      message('a', 'ali', '2026-09-02T23:58:00'),
      message('b', 'ali', '2026-09-03T00:01:00'),
    ]);

    expect(sections).toHaveLength(2);
  });

  it('prints the time of the first message in a run, not the last', () => {
    const sections = groupMessages([
      message('a', 'ali', '2026-09-02T21:00:00'),
      message('b', 'ali', '2026-09-02T21:02:00'),
    ]);

    expect(sections[0].groups[0].sentAt).toBe(at('2026-09-02T21:00:00'));
  });
});
