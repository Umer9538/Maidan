/**
 * Saved cards.
 *
 * Held here so checkout and the payment-methods screen agree, and persisted so a card
 * survives a relaunch. What is persisted is only the brand, last four, expiry month and a
 * gateway token — never a card number and never a CVV, which is the whole point of letting
 * the gateway hold PCI scope (docs/05 §6).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { SavedCard } from '@/domain/types';

const KEY = 'maidan.payments.cards';

export interface AddCardInput {
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  makePrimary: boolean;
}

interface PaymentsValue {
  cards: SavedCard[];
  primaryCard: SavedCard | null;
  addCard: (input: AddCardInput) => SavedCard;
  removeCard: (cardId: string) => void;
  makePrimary: (cardId: string) => void;
}

const PaymentsContext = createContext<PaymentsValue | null>(null);

export function usePayments(): PaymentsValue {
  const value = useContext(PaymentsContext);
  if (!value) throw new Error('usePayments must be used inside <PaymentsProvider>');
  return value;
}

export function PaymentsProvider({
  children,
  initialCards,
}: {
  children: ReactNode;
  /** Overridden in tests to skip the storage read. */
  initialCards?: SavedCard[];
}) {
  const [cards, setCards] = useState<SavedCard[]>(initialCards ?? []);

  useEffect(() => {
    if (initialCards) return;

    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) setCards(parsed as SavedCard[]);
      })
      .catch(() => {
        // No saved cards, as far as this launch is concerned.
      });
    return () => {
      active = false;
    };
  }, [initialCards]);

  const persist = useCallback((next: SavedCard[]) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  }, []);

  const addCard = useCallback(
    (input: AddCardInput) => {
      const card: SavedCard = {
        id: `card-${Date.now().toString(36)}`,
        // Stands in for the gateway's token until the real integration lands.
        token: `tok_${Math.random().toString(36).slice(2, 12)}`,
        brand: input.brand,
        last4: input.last4,
        expiryMonth: input.expiryMonth,
        expiryYear: input.expiryYear,
        isPrimary: input.makePrimary,
      };

      setCards((current) => {
        // The first card saved is primary whatever the checkbox said — otherwise the
        // player ends up with a card and no default.
        const isFirst = current.length === 0;
        const primary = input.makePrimary || isFirst;
        const next = [
          ...(primary ? current.map((each) => ({ ...each, isPrimary: false })) : current),
          { ...card, isPrimary: primary },
        ];
        return persist(next);
      });

      return card;
    },
    [persist],
  );

  const removeCard = useCallback(
    (cardId: string) => {
      setCards((current) => {
        const next = current.filter((card) => card.id !== cardId);
        // Removing the default promotes the next card, so there is always one.
        if (next.length > 0 && !next.some((card) => card.isPrimary)) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return persist(next);
      });
    },
    [persist],
  );

  const makePrimary = useCallback(
    (cardId: string) => {
      setCards((current) =>
        persist(current.map((card) => ({ ...card, isPrimary: card.id === cardId }))),
      );
    },
    [persist],
  );

  const value = useMemo<PaymentsValue>(
    () => ({
      cards,
      primaryCard: cards.find((card) => card.isPrimary) ?? null,
      addCard,
      removeCard,
      makePrimary,
    }),
    [cards, addCard, removeCard, makePrimary],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}
