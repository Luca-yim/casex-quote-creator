import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — CaseX Pricing Calculator" },
      { name: "description", content: "Manage users and roles for the CaseX Pricing Calculator." },
      { property: "og:title", content: "Admin — CaseX Pricing Calculator" },
      { property: "og:description", content: "Manage users and roles for the CaseX Pricing Calculator." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <ProtectedRoute allow={["admin"]}>
      <AppLayout title="Admin" description="User and role management">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
            <CardDescription>Assign external, sales rep, estimator and admin roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUsersTable />
          </CardContent>
        </Card>
      </AppLayout>
    </ProtectedRoute>
  );
}
