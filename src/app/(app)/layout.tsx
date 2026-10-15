import React from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { TermsGate } from "@/components/TermsGate";
import { FormatPrefsProvider } from "@/hooks/useFormatPrefs";
import { PlanExpirationBanner } from "@/components/PlanExpirationBanner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FormatPrefsProvider>
      <div className="w-full flex flex-col flex-1 pb-20 md:pb-8">
        <PlanExpirationBanner />
        <AppHeader />
        <div className="flex-1 w-full">{children}</div>
        <BottomNav />
        <TermsGate />
      </div>
    </FormatPrefsProvider>
  );
}

