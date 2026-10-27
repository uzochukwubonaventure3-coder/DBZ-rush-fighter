import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/client';
export const metadata: Metadata = { title: 'Sign in' };
export default function Login() {
  return <main className="mx-auto max-w-md px-4 py-12"><h1 className="mb-6 text-2xl font-bold text-white">Sign in</h1><AuthForm mode="login" /><p className="mt-6 text-sm text-slate-400">New here? <Link className="text-ember-400 underline" href="/register">Create an account</Link></p></main>;
}
