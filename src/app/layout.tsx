import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import ErrorReporter from "@/components/ErrorReporter";
import { Toaster } from "sonner";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "FitCoach AI - Your Personal Fitness, Dance & Diet Coach",
  description: "AI-powered fitness coaching with real-time form analysis, personalized workout plans, dance training, and nutrition guidance.",
  keywords: ["fitness", "AI coach", "workout", "dance", "nutrition", "personal trainer"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${archivo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ErrorReporter />
        <AppLayout>{children}</AppLayout>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
          }}
        />
      </body>
    </html>
  );
}
