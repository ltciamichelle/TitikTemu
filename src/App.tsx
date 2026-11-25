import { lazy, Suspense, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { OnboardingFlow } from './components/OnboardingFlow';
import { useAppStore } from './store/useAppStore';

// Vite statically replaces `import.meta.env.VITE_ENABLE_ADMIN === 'true'` at build time.
// When false (default / public deploy), AdminLite is completely dead-code-eliminated
// and NEVER included in the public production bundle.
const AdminLite =
  import.meta.env.VITE_ENABLE_ADMIN === 'true'
    ? lazy(() => import('./components/admin/AdminLite'))
    : null;

function isAdminHash(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hash === '#/admin' || window.location.hash.startsWith('#/admin?');
}

export function App() {
  const authUser = useAppStore((s) => s.authUser);
  const [adminRoute, setAdminRoute] = useState<boolean>(
    () => Boolean(AdminLite) && isAdminHash()
  );

  useEffect(() => {
    if (!AdminLite) return;
    const onHashChange = () => setAdminRoute(isAdminHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (AdminLite && adminRoute) {
    return (
      <Suspense
        fallback={
          <div className="flex h-dvh w-screen items-center justify-center bg-[#F5FAF8] text-sm font-semibold text-muted">
            Loading local admin…
          </div>
        }
      >
        <AdminLite />
      </Suspense>
    );
  }

  if (!authUser) {
    return <OnboardingFlow />;
  }

  return <Layout />;
}

export default App;
