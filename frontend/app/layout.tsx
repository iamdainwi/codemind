import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/lib/auth"
import { ToastProvider } from "@/components/Toast"
import { cn } from "@/lib/utils";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'})

export const metadata = {
  title: "CodeMind — AI Code Knowledge Base",
  description: "Upload your codebase, ask questions in plain English, and get cited answers powered by Endee vector database.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased dark", fontSans.variable, "font-mono", jetbrainsMono.variable)}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
