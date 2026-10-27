'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-bold text-white">Something went wrong</h1><p className="mt-2 text-slate-400">The page could not be loaded. This is usually temporary.</p><button onClick={reset} className="mt-6 rounded-lg bg-ember-500 px-4 py-2 font-semibold text-ink-950">Try again</button></main>;
}
