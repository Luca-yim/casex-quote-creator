import { useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import {
  useAdminUsers,
  useToggleUserActive,
  useUpdateUserRole,
  type AdminUser,
} from "@/hooks/useAdminUsers";
import { ROLE_LABEL } from "@/components/nav/nav-config";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/auth-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const ROLES: AppRole[] = ["external", "sales_rep", "estimator", "admin"];

function matches(user: AdminUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${user.email ?? ""} ${user.fullName ?? ""}`.toLowerCase().includes(q);
}

export function AdminUsersTable() {
  const { user } = useAuth();
  const { data, isPending, isError, error } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const toggleActive = useToggleUserActive();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");

  const rows = useMemo(() => {
    return (data ?? []).filter(
      (u) => matches(u, query) && (roleFilter === "all" || u.role === roleFilter),
    );
  }, [data, query, roleFilter]);

  if (isPending) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{(error as Error)?.message ?? "Could not load users."}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as AppRole | "all")}
        >
          <SelectTrigger className="w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABEL[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="w-48">Role</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No users match this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => {
                const isSelf = u.id === user?.id;
                const busy =
                  (updateRole.isPending && updateRole.variables?.userId === u.id) ||
                  (toggleActive.isPending && toggleActive.variables?.userId === u.id);
                return (
                  <TableRow key={u.id} className={u.deactivatedAt ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {u.fullName || u.email || "Unnamed user"}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        disabled={isSelf || busy || Boolean(u.deactivatedAt)}
                        onValueChange={(value) =>
                          updateRole.mutate({ userId: u.id, role: value as AppRole })
                        }
                      >
                        <SelectTrigger aria-label={`Role for ${u.email ?? u.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.deactivatedAt ? "outline" : "secondary"}>
                        {u.deactivatedAt ? "Deactivated" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={u.deactivatedAt ? "outline" : "ghost"}
                        size="sm"
                        disabled={isSelf || busy}
                        onClick={() =>
                          toggleActive.mutate({ userId: u.id, deactivate: !u.deactivatedAt })
                        }
                      >
                        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                        {u.deactivatedAt ? "Reactivate" : "Deactivate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        You cannot change your own role or deactivate your own account — ask another admin.
      </p>
    </div>
  );
}
