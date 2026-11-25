import { Layout } from './components/Layout';
import { OnboardingFlow } from './components/OnboardingFlow';
import { useAppStore } from './store/useAppStore';

export function App() {
  const authUser = useAppStore((s) => s.authUser);

  if (!authUser) {
    return <OnboardingFlow />;
  }

  return <Layout />;
}

export default App;
