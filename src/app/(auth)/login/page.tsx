"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/actions/auth";
import type { FormState } from "@/actions/auth";

const initialState: FormState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">딸깍 쓰레드</h1>
          <p className="text-slate-400">Threads 소통형 자동화 서비스</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">로그인</h2>

          {state.message && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {state.message}
            </div>
          )}

          <form action={action} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                이메일
              </label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
              {state.errors?.email && (
                <p className="mt-1 text-xs text-red-400">
                  {state.errors.email[0]}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                name="password"
                placeholder="비밀번호 입력"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
              {state.errors?.password && (
                <p className="mt-1 text-xs text-red-400">
                  {state.errors.password[0]}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {pending ? "로그인 중…" : "로그인"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-purple-400 hover:text-purple-300 font-medium">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
