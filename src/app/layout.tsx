import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { AppStateProvider } from "@/context/AppStateContext";
import { AppShell } from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgendadorAuto - Gestão e Agendamento para Instagram",
  description:
    "Painel completo para automação e agendamento de Reels e Carrosséis para múltiplas contas do Instagram com o AgendadorAuto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <ToastProvider>
          <AuthProvider>
            <AppStateProvider>
              <AppShell>{children}</AppShell>
            </AppStateProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

