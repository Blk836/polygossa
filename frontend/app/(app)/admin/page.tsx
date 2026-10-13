import { AdminView } from "@/components/admin/admin-view";
import { adminTab } from "@/lib/admin";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  return <AdminView tab={adminTab((await searchParams).tab)} />;
}
