import Link from 'next/link';
export default function NotFound() {
  return <main className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-bold text-white">Page not found</h1><p className="mt-2 text-slate-400">That page or match doesn’t exist, or it isn’t yours.</p><Link href="/" className="mt-6 inline-block rounded-lg bg-ember-500 px-4 py-2 font-semibold text-ink-950">Go home</Link></main>;
}
