import React from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full flex flex-col flex-1 pb-20 md:pb-8">
      <AppHeader />
      <div className="flex-1 w-full">{children}</div>
      <BottomNav />
    </div>
  );
}
