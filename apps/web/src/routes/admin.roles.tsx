import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminTable, useAdminClientPagination, type Column } from "@/components/admin/AdminTable";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { useAdminI18n } from "@/lib/admin-i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/roles")({
  component: AdminRoles,
});

interface PermissionRow {
  id: string;
  code: string;
  name: string;
  group?: string | null;
  description?: string | null;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: { permission: { code: string; name?: string } }[];
  _count: { users: number };
}

interface RoleDraft {
  id?: string;
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
  isSystem?: boolean;
}

function emptyDraft(): RoleDraft {
  return { code: "", name: "", description: "", permissionCodes: [] };
}

function AdminRoles() {
  const { t } = useAdminI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RoleDraft | null>(null);

  const rolesQ = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => apiGet<RoleRow[]>("/api/admin/rbac/roles"),
  });

  const permissionsQ = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiGet<PermissionRow[]>("/api/admin/rbac/permissions"),
    enabled: !!draft,
  });

  const saveMut = useMutation({
    mutationFn: async (input: RoleDraft) => {
      const payload = {
        name: input.name.trim(),
        description: input.description.trim() || undefined,
        permissionCodes: input.permissionCodes,
      };
      if (input.id) {
        return apiPatch(`/api/admin/rbac/roles/${input.id}`, payload);
      }
      return apiPost("/api/admin/rbac/roles", {
        code: input.code.trim().toUpperCase(),
        ...payload,
      });
    },
    onSuccess: () => {
      toast.success(t("page.roles.saved"));
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/rbac/roles/${id}`),
    onSuccess: () => {
      toast.success(t("page.roles.deleted"));
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const table = useAdminClientPagination(rolesQ.data ?? []);
  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const perm of permissionsQ.data ?? []) {
      const key = perm.group?.trim() || t("page.roles.ungrouped");
      const list = groups.get(key) ?? [];
      list.push(perm);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [permissionsQ.data, t]);

  const openCreate = () => setDraft(emptyDraft());
  const openEdit = (role: RoleRow) =>
    setDraft({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? "",
      permissionCodes: role.permissions.map((item) => item.permission.code),
      isSystem: role.isSystem,
    });

  const togglePermission = (code: string, checked: boolean) => {
    if (!draft) return;
    setDraft({
      ...draft,
      permissionCodes: checked
        ? draft.permissionCodes.includes(code)
          ? draft.permissionCodes
          : [...draft.permissionCodes, code]
        : draft.permissionCodes.filter((item) => item !== code),
    });
  };

  const handleSave = () => {
    if (!draft) return;
    if (!draft.id && draft.code.trim().length < 2) {
      toast.error(t("page.roles.codeRequired"));
      return;
    }
    if (draft.name.trim().length < 2) {
      toast.error(t("page.roles.nameRequired"));
      return;
    }
    saveMut.mutate(draft);
  };

  const columns: Column<RoleRow>[] = [
    { header: "Code", cell: (r) => <code>{r.code}</code> },
    { header: "Name", cell: (r) => r.name },
    { header: t("page.roles.system"), cell: (r) => (r.isSystem ? "✓" : "—") },
    { header: t("common.users"), cell: (r) => r._count.users },
    { header: t("common.permissions"), cell: (r) => r.permissions.length },
    {
      header: t("common.actions"),
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
            {t("common.edit")}
          </Button>
          {!r.isSystem ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (!window.confirm(t("page.roles.deleteConfirm", { code: r.code }))) return;
                deleteMut.mutate(r.id);
              }}
            >
              {t("common.delete")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("page.roles.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("page.roles.description")}</p>
        </div>
        <Button onClick={openCreate}>{t("page.roles.new")}</Button>
      </header>

      <AdminTable
        rows={table.rows}
        columns={columns}
        loading={rolesQ.isLoading}
        rowKey={(r) => r.id}
        pagination={table.pagination}
      />

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? t("page.roles.editTitle") : t("page.roles.newTitle")}
            </DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="role-code">Code</Label>
                  <Input
                    id="role-code"
                    value={draft.code}
                    disabled={!!draft.id}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    placeholder="CONTENT_ADMIN"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role-name">Name</Label>
                  <Input
                    id="role-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role-description">{t("page.roles.descriptionLabel")}</Label>
                <Textarea
                  id="role-description"
                  className="min-h-20"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t("common.permissions")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {t("page.roles.selectedCount", { count: draft.permissionCodes.length })}
                  </span>
                </div>
                {permissionsQ.isLoading ? (
                  <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                ) : permissionGroups.length ? (
                  <div className="space-y-4 rounded-lg border border-border/70 bg-background/35 p-3">
                    {permissionGroups.map(([group, perms]) => (
                      <div key={group} className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {perms.map((perm) => {
                            const checked = draft.permissionCodes.includes(perm.code);
                            return (
                              <label
                                key={perm.id}
                                className="flex items-start gap-2 rounded-md border border-border/50 bg-card/40 px-2.5 py-2 text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    togglePermission(perm.code, value === true)
                                  }
                                  className="mt-0.5"
                                />
                                <span className="min-w-0">
                                  <span className="block font-medium">{perm.name}</span>
                                  <code className="block truncate text-[11px] text-muted-foreground">
                                    {perm.code}
                                  </code>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("page.roles.noPermissions")}</p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" disabled={saveMut.isPending} onClick={handleSave}>
                  {saveMut.isPending ? t("common.loading") : t("common.save")}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
