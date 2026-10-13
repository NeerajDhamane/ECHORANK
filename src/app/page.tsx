export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-24">
      <p className="mb-6 font-display text-sm font-semibold uppercase tracking-[0.22em] text-[var(--signal)]">
        EchoRank
      </p>
      <h1 className="max-w-3xl font-display text-5xl font-semibold leading-tight sm:text-6xl">
        Does AI recommend your brand?
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-muted)]">
        Track how AI platforms describe your brand, compare visibility over time,
        and see the sources behind each answer.
      </p>
      <p className="mt-10 text-sm text-[var(--text-muted)]">
        Project scaffold · tracking setup is coming next.
      </p>
    </main>
  );
}
