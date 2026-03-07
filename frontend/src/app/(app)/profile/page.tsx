"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useMe, useUpdateMe } from "@/services/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toaster";
import { useAuthStore } from "@/store/auth";
import {
  User,
  Mail,
  Building,
  Edit3,
  LogOut,
  Shield,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const roleBadge: Record<string, "info" | "success" | "warning"> = {
  admin: "warning",
  sport_director: "success",
  user: "info",
};

export default function ProfilePage() {
  const { data: user, isLoading } = useMe();
  const updateMe = useUpdateMe();
  const { logout } = useAuthStore();
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    club_affiliation: "",
  });
  const [editing, setEditing] = useState(false);

  if (isLoading)
    return (
      <AppLayout title="Profile">
        <PageSpinner />
      </AppLayout>
    );
  if (!user) return null;

  const startEdit = () => {
    setForm({
      full_name: user.full_name || "",
      username: user.username,
      club_affiliation: user.club_affiliation || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateMe.mutateAsync(form);
      toast("Profile updated", "success");
      setEditing(false);
    } catch {
      toast("Failed to update profile", "error");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const permissions = [
    { label: "View club squads", allowed: true },
    { label: "Create simulations", allowed: true },
    { label: "View FFP dashboards", allowed: true },
    {
      label: "Override player salaries",
      allowed: user.role === "sport_director" || user.role === "admin",
    },
    {
      label: "Edit club revenue",
      allowed: user.role === "sport_director" || user.role === "admin",
    },
    { label: "Manage users", allowed: user.role === "admin" },
    { label: "Force squad sync", allowed: user.role === "admin" },
  ];

  return (
    <AppLayout title="Profile">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Hero card */}
        <div
          className="relative overflow-hidden rounded-2xl p-6"
          style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
          }}
        >
          {/* Decorative gradient */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{
              background: "radial-gradient(circle, #3b82f6, transparent)",
              transform: "translate(30%,-30%)",
            }}
          />

          <div className="relative flex items-start gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl shadow-blue-500/20 flex-shrink-0">
              {(user.full_name || user.username)[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold c-text">
                    {user.full_name || user.username}
                  </h2>
                  <p className="text-sm c-text-3 mt-0.5">@{user.username}</p>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant={roleBadge[user.role] || "info"}
                    className="capitalize"
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {user.role.replace("_", " ")}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="flex items-center gap-1.5 text-xs c-text-3">
                  <Mail className="w-3.5 h-3.5" />
                  {user.email}
                </span>
                {user.club_affiliation && (
                  <span className="flex items-center gap-1.5 text-xs c-text-3">
                    <Building className="w-3.5 h-3.5" />
                    {user.club_affiliation}
                  </span>
                )}
                <span className="text-xs c-text-3">
                  Member since{" "}
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Account details */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--c-border)" }}
          >
            <p className="text-sm font-semibold c-text">Account Details</p>
            {!editing && (
              <Button size="xs" variant="ghost" onClick={startEdit}>
                <Edit3 className="w-3 h-3" /> Edit
              </Button>
            )}
          </div>
          <div className="p-5">
            {editing ? (
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                />
                <Input
                  label="Username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
                <Input
                  label="Club Affiliation"
                  placeholder="e.g. Manchester City FC"
                  value={form.club_affiliation}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, club_affiliation: e.target.value }))
                  }
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    loading={updateMe.isPending}
                    onClick={handleSave}
                  >
                    Save Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {[
                  {
                    icon: User,
                    label: "Full Name",
                    value: user.full_name || "—",
                  },
                  { icon: User, label: "Username", value: `@${user.username}` },
                  { icon: Mail, label: "Email", value: user.email },
                  {
                    icon: Building,
                    label: "Club Affiliation",
                    value: user.club_affiliation || "—",
                  },
                ].map(({ icon: Icon, label, value }, i, arr) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 py-3"
                    style={{
                      borderBottom:
                        i < arr.length - 1
                          ? "1px solid var(--c-border)"
                          : undefined,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--c-bg-raised)" }}
                    >
                      <Icon className="w-3.5 h-3.5 c-text-3" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest c-text-3">
                        {label}
                      </p>
                      <p className="text-sm font-medium c-text mt-0.5">
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Permissions */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
          }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--c-border)" }}
          >
            <p className="text-sm font-semibold c-text">Permissions</p>
          </div>
          <div className="p-5 space-y-0">
            {permissions.map(({ label, allowed }, i) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5"
                style={{
                  borderBottom:
                    i < permissions.length - 1
                      ? "1px solid var(--c-border)"
                      : undefined,
                }}
              >
                <span className="text-sm c-text-2">{label}</span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-semibold ${allowed ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-600"}`}
                >
                  {allowed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Restricted
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
          }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--c-border)" }}
          >
            <p className="text-sm font-semibold c-text">Session</p>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium c-text">
                Sign out of your account
              </p>
              <p className="text-xs c-text-3 mt-0.5">
                You will be redirected to the login page
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
