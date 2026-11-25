export interface DemoAuthUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  isVisitor: boolean;
}

export interface AuthRepo {
  getCurrentUser(): DemoAuthUser | null;
  signUp(input: {
    displayName: string;
    username: string;
    email: string;
  }): DemoAuthUser;
  logIn(identifier: string): DemoAuthUser;
  continueAsVisitor(): DemoAuthUser;
  signOut(): void;
}

const LS_AUTH_KEY = 'titiktemu_demo_auth_v1';

function readStoredUser(): DemoAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_AUTH_KEY);
    return raw ? (JSON.parse(raw) as DemoAuthUser) : null;
  } catch {
    return null;
  }
}

function saveStoredUser(user: DemoAuthUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(LS_AUTH_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(LS_AUTH_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * In-memory + localStorage dummy auth repository.
 * Replace with Supabase Auth when the database is ready.
 */
class MockAuthRepo implements AuthRepo {
  private currentUser: DemoAuthUser | null = readStoredUser();

  getCurrentUser(): DemoAuthUser | null {
    return this.currentUser;
  }

  signUp(input: {
    displayName: string;
    username: string;
    email: string;
  }): DemoAuthUser {
    const cleanName = input.displayName.trim() || 'Alex Pratama';
    const cleanUsername =
      input.username.trim().replace(/^@+/, '') || 'alex.untar';
    const cleanEmail = input.email.trim() || `${cleanUsername}@stu.untar.ac.id`;

    const user: DemoAuthUser = {
      id: `demo_${Date.now()}`,
      displayName: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      isVisitor: false,
    };
    this.currentUser = user;
    saveStoredUser(user);
    return user;
  }

  logIn(identifier: string): DemoAuthUser {
    const cleaned = identifier.trim().replace(/^@+/, '') || 'alex.untar';
    const baseName = cleaned.includes('@') ? cleaned.split('@')[0] : cleaned;
    const prettyName = baseName
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    const user: DemoAuthUser = {
      id: `demo_${Date.now()}`,
      displayName: prettyName || 'Alex Pratama',
      username: baseName || 'alex.untar',
      email: cleaned.includes('@') ? cleaned : `${baseName}@stu.untar.ac.id`,
      isVisitor: false,
    };
    this.currentUser = user;
    saveStoredUser(user);
    return user;
  }

  continueAsVisitor(): DemoAuthUser {
    const user: DemoAuthUser = {
      id: 'demo_visitor',
      displayName: 'Campus Visitor',
      username: 'visitor',
      email: '',
      isVisitor: true,
    };
    this.currentUser = user;
    saveStoredUser(user);
    return user;
  }

  signOut(): void {
    this.currentUser = null;
    saveStoredUser(null);
  }
}

export const authRepo: AuthRepo = new MockAuthRepo();
