import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Compass,
  Footprints,
  Lock,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

type Step = 'splash1' | 'splash2' | 'splash3' | 'signup' | 'login';
type SlideKey = 'splash1' | 'splash2' | 'splash3';

const SLIDES: {
  id: SlideKey;
  shortLabel: string;
  title: string;
  body: string;
  cta: string;
}[] = [
  {
    id: 'splash1',
    shortLabel: 'Campus Map',
    title: 'Navigate UNTAR With Ease',
    body: 'Search campus buildings, offices, and canteens across UNTAR Kampus 1 without asking around.',
    cta: 'Continue',
  },
  {
    id: 'splash2',
    shortLabel: 'Walking Routes',
    title: 'Fast Walking Routes & Floor Guides',
    body: 'Follow clear campus walkways and check rooms per floor before your class or event begins.',
    cta: 'Continue',
  },
  {
    id: 'splash3',
    shortLabel: 'Campus Friends',
    title: 'Find Your People On Your Terms',
    body: 'Share your building with friends using Study Buddy status and Ghost mode.',
    cta: 'Get Started',
  },
];

function SplashVisual({
  slide,
  large = false,
}: {
  slide: SlideKey;
  large?: boolean;
}) {
  const scaleClass = large ? 'scale-110 xl:scale-125' : '';

  if (slide === 'splash1') {
    return (
      <div
        className={`relative mx-auto flex h-[232px] w-[248px] items-center justify-center ${scaleClass}`}
      >
        <div className="absolute h-[214px] w-[214px] rounded-full bg-white/55 lg:bg-white/65" />
        <div className="absolute h-[176px] w-[144px] -rotate-12 rounded-[26px] bg-[#E8F5C8]/85 shadow-soft-sm" />
        <div className="absolute h-[176px] w-[144px] rotate-12 rounded-[26px] bg-[#DCE4FA]/85 shadow-soft-sm" />

        <div className="relative z-10 flex h-[188px] w-[158px] flex-col justify-between overflow-hidden rounded-[26px] bg-gradient-to-br from-[#D7F7EA] via-[#EFFAF5] to-[#FFE8D6] p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <img
              src="/logo.png"
              alt="TitikTemu"
              className="h-9 w-9 object-contain"
            />
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#156A4D]">
              6 Buildings
            </span>
          </div>

          <div className="my-auto grid grid-cols-3 gap-1.5 py-2">
            {['I', 'M', 'P', 'J&L', 'K', 'R'].map((code) => (
              <span
                key={code}
                className="flex h-9 items-center justify-center rounded-xl bg-white/90 text-xs font-bold text-ink shadow-soft-sm"
              >
                {code}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-ink/85 px-2.5 py-1.5 text-white backdrop-blur-sm">
            <div className="leading-tight">
              <p className="text-[11px] font-bold">TitikTemu</p>
              <p className="text-[9px] text-white/75">UNTAR Kampus 1</p>
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink">
              Map
            </span>
          </div>
        </div>

        <span className="absolute right-4 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-soft-sm">
          <Compass size={14} strokeWidth={2.2} />
        </span>
        <span className="absolute bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow-soft-sm">
          <MapPin size={14} strokeWidth={2.2} />
        </span>
      </div>
    );
  }

  if (slide === 'splash2') {
    return (
      <div
        className={`relative mx-auto flex h-[232px] w-[248px] items-center justify-center ${scaleClass}`}
      >
        <div className="absolute h-[214px] w-[214px] rounded-full bg-white/55 lg:bg-white/65" />
        <div className="absolute h-[176px] w-[144px] -rotate-12 rounded-[26px] bg-[#FCE7C8]/85 shadow-soft-sm" />
        <div className="absolute h-[176px] w-[144px] rotate-12 rounded-[26px] bg-[#F5D6EA]/85 shadow-soft-sm" />

        <div className="relative z-10 flex h-[188px] w-[158px] flex-col justify-between overflow-hidden rounded-[26px] bg-white p-3 shadow-soft">
          <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl bg-[#EFF3EC] p-2.5">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-[#DCE6F0] px-2 py-1 text-[10px] font-bold text-ink">
                Gedung M
              </span>
              <span className="rounded-lg bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                L5
              </span>
            </div>

            <svg
              viewBox="0 0 120 44"
              className="my-1 w-full"
              aria-hidden="true"
            >
              <path
                d="M10 36 Q 48 34, 62 20 T 110 10"
                fill="none"
                stroke="#2ED39A"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="1 8"
              />
              <circle cx="10" cy="36" r="4.5" fill="#2ED39A" />
              <circle cx="110" cy="10" r="4.5" fill="#FF8A3D" />
            </svg>

            <div className="flex gap-1">
              {['L1', 'L4', 'L5', 'L8'].map((fl) => (
                <span
                  key={fl}
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    fl === 'L5'
                      ? 'bg-primary text-white'
                      : 'bg-white text-muted'
                  }`}
                >
                  {fl}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-2 rounded-2xl bg-gradient-to-r from-[#2ED39A] to-[#3B82F6] px-2.5 py-2 text-white">
            <p className="flex items-center gap-1 text-[10px] font-bold">
              <Building2 size={11} strokeWidth={2.2} />
              Gedung M, L1–L8
            </p>
            <p className="text-[9px] text-white/85">81 m • 2 min walk</p>
          </div>
        </div>

        <span className="absolute right-4 top-6 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-soft-sm">
          <Footprints size={14} strokeWidth={2.2} />
        </span>
        <span className="absolute bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-soft-sm">
          <Building2 size={14} strokeWidth={2.2} />
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-auto flex h-[232px] w-[248px] items-center justify-center ${scaleClass}`}
    >
      <div className="absolute h-[214px] w-[214px] rounded-full border border-primary/20 bg-white/45" />
      <div className="absolute h-[146px] w-[146px] rounded-full border border-primary/25 bg-white/65" />

      <div className="relative z-10 flex h-[86px] w-[86px] items-center justify-center rounded-full border-4 border-white bg-white shadow-soft">
        <img
          src="/logo.png"
          alt="TitikTemu"
          className="h-14 w-14 object-contain"
        />
      </div>

      <span
        className="absolute left-5 top-8 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-soft-sm"
        style={{ backgroundColor: '#FF8A3D' }}
      >
        N
      </span>
      <span
        className="absolute right-5 top-8 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-soft-sm"
        style={{ backgroundColor: '#3B82F6' }}
      >
        B
      </span>
      <span
        className="absolute bottom-8 left-7 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white text-xs font-bold text-white shadow-soft-sm"
        style={{ backgroundColor: '#8B5CF6' }}
      >
        R
      </span>
      <span
        className="absolute bottom-8 right-7 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white text-xs font-bold text-white shadow-soft-sm"
        style={{ backgroundColor: '#EC4899' }}
      >
        D
      </span>

      <span className="absolute top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-soft-sm">
        <Sparkles size={13} strokeWidth={2.2} />
      </span>
      <span className="absolute bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow-soft-sm">
        <Users size={13} strokeWidth={2.2} />
      </span>
    </div>
  );
}

export function OnboardingFlow() {
  const signUpDemo = useAppStore((s) => s.signUpDemo);
  const logInDemo = useAppStore((s) => s.logInDemo);
  const continueAsVisitor = useAppStore((s) => s.continueAsVisitor);

  const [step, setStep] = useState<Step>('splash1');
  const [desktopShowcaseSlide, setDesktopShowcaseSlide] =
    useState<SlideKey>('splash1');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [forgotNotice, setForgotNotice] = useState(false);

  const isSplash =
    step === 'splash1' || step === 'splash2' || step === 'splash3';
  const activeSlide: SlideKey = isSplash ? step : desktopShowcaseSlide;
  const activeSlideObj =
    SLIDES.find((s) => s.id === activeSlide) ?? SLIDES[0];
  const splashIdx = SLIDES.findIndex((s) => s.id === activeSlide);

  function goToSlide(slide: SlideKey) {
    setDesktopShowcaseSlide(slide);
    if (isSplash) setStep(slide);
  }

  function handleNextSplash() {
    if (step === 'splash1') {
      setStep('splash2');
      setDesktopShowcaseSlide('splash2');
    } else if (step === 'splash2') {
      setStep('splash3');
      setDesktopShowcaseSlide('splash3');
    } else if (step === 'splash3') {
      setStep('signup');
    }
  }

  function handlePrevSplash() {
    if (step === 'splash2') {
      setStep('splash1');
      setDesktopShowcaseSlide('splash1');
    } else if (step === 'splash3') {
      setStep('splash2');
      setDesktopShowcaseSlide('splash2');
    } else if (step === 'signup' || step === 'login') {
      setStep('splash3');
      setDesktopShowcaseSlide('splash3');
    }
  }

  function handleSignUpSubmit(e: React.FormEvent) {
    e.preventDefault();
    signUpDemo({ displayName: fullName, username, email });
  }

  function handleLogInSubmit(e: React.FormEvent) {
    e.preventDefault();
    logInDemo(loginId);
  }

  return (
    <div className="flex min-h-dvh w-screen flex-col bg-white lg:grid lg:h-dvh lg:grid-cols-12 lg:overflow-hidden">
      {/* ================= DESKTOP LEFT HERO SHOWCASE (edge-to-edge web split) ================= */}
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-[#C5F1E1] via-[#DEF7EC] to-[#EFF9F4] p-10 lg:col-span-6 lg:flex xl:col-span-7 xl:p-14">
        {/* Top brand bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="TitikTemu mascot"
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div>
              <p className="text-xl font-bold leading-tight text-ink">
                TitikTemu
              </p>
              <p className="text-xs font-semibold text-[#2E4657]">
                UNTAR Kampus 1 • Campus Navigation
              </p>
            </div>
          </div>
        </div>

        {/* Center interactive illustration + caption */}
        <div className="my-auto flex flex-col items-center py-6 text-center">
          <SplashVisual slide={activeSlide} large />

          <div className="mt-10 max-w-[460px]">
            <h2 className="text-2xl font-bold tracking-tight text-ink xl:text-3xl">
              {activeSlideObj.title}
            </h2>
            <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#3B5263] xl:text-base">
              {activeSlideObj.body}
            </p>
          </div>
        </div>
      </aside>

      {/* ================= RIGHT / MOBILE MAIN INTERACTION COLUMN ================= */}
      <main className="flex min-h-dvh flex-1 flex-col bg-white lg:col-span-6 lg:min-h-0 lg:overflow-y-auto xl:col-span-5">
        {isSplash ? (
          /* ================= 3 SPLASH STEPS (Full-screen on mobile, right column on desktop) ================= */
          <div
            className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-between px-6 pb-8 pt-5 lg:justify-center lg:px-12 lg:py-12"
            style={{
              paddingTop: 'max(20px, env(safe-area-inset-top))',
              paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
            }}
          >
            {/* Top Bar: Back + Skip */}
            <div className="flex items-center justify-between lg:mb-10">
              {step !== 'splash1' ? (
                <button
                  type="button"
                  onClick={handlePrevSplash}
                  aria-label="Previous slide"
                  className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink transition-colors hover:bg-[#F4F8F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ArrowLeft size={19} strokeWidth={2} />
                  <span className="hidden lg:inline">Back</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setStep('login')}
                className="-mr-2 ml-auto min-h-[44px] rounded-full px-3.5 text-sm font-semibold text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Skip
              </button>
            </div>

            {/* Mobile-only center illustration (scales neatly on smaller phone screens) */}
            <div className="my-2 scale-90 sm:my-4 sm:scale-100 lg:hidden">
              <SplashVisual slide={step} />
            </div>

            {/* Copy, Progress Dots & Actions */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <span className="hidden rounded-full bg-mint px-3 py-1 text-xs font-bold text-[#156A4D] lg:inline-flex">
                Step {splashIdx + 1} of 3 • {activeSlideObj.shortLabel}
              </span>

              <h1 className="mt-0 max-w-[300px] text-2xl font-bold leading-tight text-ink lg:mt-4 lg:max-w-none lg:text-4xl">
                {activeSlideObj.title}
              </h1>
              <p className="mt-2.5 max-w-[320px] text-sm font-medium leading-relaxed text-muted lg:mt-3 lg:max-w-none lg:text-base">
                {activeSlideObj.body}
              </p>

              {/* Progress dots */}
              <div
                className="mt-6 flex items-center gap-1.5 lg:mt-8"
                aria-label={`Slide ${splashIdx + 1} of 3`}
              >
                {SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Go to slide ${idx + 1}`}
                    onClick={() => goToSlide(s.id)}
                    className={`h-2 rounded-full transition-all ${
                      idx === splashIdx
                        ? 'w-8 bg-primary'
                        : 'w-2 bg-[#DCE4E1] hover:bg-mint'
                    }`}
                  />
                ))}
              </div>

              {/* Primary CTA */}
              <div className="mt-6 flex w-full flex-col gap-3 lg:mt-8">
                <button
                  type="button"
                  onClick={handleNextSplash}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:text-base"
                >
                  <span>{activeSlideObj.cta}</span>
                  <ArrowRight size={18} strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  onClick={continueAsVisitor}
                  className="hidden min-h-[48px] w-full items-center justify-center rounded-full bg-[#F4F8F6] px-6 text-sm font-bold text-ink transition-colors hover:bg-mint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex"
                >
                  Continue as visitor
                </button>
              </div>

              <p className="mt-5 text-xs font-medium text-muted md:text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="font-bold text-ink underline-offset-2 hover:underline"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        ) : step === 'signup' ? (
          /* ================= SIGN UP ("Create account") ================= */
          <div className="flex flex-1 flex-col bg-[#F6FAF8] lg:justify-center lg:bg-white">
            {/* Mobile mint header */}
            <header
              className="bg-mint px-5 pb-12 pt-5 lg:hidden"
              style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevSplash}
                  aria-label="Back to onboarding"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft-sm"
                >
                  <ArrowLeft size={19} strokeWidth={2} />
                </button>
                <img
                  src="/logo.png"
                  alt="TitikTemu mascot"
                  className="h-11 w-11 object-contain"
                />
              </div>

              <div className="mt-4">
                <h1 className="text-2xl font-bold text-ink">
                  Create account
                </h1>
                <p className="mt-0.5 text-xs font-medium text-[#2E4657]">
                  Navigate UNTAR Kampus 1 &amp; find friends
                </p>
              </div>
            </header>

            <div className="mx-auto -mt-7 flex w-full max-w-[480px] flex-1 flex-col justify-between px-5 pb-7 lg:mt-0 lg:flex-none lg:px-10 lg:py-10">
              {/* Desktop heading */}
              <div className="mb-6 hidden lg:block">
                <button
                  type="button"
                  onClick={handlePrevSplash}
                  className="-ml-2 mb-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink"
                >
                  <ArrowLeft size={17} strokeWidth={2} />
                  <span>Back to overview</span>
                </button>
                <h1 className="text-3xl font-bold text-ink">Create account</h1>
                <p className="mt-1 text-sm font-medium text-muted">
                  Navigate UNTAR Kampus 1 &amp; connect with campus friends
                </p>
              </div>

              <form
                onSubmit={handleSignUpSubmit}
                className="flex flex-col gap-3.5 rounded-card bg-white p-5 shadow-soft lg:rounded-none lg:p-0 lg:shadow-none"
              >
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="mb-1 block text-xs font-bold text-ink"
                    >
                      Full name
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Pratama"
                      className="min-h-[46px] w-full rounded-button bg-[#F4F8F6] px-3.5 text-sm font-medium text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-username"
                      className="mb-1 block text-xs font-bold text-ink"
                    >
                      Username
                    </label>
                    <input
                      id="signup-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@alex.untar"
                      className="min-h-[46px] w-full rounded-button bg-[#F4F8F6] px-3.5 text-sm font-medium text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-email"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    Campus email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@stu.untar.ac.id"
                    className="min-h-[46px] w-full rounded-button bg-[#F4F8F6] px-3.5 text-sm font-medium text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-password"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="min-h-[46px] w-full rounded-button bg-[#F4F8F6] px-3.5 text-sm font-medium text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex items-start gap-2 pt-0.5 text-xs font-medium text-muted">
                  <Lock
                    size={14}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0 text-[#156A4D]"
                  />
                  <span>
                    Location sharing is off by default. You stay in control.
                  </span>
                </div>

                <button
                  type="submit"
                  className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-button bg-primary px-4 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Create account
                </button>
              </form>

              <p className="mt-5 text-center text-xs font-medium text-muted md:text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="font-bold text-[#156A4D] hover:underline"
                >
                  Log in
                </button>
              </p>
            </div>
          </div>
        ) : (
          /* ================= LOG IN ("Welcome back") ================= */
          <div className="flex flex-1 flex-col bg-[#F6FAF8] lg:justify-center lg:bg-white">
            {/* Mobile mint header */}
            <header
              className="bg-mint px-5 pb-12 pt-5 lg:hidden"
              style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevSplash}
                  aria-label="Back to onboarding"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft-sm"
                >
                  <ArrowLeft size={19} strokeWidth={2} />
                </button>
                <img
                  src="/logo.png"
                  alt="TitikTemu mascot"
                  className="h-11 w-11 object-contain"
                />
              </div>

              <div className="mt-4">
                <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
                <p className="mt-0.5 text-xs font-medium text-[#2E4657]">
                  Log in to explore campus &amp; see friends
                </p>
              </div>
            </header>

            <div className="mx-auto -mt-7 flex w-full max-w-[480px] flex-1 flex-col justify-between px-5 pb-7 lg:mt-0 lg:flex-none lg:px-10 lg:py-10">
              {/* Desktop heading */}
              <div className="mb-6 hidden lg:block">
                <button
                  type="button"
                  onClick={handlePrevSplash}
                  className="-ml-2 mb-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink"
                >
                  <ArrowLeft size={17} strokeWidth={2} />
                  <span>Back to overview</span>
                </button>
                <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
                <p className="mt-1 text-sm font-medium text-muted">
                  Log in to explore UNTAR Kampus 1 &amp; see campus friends
                </p>
              </div>

              <form
                onSubmit={handleLogInSubmit}
                className="flex flex-col gap-3.5 rounded-card bg-white p-5 shadow-soft lg:rounded-none lg:p-0 lg:shadow-none"
              >
                <div>
                  <label
                    htmlFor="login-id"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    Email or username
                  </label>
                  <input
                    id="login-id"
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="@alex.untar"
                    className="min-h-[46px] w-full rounded-button bg-[#F4F8F6] px-3.5 text-sm font-medium text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="min-h-[46px] w-full rounded-button bg-[#F4F8F6] px-3.5 text-sm font-medium text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setForgotNotice(true)}
                      className="text-xs font-semibold text-[#156A4D] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  {forgotNotice && (
                    <p className="mt-1 rounded-xl bg-[#F4F8F6] px-3 py-2 text-xs font-medium text-muted">
                      Demo mode — enter any username or tap Log in to preview
                      the app.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="flex min-h-[48px] w-full items-center justify-center rounded-button bg-primary px-4 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Log in
                </button>

                <div className="flex items-center gap-3 py-0.5">
                  <span className="h-px flex-1 bg-[#EEF1F0]" />
                  <span className="text-xs font-medium text-muted">or</span>
                  <span className="h-px flex-1 bg-[#EEF1F0]" />
                </div>

                <button
                  type="button"
                  onClick={continueAsVisitor}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-button bg-[#F4F8F6] px-4 text-sm font-bold text-ink transition-colors hover:bg-mint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Continue as visitor
                </button>
              </form>

              <p className="mt-5 text-center text-xs font-medium text-muted md:text-sm">
                New to UNTAR?{' '}
                <button
                  type="button"
                  onClick={() => setStep('signup')}
                  className="font-bold text-[#156A4D] hover:underline"
                >
                  Create account
                </button>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
