import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowdesk | Proposal Register",
  description: "Water treatment proposals, project values, and revision history in one workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><Suspense fallback={<div className="loading">Loading Flowdesk…</div>}>{children}</Suspense></body>
    </html>
  );
}
