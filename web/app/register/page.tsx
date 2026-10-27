import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/client';
export const metadata: Metadata = { title: 'Create account' };
export default function Register() {
  return <main className="mx-auto max-w-md px-4 py-12"><h1 className="mb-6 text-2xl font-bold text-white">Create your account</h1><AuthForm mode="register" /><p className="mt-6 text-sm text-slate-400">Already registered? <Link className="text-ember-400 underline" href="/login">Sign in</Link></p></main>;
}
