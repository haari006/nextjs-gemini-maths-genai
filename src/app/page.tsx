import MathBuddyClient from '@/components/math-buddy-client';

export default function Home() {
  return (
    <main className="min-h-screen w-full p-6 flex items-center justify-center bg-gradient-to-b from-[#FFF7F0] via-[#F0FBFF] to-[#FFF7F5]">
      <MathBuddyClient />
    </main>
  );
}
