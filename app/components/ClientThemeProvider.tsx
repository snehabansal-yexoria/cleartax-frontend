"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

export default function ClientThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by rendering a fallback during SSR
  if (!mounted) {
    return <>{children}</>;
  }

  const isClientRoute = pathname?.startsWith("/dashboard/client");

  if (isClientRoute) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      {children}
    </ThemeProvider>
  );
}
