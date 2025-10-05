import MathBuddyClient from '@/components/math-buddy-client';

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#f5e8ff] via-[#fef3ff] to-[#e6f7ff] px-4 py-12 sm:px-8">
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#ff6fb7]/40 blur-3xl sm:h-80 sm:w-80" />
      <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#7b61ff]/40 blur-3xl sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#4adede]/35 blur-3xl sm:h-[26rem] sm:w-[26rem]" />
      <div className="relative z-10 flex w-full items-center justify-center">
        <MathBuddyClient />
      </div>
    </main>
  );
}
