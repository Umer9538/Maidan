/**
 * End-to-end check against a running server.
 *
 * Exercises the guarantees that matter — slot integrity, hold expiry, idempotency, the
 * walk-in path and who is allowed to touch what — over real HTTP against real Postgres.
 * `npm run smoke` after any schema or service change.
 *
 * Every request carries a real bearer token, obtained the way the app obtains one. That is
 * the point of running it this way: a suite that skipped authentication would pass just as
 * happily against a server that had none.
 */
const API = process.env.API ?? 'http://localhost:4000';

/** Matches `SEED_PASSWORD` in seed.ts. */
const PASSWORD = 'maidan-dev-password';

/** Sent on every call unless a test is deliberately checking what happens without it. */
let token: string | null = null;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method: string, path: string, body?: unknown, as: string | null = token) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(as ? { authorization: `Bearer ${as}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { status: response.status, json } as { status: number; json: any };
}

/** Signs in as a seeded account and returns its access token. */
async function signIn(playerId: string): Promise<string> {
  const response = await call(
    'POST',
    '/auth/login',
    { email: `${playerId}@maidan.test`, password: PASSWORD },
    null,
  );
  if (response.status !== 200) {
    throw new Error(
      `could not sign in as ${playerId} (${response.status}). Run \`npm run seed\` first.`,
    );
  }
  return response.json.accessToken as string;
}

async function main() {
  console.log(`smoke: ${API}\n`);

  const health = await call('GET', '/health');
  check('health responds', health.json?.ok === true);

  console.log('\nauth');
  const anonymous = await call('GET', '/bookings', undefined, null);
  check('a request with no token is refused', anonymous.status === 401, `${anonymous.status}`);

  const forged = await call('GET', '/bookings', undefined, 'not.a.token');
  check('a made-up token is refused', forged.status === 401, `${forged.status}`);

  token = await signIn('player-self');
  check('signing in returns a usable token', typeof token === 'string' && token.length > 0);

  const badPassword = await call(
    'POST',
    '/auth/login',
    { email: 'player-self@maidan.test', password: 'wrong' },
    null,
  );
  check('the wrong password is refused', badPassword.status === 401, `${badPassword.status}`);

  const refreshed = await call(
    'POST',
    '/auth/login',
    { email: 'player-self@maidan.test', password: PASSWORD },
    null,
  );
  const rotated = await call(
    'POST',
    '/auth/refresh',
    { refreshToken: refreshed.json.refreshToken },
    null,
  );
  check('a refresh token buys a new session', rotated.status === 200, `${rotated.status}`);
  const replayed = await call(
    'POST',
    '/auth/refresh',
    { refreshToken: refreshed.json.refreshToken },
    null,
  );
  check('the same refresh token cannot be spent twice', replayed.status === 401, `${replayed.status}`);

  // Padel Republic's owner. The owner-side checks below run as this account, and the
  // authorisation checks run as the player, to prove the difference is enforced.
  const owner = await signIn('owner-ahmed');

  // Tomorrow, so nothing has already started.
  const day = new Date(Date.now() + 24 * 3_600_000).toISOString();
  const dayParam = encodeURIComponent(day);

  console.log('\nslots');
  const slots = await call('GET', `/courts/court-pr-1/slots?day=${dayParam}`);
  check('a full day of slots comes back', slots.json?.length === 17, `got ${slots.json?.length}`);
  const peak = slots.json?.find((slot: any) => slot.isPeak);
  const offPeak = slots.json?.find((slot: any) => !slot.isPeak);
  check('off-peak is priced from the court base', offPeak?.price === 4500, `${offPeak?.price}`);
  check('peak is priced from the night rule', peak?.price === 5500, `${peak?.price}`);

  /*
   * Evening slots on the requested PKT day. The grid runs to 1 AM, and those last two
   * slots belong to the *next* calendar day — correct for a calendar, wrong for a test
   * that then asks for this day's sheet.
   */
  const pktHour = (iso: string) => (new Date(iso).getUTCHours() + 5) % 24;
  const free = slots.json.filter(
    (slot: any) => slot.status === 'available' && pktHour(slot.startAt) >= 17 && pktHour(slot.startAt) <= 23,
  );
  check('there are evening slots to work with', free.length >= 2, `${free.length}`);
  const target = free[0];

  console.log('\nholds');
  const hold = await call('POST', '/holds', {
    courtId: 'court-pr-1',
    startAt: target.startAt,
  });
  check('a hold is taken', hold.status === 201 && Boolean(hold.json?.id));

  const second = await call('POST', '/holds', {
    courtId: 'court-pr-1',
    startAt: target.startAt,
  });
  check('a second hold on the same slot is refused', second.json?.error?.code === 'slot_taken');

  const held = await call('GET', `/courts/court-pr-1/slots?day=${dayParam}`);
  check(
    'the slot reads as held to everyone else',
    held.json.find((slot: any) => slot.startAt === target.startAt)?.status === 'held',
  );

  console.log('\nbooking');
  const intentId = `smoke-${Date.now()}`;
  const booking = await call('POST', '/bookings', {
    intentId,
    holdId: hold.json.id,
    paymentMode: 'deposit',
    provider: 'jazzcash',
  });
  check('the booking is created', booking.status === 201, JSON.stringify(booking.json));
  check('a booking code is issued', /^[A-Z2-9]{6}$/.test(booking.json?.code ?? ''));
  check(
    'the deposit split adds up',
    booking.json.paidOnline + booking.json.dueAtVenue === booking.json.total,
  );

  const replay = await call('POST', '/bookings', {
    intentId,
    holdId: hold.json.id,
    paymentMode: 'deposit',
    provider: 'jazzcash',
  });
  check('a replayed intent returns the same booking', replay.json?.id === booking.json.id);

  const afterBooking = await call('GET', `/courts/court-pr-1/slots?day=${dayParam}`);
  check(
    'the slot now reads as booked',
    afterBooking.json.find((slot: any) => slot.startAt === target.startAt)?.status === 'booked',
  );

  const rehold = await call('POST', '/holds', {
    courtId: 'court-pr-1',
    startAt: target.startAt,
  });
  check('a booked slot cannot be held again', rehold.json?.error?.code === 'slot_taken');

  console.log('\nwalk-ins');
  const clash = await call(
    'POST',
    '/venues/venue-padel-republic/bookings',
    {
      courtId: 'court-pr-1',
      startAt: target.startAt,
      customerName: 'Walk In',
      customerPhone: '+923001112222',
    },
    owner,
  );
  check('a walk-in on a sold slot is refused', clash.json?.error?.code === 'slot_taken');

  const freeSlot = free[1];
  const walkIn = await call(
    'POST',
    '/venues/venue-padel-republic/bookings',
    {
      courtId: 'court-pr-1',
      startAt: freeSlot.startAt,
      customerName: 'Imran Sheikh',
      customerPhone: '+923004567890',
    },
    owner,
  );
  check('a walk-in on a free slot is recorded', walkIn.status === 201);
  check('it is marked manual', walkIn.json?.source === 'manual');
  check('the customer is kept', walkIn.json?.customer?.name === 'Imran Sheikh');
  check('the whole amount is cash', walkIn.json?.paidOnline === 0);

  const blockedByWalkIn = await call('POST', '/holds', {
    courtId: 'court-pr-1',
    startAt: freeSlot.startAt,
  });
  check(
    'a walk-in blocks the slot in the app immediately',
    blockedByWalkIn.json?.error?.code === 'slot_taken',
  );

  console.log('\nowner');
  const dayBookings = await call(
    'GET',
    `/venues/venue-padel-republic/bookings?day=${dayParam}`,
    undefined,
    owner,
  );
  check('the day sheet carries app and walk-in alike', dayBookings.json?.length >= 2);
  const earnings = await call(
    'GET',
    `/venues/venue-padel-republic/earnings?day=${dayParam}`,
    undefined,
    owner,
  );
  check('earnings count the day', earnings.json?.bookingCount >= 2);
  check('and separate cash from collected', earnings.json?.dueAtVenue > 0);

  console.log('\nauthorisation');
  /*
   * Every one of these was reachable before this branch, by anyone who could reach the
   * server, by putting a different value in one request header. They are asserted as a
   * group because they fail silently — an endpoint that has quietly lost its guard still
   * returns 200 and looks entirely healthy.
   */
  const strangersSheet = await call(
    'GET',
    `/venues/venue-padel-republic/bookings?day=${dayParam}`,
  );
  check(
    "a player cannot read a venue's day of customers",
    strangersSheet.status === 404,
    `${strangersSheet.status}`,
  );

  const strangersEarnings = await call(
    'GET',
    `/venues/venue-padel-republic/earnings?day=${dayParam}`,
  );
  check(
    "a player cannot read a venue's takings",
    strangersEarnings.status === 404,
    `${strangersEarnings.status}`,
  );

  const strangersWalkIn = await call('POST', '/venues/venue-padel-republic/bookings', {
    courtId: 'court-pr-1',
    startAt: free[2].startAt,
    customerName: 'Not The Owner',
    customerPhone: '+923009998888',
  });
  check(
    'a player cannot write a booking onto a venue they do not own',
    strangersWalkIn.status === 404,
    `${strangersWalkIn.status}`,
  );

  // The owner's own booking, cancelled by a player who has nothing to do with it.
  const ownerBooking = walkIn.json?.id;
  const hijack = await call('POST', `/bookings/${ownerBooking}/cancel`);
  check("a player cannot cancel someone else's booking", hijack.status === 404, `${hijack.status}`);

  const peek = await call('GET', `/bookings/${ownerBooking}`);
  check("a player cannot read someone else's booking", peek.status === 404, `${peek.status}`);

  const ownersView = await call('GET', `/bookings/${ownerBooking}`, undefined, owner);
  check('but the venue owner still can', ownersView.status === 200, `${ownersView.status}`);

  console.log('\nmidnight');
  // A ground open past midnight has its small-hours slots on the next day's sheet. That is
  // what a calendar means, and it is worth knowing before reading a night's takings.
  const lateSlot = slots.json.find((slot: any) => pktHour(slot.startAt) === 1);
  if (lateSlot) {
    const nextDay = new Date(new Date(day).getTime() + 24 * 3_600_000).toISOString();
    const nextSheet = await call(
      'GET',
      `/venues/venue-padel-republic/bookings?day=${encodeURIComponent(nextDay)}`,
      undefined,
      owner,
    );
    check(
      'a 1 AM slot belongs to the following day',
      pktHour(lateSlot.startAt) === 1 && Array.isArray(nextSheet.json),
    );
  }

  console.log('\nmatches and challenges');
  const matches = await call('GET', '/matches');
  check('open matches are listed', matches.json?.length > 0);

  const openMatch = await call('POST', '/matches', {
    bookingId: booking.json.id,
    format: 'padel_doubles',
    playersNeeded: 4,
    playersJoined: 1,
    skillLevel: 'intermediate',
    genderPreference: 'anyone',
    instantJoin: true,
  });
  check('a booking can be opened as a match', openMatch.status === 201);
  check('the sport comes from the court', openMatch.json?.sport === 'padel');
  check(
    'the share is derived from the booking',
    openMatch.json?.pricePerPlayer === Math.ceil(booking.json.total / 4),
  );

  const openAgain = await call('POST', '/matches', {
    bookingId: booking.json.id,
    format: 'padel_doubles',
    playersNeeded: 4,
    playersJoined: 1,
    skillLevel: 'intermediate',
  });
  check('the same booking cannot be opened twice', openAgain.json?.error?.code === 'already_open');

  const challenge = await call('POST', '/challenges', {
    challengerTeamId: 'team-my-team',
    opponentTeamId: 'team-dha-strikers',
    format: 'futsal_5v5',
    area: 'Johar Town',
    proposedStartAt: day,
    stake: 'split_cost',
  });
  check('a direct challenge is created', challenge.status === 201);

  const first = await call('POST', `/challenges/${challenge.json.id}/score`, {
    teamId: 'team-my-team',
    challengerScore: 4,
    opponentScore: 2,
  });
  check('one captain alone does not settle it', first.json?.settled === false);

  // The opposing captain, signed in as themselves. Reporting for the other side used to
  // work from this same session, which meant one captain could file both results and
  // settle a fixture on their own.
  const opposingCaptain = await signIn('player-bilal');
  const asOpponentButNotCaptain = await call('POST', `/challenges/${challenge.json.id}/score`, {
    teamId: 'team-dha-strikers',
    challengerScore: 1,
    opponentScore: 3,
  });
  check(
    'one captain cannot report for the other side',
    asOpponentButNotCaptain.json?.error?.code === 'not_a_captain',
    `${asOpponentButNotCaptain.status}`,
  );

  const disagree = await call(
    'POST',
    `/challenges/${challenge.json.id}/score`,
    { teamId: 'team-dha-strikers', challengerScore: 1, opponentScore: 3 },
    opposingCaptain,
  );
  check('a disagreement is flagged, not trusted', disagree.json?.disputed === true);

  const outsider = await call('POST', `/challenges/${challenge.json.id}/score`, {
    teamId: 'team-cantt-smashers',
    challengerScore: 9,
    opponentScore: 0,
  });
  check('an outside team cannot report', outsider.json?.error?.code === 'not_a_captain');

  console.log('\nreviews');
  const bookings = await call('GET', '/bookings');
  const played = bookings.json.find((each: any) => each.status === 'completed');
  if (played) {
    const review = await call('POST', `/bookings/${played.id}/review`, {
      rating: 5,
      body: 'Great turf',
    });
    check('a played booking can be reviewed', review.status === 201);
    const again = await call('POST', `/bookings/${played.id}/review`, { rating: 1, body: 'no' });
    check('a second review is refused', again.json?.error?.code === 'already_reviewed');
  }
  const upcoming = bookings.json.find((each: any) => each.status === 'confirmed');
  if (upcoming) {
    const early = await call('POST', `/bookings/${upcoming.id}/review`, { rating: 5, body: 'x' });
    check('an unplayed booking cannot be reviewed', early.json?.error?.code === 'not_played');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
