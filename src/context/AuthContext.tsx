"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { UserProfile, UserRole } from "@/types";

interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  role: UserRole;
  isAdmin: boolean;
  isDeveloper: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAllowedEmail: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(supabase: ReturnType<typeof createClient>, authUser: User): Promise<UserProfile> {
  const email = authUser.email || "";
  const metadata = authUser.user_metadata || {};
  let userRole: UserRole = "user";

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (profile?.role && (profile.role === "admin" || profile.role === "developer" || profile.role === "user")) {
      userRole = profile.role as UserRole;
    } else if (adminEmails.includes(email.toLowerCase())) {
      userRole = "admin";
      void supabase.from("profiles").upsert({ id: authUser.id, email, role: "admin" });
    }
  } catch {
    if (adminEmails.includes(email.toLowerCase())) {
      userRole = "admin";
    }
  }

  return {
    id: authUser.id,
    email,
    name: metadata.full_name || metadata.name || email.split("@")[0],
    avatarUrl: metadata.avatar_url || metadata.picture,
    role: userRole,
    createdAt: authUser.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured());

  const isConfigured = useMemo(() => isSupabaseConfigured(), []);

  // Lista de e-mails permitidos definida via variável de ambiente pública
  const allowedEmailsList = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_ALLOWED_EMAILS || "";
    return raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }, []);

  const isAllowedEmail = useCallback(
    (email: string): boolean => {
      if (allowedEmailsList.length === 0) return true; // Se vazia, permite todos
      return allowedEmailsList.includes(email.trim().toLowerCase());
    },
    [allowedEmailsList]
  );

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const supabase = createClient();

    // Busca sessão inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setSupabaseUser(session.user);
        const email = session.user.email || "";

        if (!isAllowedEmail(email)) {
          supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setSupabaseUser(null);
          router.replace("/login?error=unauthorized");
          setIsLoading(false);
          return;
        }

        const profile = await fetchUserProfile(supabase, session.user);
        setUser(profile);
      }
      setIsLoading(false);
    });

    // Escuta mudanças no estado de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        setSupabaseUser(session.user);
        const email = session.user.email || "";

        if (!isAllowedEmail(email)) {
          supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setSupabaseUser(null);
          router.replace("/login?error=unauthorized");
          return;
        }

        const profile = await fetchUserProfile(supabase, session.user);
        setUser(profile);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, isAllowedEmail, router]);

  // Login com Google OAuth
  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (!isConfigured) {
      return {
        error: "Supabase não configurado. Adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local",
      };
    }

    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: (err as Error).message || "Falha ao conectar com o Google." };
    }
  };

  // Login com E-mail e Senha
  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    if (!isAllowedEmail(email)) {
      return {
        error: "Este e-mail não possui acesso ao sistema.",
      };
    }

    if (!isConfigured) {
      return {
        error: "Supabase não configurado. Adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local",
      };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user && !isAllowedEmail(data.user.email || "")) {
        await supabase.auth.signOut();
        return {
          error: "Este e-mail não possui acesso ao sistema.",
        };
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: (err as Error).message || "Falha ao autenticar com e-mail e senha." };
    }
  };

  // Cadastro com E-mail e Senha
  const signUpWithEmail = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ error: string | null }> => {
    if (!isAllowedEmail(email)) {
      return {
        error: "Este e-mail não possui acesso ao sistema.",
      };
    }

    if (!isConfigured) {
      return {
        error: "Supabase não configurado. Adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local",
      };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user && !isAllowedEmail(data.user.email || "")) {
        await supabase.auth.signOut();
        return {
          error: "Este e-mail não possui acesso ao sistema.",
        };
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: (err as Error).message || "Falha ao criar conta." };
    }
  };

  // Logout
  const signOut = async (): Promise<void> => {
    if (isConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setSupabaseUser(null);
    router.replace("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        isLoading,
        isConfigured,
        role: user?.role || "user",
        isAdmin: user?.role === "admin",
        isDeveloper: user?.role === "developer" || user?.role === "admin",
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        isAllowedEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
}

