/**
 * Grouping for the conversation thread.
 *
 * Frame 35 does not put a timestamp in every bubble — it stacks consecutive messages from
 * one person tightly and prints one time above the run. That is the difference between a
 * conversation and a log, so the grouping is computed rather than approximated per bubble.
 */
import type { Message } from '@/domain/types';
import { pktDayDifference } from './datetime';

/** Consecutive messages from the same author within this window form one run. */
export const GROUP_WINDOW_MINUTES = 5;

export interface MessageGroup {
  /** Stable across renders: the first message's id. */
  id: string;
  authorId: string;
  authorName: string;
  mine: boolean;
  /** The time printed above the run — the first message's. */
  sentAt: string;
  messages: Message[];
}

export interface MessageSection {
  /** ISO instant of the day this section covers. */
  day: string;
  groups: MessageGroup[];
}

/**
 * Splits a thread into day sections, each holding runs of consecutive messages by one
 * author. Input is assumed to be in ascending time order, as the API returns it.
 */
export function groupMessages(messages: Message[]): MessageSection[] {
  const sections: MessageSection[] = [];

  for (const message of messages) {
    const section = sections.at(-1);
    const sameDay = section ? pktDayDifference(section.day, message.sentAt) === 0 : false;

    if (!section || !sameDay) {
      sections.push({
        day: message.sentAt,
        groups: [newGroup(message)],
      });
      continue;
    }

    const group = section.groups.at(-1);
    if (group && group.authorId === message.authorId && withinWindow(group, message)) {
      group.messages.push(message);
    } else {
      section.groups.push(newGroup(message));
    }
  }

  return sections;
}

function newGroup(message: Message): MessageGroup {
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    mine: message.mine,
    sentAt: message.sentAt,
    messages: [message],
  };
}

function withinWindow(group: MessageGroup, message: Message): boolean {
  const last = group.messages.at(-1);
  if (!last) return false;
  const gap = new Date(message.sentAt).getTime() - new Date(last.sentAt).getTime();
  return gap <= GROUP_WINDOW_MINUTES * 60_000;
}
