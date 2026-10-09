"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

function CadastroContent() {
  const router = useRouter();
  const {
    signInWithGoogle,
    signUpWithEmail,
    isConfigured,
    user,
    isLoading: isAuthLoading,
  } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Se já estiver logado, redireciona para o dashboard com replace
  useEffect(() => {
    if (user && !isAuthLoading) {
      router.replace("/dashboard");
    }
  }, [user, isAuthLoading, router]);

  if (user && !isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const handleGoogleSignup = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMsg(error);
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name || !email || !password || !confirmPassword) {
      setErrorMsg("Preencha todos os campos para se cadastrar.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("As senhas digitadas não coincidem.");
      return;
    }

    setIsLoading(true);
    const { error } = await signUpWithEmail(email, password, name);
    setIsLoading(false);

    if (error) {
      setErrorMsg(error);
    } else {
      if (isConfigured) {
        setSuccessMsg(
          "Conta criada com sucesso! Verifique seu e-mail para confirmar seu cadastro ou faça login."
        );
      } else {
        router.push("/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Cabeçalho de Identidade */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center group mb-4">
          <BrandLogo size="2xl" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Criar sua conta
        </h2>
        <p className="mt-1.5 text-xs text-slate-500">
          Comece a automatizar suas publicações no Instagram
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-lg shadow-slate-200/50 border border-slate-200/80 rounded-2xl space-y-6">
          {/* Sucesso */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Erro */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* BOTÃO PRINCIPAL: Cadastrar com Google */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold shadow-2xs hover:border-slate-300 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Cadastrar com Google</span>
            </button>
          </div>

          {/* Divisor Visual perfeitamente centralizado vertical e horizontalmente */}
          <div className="relative flex items-center justify-center my-6">
            <div className="flex-1 border-t border-slate-200" />
            <span className="shrink-0 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">
              ou cadastre-se com e-mail
            </span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Formulário com Nome, E-mail, Senha e Confirmar Senha */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nome Completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Endereço de E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold shadow-xs shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Criar Conta</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé do Card */}
          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Já possui uma conta?{" "}
              <Link
                href="/login"
                className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <CadastroContent />
    </Suspense>
  );
}

