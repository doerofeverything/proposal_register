import Dashboard from "@/components/dashboard";

// The workspace validates the session and reads the database before rendering.
// Next.js validates pages separately from their parent layout.
export const instant = false;

export default function DashboardPage() {
  return <Dashboard />;
}
