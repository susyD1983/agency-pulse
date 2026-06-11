export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-24 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Agency Pulse
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          The COO dashboard for modern agencies.
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          We&apos;re early — building in the open. Check back soon.
        </p>
        <p className="pt-12 text-xs text-zinc-400 dark:text-zinc-600">
          Placeholder landing page. Source on GitHub.
        </p>
      </div>
    </main>
  );
}
