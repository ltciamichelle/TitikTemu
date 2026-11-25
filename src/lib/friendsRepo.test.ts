import { describe, expect, it } from 'vitest';
import {
  applyAutoStop,
  DEMO_SHARE_DURATION_MS,
  getShareDurationMs,
  isVisibleOnMap,
  MockFriendsRepo,
  MY_USER_ID,
  SHARE_DURATION_MS,
  type VisibleFriendInput,
} from './friendsRepo';
import type { Presence } from '../types';

const NOW = 1_700_000_000_000;

function makeVisibleFriend(
  overrides: Partial<{
    friendshipStatus: 'pending' | 'accepted';
    shareOn: boolean;
    ghost: boolean;
    expiresAt: number | null;
    buildingId: string | null;
    visibleToMe: boolean;
  }> = {}
): VisibleFriendInput {
  return {
    friendship: {
      status: overrides.friendshipStatus ?? 'accepted',
    },
    presence: {
      shareOn: overrides.shareOn ?? true,
      ghost: overrides.ghost ?? false,
      expiresAt:
        overrides.expiresAt !== undefined
          ? overrides.expiresAt
          : NOW + SHARE_DURATION_MS,
      buildingId:
        overrides.buildingId !== undefined
          ? overrides.buildingId
          : 'b518483241',
    },
    visibleToMe: overrides.visibleToMe ?? true,
  };
}

describe('Friends privacy rules (isVisibleOnMap)', () => {
  it('returns true only when ALL privacy conditions are satisfied', () => {
    expect(isVisibleOnMap(makeVisibleFriend(), NOW)).toBe(true);
  });

  it('returns false when shareOn is false', () => {
    expect(isVisibleOnMap(makeVisibleFriend({ shareOn: false }), NOW)).toBe(
      false
    );
  });

  it('returns false when ghost mode is on', () => {
    expect(isVisibleOnMap(makeVisibleFriend({ ghost: true }), NOW)).toBe(false);
  });

  it('returns false when presence has expired', () => {
    expect(
      isVisibleOnMap(makeVisibleFriend({ expiresAt: NOW - 1000 }), NOW)
    ).toBe(false);
    expect(isVisibleOnMap(makeVisibleFriend({ expiresAt: NOW }), NOW)).toBe(
      false
    );
    expect(isVisibleOnMap(makeVisibleFriend({ expiresAt: null }), NOW)).toBe(
      false
    );
  });

  it('returns false when friendship is not accepted (pending)', () => {
    expect(
      isVisibleOnMap(
        makeVisibleFriend({ friendshipStatus: 'pending' }),
        NOW
      )
    ).toBe(false);
  });

  it('returns false when switched off by me in my friends list', () => {
    expect(
      isVisibleOnMap(makeVisibleFriend({ visibleToMe: false }), NOW)
    ).toBe(false);
  });
});

describe('Auto-stop expiration', () => {
  it('turns sharing off automatically when expiresAt has passed', () => {
    const activePresence: Presence = {
      userId: MY_USER_ID,
      buildingId: 'b518483241',
      status: 'study_buddy',
      shareOn: true,
      ghost: false,
      updatedAt: NOW,
      expiresAt: NOW + DEMO_SHARE_DURATION_MS,
    };

    // Before expiry: stays on
    const before = applyAutoStop(activePresence, NOW + 30_000);
    expect(before.stopped).toBe(false);
    expect(before.presence.shareOn).toBe(true);

    // At/after expiry: switches off
    const after = applyAutoStop(activePresence, NOW + DEMO_SHARE_DURATION_MS);
    expect(after.stopped).toBe(true);
    expect(after.presence.shareOn).toBe(false);
    expect(after.presence.expiresAt).toBeNull();
  });

  it('uses 2 hours normally and 60 seconds in demo mode', () => {
    expect(getShareDurationMs(false)).toBe(2 * 60 * 60 * 1000);
    expect(getShareDurationMs(true)).toBe(60 * 1000);
  });
});

describe('Building-level only presence (no exact coordinates)', () => {
  const FORBIDDEN_COORD_KEYS = [
    'lat',
    'lng',
    'lon',
    'latitude',
    'longitude',
    'coord',
    'coords',
    'coordinates',
    'gps',
  ];

  it('never stores exact coordinates in any presence object', () => {
    const repo = new MockFriendsRepo(NOW);
    const friends = repo.getFriends();
    const myPresence = repo.getPresence(MY_USER_ID);

    const allPresences: Presence[] = [
      ...friends.map((f) => f.presence),
      ...(myPresence ? [myPresence] : []),
    ];

    expect(allPresences.length).toBeGreaterThan(0);

    for (const p of allPresences) {
      const keys = Object.keys(p).map((k) => k.toLowerCase());
      for (const forbidden of FORBIDDEN_COORD_KEYS) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it('defaults my sharing to OFF and resets everything on clearMyData()', () => {
    const repo = new MockFriendsRepo(NOW);
    expect(repo.getPresence(MY_USER_ID)?.shareOn).toBe(false);

    repo.setMyPresence({
      shareOn: true,
      ghost: true,
      status: 'lunch_buddy',
      buildingId: 'b518483240',
      expiresAt: NOW + SHARE_DURATION_MS,
    });
    expect(repo.getPresence(MY_USER_ID)?.shareOn).toBe(true);

    const cleared = repo.clearMyData();
    expect(cleared.shareOn).toBe(false);
    expect(cleared.ghost).toBe(false);
    expect(cleared.status).toBeNull();
    expect(cleared.buildingId).toBeNull();
    expect(cleared.expiresAt).toBeNull();
  });
});
