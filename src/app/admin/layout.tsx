import AdminShell from "@/components/AdminShell";

export const metadata = { title: "iLoveJ Campaign Admin" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
