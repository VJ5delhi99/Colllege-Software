"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiConfig } from "../api-config";
import { getAdminSession } from "../auth-client";

type RoleDefinition = {
  id: string;
  name: string;
  description: string;
};

type PermissionDefinition = {
  id: string;
  name: string;
  description: string;
};

export default function RbacPage() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await getAdminSession();
        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };

        const [rolesResponse, permissionsResponse] = await Promise.all([
          fetch(`${apiConfig.authorization()}/api/v1/roles`, { headers }),
          fetch(`${apiConfig.authorization()}/api/v1/permissions`, { headers })
        ]);

        if (!rolesResponse.ok || !permissionsResponse.ok) {
          throw new Error("Unable to load RBAC catalog.");
        }

        const [rolesPayload, permissionsPayload] = await Promise.all([
          rolesResponse.json(),
          permissionsResponse.json()
        ]);

        if (!cancelled) {
          setRoles(rolesPayload as RoleDefinition[]);
          setPermissions(permissionsPayload as PermissionDefinition[]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unexpected error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Security</p>
          <h1 className="mt-2 text-4xl font-semibold">RBAC Catalog</h1>
        </div>
        <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back to Dashboard
        </Link>
      </div>

      {error ? <p className="mx-auto mt-8 max-w-6xl rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">{error}</p> : null}

      <section className="mx-auto mt-8 grid max-w-6xl gap-6 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur">
          <h2 className="text-lg font-medium text-cyan-200">Roles</h2>
          <div className="mt-4 space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="font-medium">{role.name}</p>
                <p className="mt-1 text-sm text-slate-400">{role.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_0_80px_rgba(168,85,247,0.08)] backdrop-blur">
          <h2 className="text-lg font-medium text-fuchsia-200">Permissions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {permissions.map((permission) => (
              <span key={permission.id} className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-100">
                {permission.name}
              </span>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
