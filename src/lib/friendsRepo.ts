import type {
  Building,
  FriendRecord,
  Friendship,
  FriendStatus,
  LngLat,
  PendingRequestRecord,
  Presence,
  SendRequestResult,
  User,
} from '../types';
import { distanceMeters } from './routing';

export const MY_USER_ID = 'me';

/** Default auto-stop window: 2 hours. */
export const SHARE_DURATION_MS = 2 * 60 * 60 * 1000;

/** Demo-mode (?demo=1) auto-stop window: 60 seconds. */
export const DEMO_SHARE_DURATION_MS = 60 * 1000;

/** Nearest-building detection threshold (meters). */
export const NEAREST_BUILDING_RADIUS_M = 60;

const LS_PRESENCE_KEY = 'titiktemu_my_presence_v1';
const LS_CONSENT_KEY = 'titiktemu_share_consent_v1';

export const STATUS_CHIP_LABELS: Record<Exclude<FriendStatus, null>, string> = {
  study_buddy: 'Study Buddy',
  lunch_buddy: 'Lunch Buddy',
  in_class: 'In class',
};

export const STATUS_BUBBLE_LABELS: Record<
  Exclude<FriendStatus, null>,
  string
> = {
  study_buddy: 'Study Buddy?',
  lunch_buddy: 'Lunch Buddy?',
  in_class: 'In class',
};

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

export function getShareDurationMs(demo = isDemoMode()): number {
  return demo ? DEMO_SHARE_DURATION_MS : SHARE_DURATION_MS;
}

export interface VisibleFriendInput {
  friendship: Pick<Friendship, 'status'>;
  presence: Pick<Presence, 'shareOn' | 'ghost' | 'expiresAt' | 'buildingId'>;
  visibleToMe: boolean;
}

/**
 * Single source of truth for map visibility privacy rules.
 * A friend appears on the map ONLY if ALL conditions hold:
 * 1. Friendship is accepted
 * 2. Their shareOn is true
 * 3. Their ghost mode is false
 * 4. Their presence has not expired
 * 5. I switched them on in my list
 * 6. They have a building-level location (never raw GPS)
 */
export function isVisibleOnMap(
  friend: VisibleFriendInput,
  now = Date.now()
): boolean {
  if (friend.friendship.status !== 'accepted') return false;
  if (!friend.presence.shareOn) return false;
  if (friend.presence.ghost) return false;
  if (friend.presence.expiresAt === null || friend.presence.expiresAt <= now) {
    return false;
  }
  if (!friend.visibleToMe) return false;
  if (!friend.presence.buildingId) return false;
  return true;
}

/**
 * Enforce auto-stop when expiresAt has elapsed.
 */
export function applyAutoStop(
  presence: Presence,
  now = Date.now()
): { presence: Presence; stopped: boolean } {
  if (
    presence.shareOn &&
    presence.expiresAt !== null &&
    presence.expiresAt <= now
  ) {
    return {
      presence: {
        ...presence,
        shareOn: false,
        expiresAt: null,
        updatedAt: now,
      },
      stopped: true,
    };
  }
  return { presence, stopped: false };
}

/**
 * Resolve building-level location: nearest building within 60 m, otherwise null ("On campus").
 * Never stores or returns exact coordinates.
 */
export function detectNearestBuildingId(
  pos: LngLat,
  buildings: Building[],
  maxDistanceM = NEAREST_BUILDING_RADIUS_M
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const b of buildings) {
    const dCentroid = distanceMeters(pos, b.centroid);
    const dEntrance = distanceMeters(pos, b.entrance);
    const d = Math.min(dCentroid, dEntrance);
    if (d < bestDist) {
      bestDist = d;
      bestId = b.id;
    }
  }

  return bestDist <= maxDistanceM ? bestId : null;
}

/**
 * Repository interface so Supabase can replace MockFriendsRepo later
 * without changing any UI component.
 */
export interface FriendsRepo {
  getFriends(): FriendRecord[];
  getPending(): PendingRequestRecord[];
  sendRequest(username: string): SendRequestResult;
  acceptRequest(userId: string): FriendRecord | null;
  getPresence(userId: string): Presence | null;
  setMyPresence(partial: Partial<Omit<Presence, 'userId'>>): Presence;
  clearMyData(): Presence;
  moveDemoFriend?(buildingIds: string[]): FriendRecord | null;
}

function readLocalStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function removeLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export function loadShareConsent(): boolean {
  return readLocalStorage<boolean>(LS_CONSENT_KEY) === true;
}

export function saveShareConsent(consented: boolean): void {
  writeLocalStorage(LS_CONSENT_KEY, consented);
}

function createDefaultMyPresence(now = Date.now()): Presence {
  return {
    userId: MY_USER_ID,
    buildingId: null,
    status: null,
    shareOn: false,
    ghost: false,
    updatedAt: now,
    expiresAt: null,
  };
}

/**
 * In-memory mock implementation of FriendsRepo with clearly labeled demo users.
 * Only saves the current user's own share/ghost/status settings to localStorage.
 */
export class MockFriendsRepo implements FriendsRepo {
  private users: Map<string, User>;
  private friendships: Friendship[];
  private presences: Map<string, Presence>;
  private demoMoveIndex = 0;

  constructor(now = Date.now()) {
    const seededUsers: User[] = [
      {
        id: 'u_nina',
        username: 'nina.w',
        displayName: 'Nina Wijaya',
        avatarColor: '#FF8A3D',
      },
      {
        id: 'u_budi',
        username: 'budi.s',
        displayName: 'Budi Santoso',
        avatarColor: '#3B82F6',
      },
      {
        id: 'u_raro',
        username: 'raro.p',
        displayName: 'Raro Putri',
        avatarColor: '#8B5CF6',
      },
      {
        id: 'u_dewi',
        username: 'dewi.l',
        displayName: 'Dewi Lestari',
        avatarColor: '#EC4899',
      },
      {
        id: 'u_kevin',
        username: 'kevin.h',
        displayName: 'Kevin Halim',
        avatarColor: '#14B8A6',
      },
      {
        id: 'u_maya',
        username: 'maya.t',
        displayName: 'Maya Tanuwijaya',
        avatarColor: '#F59E0B',
      },
    ];

    this.users = new Map(seededUsers.map((u) => [u.id, u]));

    this.friendships = [
      { userA: MY_USER_ID, userB: 'u_nina', status: 'accepted' },
      { userA: MY_USER_ID, userB: 'u_budi', status: 'accepted' },
      { userA: MY_USER_ID, userB: 'u_raro', status: 'accepted' },
      { userA: 'u_dewi', userB: MY_USER_ID, status: 'pending' },
    ];

    const futureExpiry = now + SHARE_DURATION_MS;

    this.presences = new Map<string, Presence>([
      [
        'u_nina',
        {
          userId: 'u_nina',
          buildingId: 'b518483241', // Gedung M
          status: 'study_buddy',
          shareOn: true,
          ghost: false,
          updatedAt: now - 5 * 60 * 1000,
          expiresAt: futureExpiry,
        },
      ],
      [
        'u_budi',
        {
          userId: 'u_budi',
          buildingId: 'b518483240', // Gedung P
          status: 'lunch_buddy',
          shareOn: true,
          ghost: false,
          updatedAt: now - 3 * 60 * 1000,
          expiresAt: futureExpiry,
        },
      ],
      [
        'u_raro',
        {
          userId: 'u_raro',
          buildingId: 'b518483239', // Gedung J dan L
          status: 'in_class',
          shareOn: false,
          ghost: false,
          updatedAt: now - 12 * 60 * 1000,
          expiresAt: null,
        },
      ],
      [
        'u_dewi',
        {
          userId: 'u_dewi',
          buildingId: 'b518483242', // Gedung I
          status: 'study_buddy',
          shareOn: true,
          ghost: false,
          updatedAt: now - 4 * 60 * 1000,
          expiresAt: futureExpiry,
        },
      ],
      [
        'u_kevin',
        {
          userId: 'u_kevin',
          buildingId: 'b518483236', // Gedung K
          status: 'study_buddy',
          shareOn: true,
          ghost: false,
          updatedAt: now - 10 * 60 * 1000,
          expiresAt: futureExpiry,
        },
      ],
      [
        'u_maya',
        {
          userId: 'u_maya',
          buildingId: 'b518483234', // Gedung R
          status: 'in_class',
          shareOn: false,
          ghost: false,
          updatedAt: now - 20 * 60 * 1000,
          expiresAt: null,
        },
      ],
    ]);

    // Load saved settings for "me" from localStorage only
    const saved = readLocalStorage<Partial<Presence>>(LS_PRESENCE_KEY);
    const initialMe: Presence = {
      ...createDefaultMyPresence(now),
      ...(saved
        ? {
            shareOn: Boolean(saved.shareOn),
            ghost: Boolean(saved.ghost),
            status: saved.status ?? null,
            buildingId: saved.buildingId ?? null,
            expiresAt: saved.expiresAt ?? null,
            updatedAt: saved.updatedAt ?? now,
          }
        : {}),
    };
    const checked = applyAutoStop(initialMe, now);
    this.presences.set(MY_USER_ID, checked.presence);
  }

  getFriends(): FriendRecord[] {
    const records: FriendRecord[] = [];
    for (const f of this.friendships) {
      if (f.status !== 'accepted') continue;
      const otherId = f.userA === MY_USER_ID ? f.userB : f.userA;
      const user = this.users.get(otherId);
      const presence = this.presences.get(otherId);
      if (user && presence) {
        records.push({
          user,
          friendship: { ...f },
          presence: { ...presence },
        });
      }
    }
    return records;
  }

  getPending(): PendingRequestRecord[] {
    const pending: PendingRequestRecord[] = [];
    for (const f of this.friendships) {
      if (f.status !== 'pending') continue;
      const isIncoming = f.userB === MY_USER_ID;
      const otherId = isIncoming ? f.userA : f.userB;
      const user = this.users.get(otherId);
      if (user) {
        pending.push({
          user,
          friendship: { ...f },
          direction: isIncoming ? 'incoming' : 'outgoing',
        });
      }
    }
    return pending;
  }

  sendRequest(rawUsername: string): SendRequestResult {
    const cleaned = rawUsername.trim().replace(/^@+/, '').toLowerCase();
    if (!cleaned) {
      return { ok: false, reason: 'not_found', message: 'No user found' };
    }

    let foundUser: User | undefined;
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === cleaned) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      return { ok: false, reason: 'not_found', message: 'No user found' };
    }

    const existing = this.friendships.find(
      (f) =>
        (f.userA === MY_USER_ID && f.userB === foundUser!.id) ||
        (f.userB === MY_USER_ID && f.userA === foundUser!.id)
    );

    if (existing) {
      if (existing.status === 'accepted') {
        return {
          ok: false,
          reason: 'already_friends',
          message: `Already friends with @${foundUser.username}`,
        };
      }
      return {
        ok: false,
        reason: 'already_pending',
        message: `Request already pending for @${foundUser.username}`,
      };
    }

    this.friendships.push({
      userA: MY_USER_ID,
      userB: foundUser.id,
      status: 'pending',
    });

    return {
      ok: true,
      user: foundUser,
      message: `Request sent to @${foundUser.username}`,
    };
  }

  acceptRequest(userId: string): FriendRecord | null {
    const f = this.friendships.find(
      (item) =>
        item.status === 'pending' &&
        item.userA === userId &&
        item.userB === MY_USER_ID
    );
    if (!f) return null;

    f.status = 'accepted';
    const user = this.users.get(userId);
    const presence = this.presences.get(userId);
    if (!user || !presence) return null;

    return {
      user,
      friendship: { ...f },
      presence: { ...presence },
    };
  }

  getPresence(userId: string): Presence | null {
    const p = this.presences.get(userId);
    return p ? { ...p } : null;
  }

  setMyPresence(partial: Partial<Omit<Presence, 'userId'>>): Presence {
    const current = this.presences.get(MY_USER_ID) ?? createDefaultMyPresence();
    const updated: Presence = {
      userId: MY_USER_ID,
      buildingId:
        partial.buildingId !== undefined
          ? partial.buildingId
          : current.buildingId,
      status: partial.status !== undefined ? partial.status : current.status,
      shareOn:
        partial.shareOn !== undefined ? partial.shareOn : current.shareOn,
      ghost: partial.ghost !== undefined ? partial.ghost : current.ghost,
      updatedAt: partial.updatedAt ?? Date.now(),
      expiresAt:
        partial.expiresAt !== undefined ? partial.expiresAt : current.expiresAt,
    };

    this.presences.set(MY_USER_ID, updated);
    writeLocalStorage(LS_PRESENCE_KEY, {
      shareOn: updated.shareOn,
      ghost: updated.ghost,
      status: updated.status,
      buildingId: updated.buildingId,
      expiresAt: updated.expiresAt,
      updatedAt: updated.updatedAt,
    });
    return { ...updated };
  }

  clearMyData(): Presence {
    const cleared = createDefaultMyPresence(Date.now());
    this.presences.set(MY_USER_ID, cleared);
    removeLocalStorage(LS_PRESENCE_KEY);
    return { ...cleared };
  }

  /**
   * Demo helper (?demo=1): rotates one visible friend to a different building.
   */
  moveDemoFriend(buildingIds: string[]): FriendRecord | null {
    if (buildingIds.length < 2) return null;
    const activeFriends = this.getFriends().filter(
      (f) => f.presence.shareOn && !f.presence.ghost
    );
    if (activeFriends.length === 0) return null;

    const target = activeFriends[this.demoMoveIndex % activeFriends.length];
    this.demoMoveIndex += 1;

    const currentIdx = buildingIds.indexOf(target.presence.buildingId ?? '');
    const nextBuildingId = buildingIds[(currentIdx + 1) % buildingIds.length];

    const updatedPresence: Presence = {
      ...target.presence,
      buildingId: nextBuildingId,
      updatedAt: Date.now(),
    };
    this.presences.set(target.user.id, updatedPresence);

    return {
      ...target,
      presence: { ...updatedPresence },
    };
  }
}

export const friendsRepo: FriendsRepo = new MockFriendsRepo();
