"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clubsApi, ffpApi, CURRENT_SEASON } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  PageLoader,
  ErrorMessage,
  Badge,
  Button,
  Card,
  KpiCard,
  FFPBadge,
  Skeleton,
} from "@/components/ui";
import { formatEur, formatDate, formatPct, friendlyError } from "@/lib/utils";
import {
  Users,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Trophy,
  MapPin,
  Calendar,
  DollarSign,
  Info,
  ChevronRight,
  Lock,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";

export default function ClubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { role, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [revenueOpen, setRevenueOpen] = useState(false);
  const isSdOrAdmin = role === "sport_director" || role === "admin";
  const isLoggedIn = isAuthenticated;

  const {
    data: club,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["club", id, CURRENT_SEASON],
    queryFn: () => clubsApi.get(id, CURRENT_SEASON),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: ffp } = useQuery({
    queryKey: ["ffp", id],
    queryFn: () => ffpApi.dashboard(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });

  const syncMutation = useMutation({
    mutationFn: () => clubsApi.sync(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["club", id] });
      qc.removeQueries({ queryKey: ["squad", id] });
      qc.removeQueries({ queryKey: ["ffp", id] });
      toast.success("Sync started — squad data will update in a moment");
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  if (isLoading)
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  if (error || !club)
    return (
      <ErrorMessage
        message={friendlyError((error as Error)?.message ?? "Club not found")}
      />
    );

  const navCards = [
    {
      href: `/clubs/${id}/squad`,
      icon: Users,
      label: "View Squad",
      desc: "Players & contracts",
      color: "text-blue-500",
    },
    {
      href: `/ffp/${id}`,
      icon: BarChart3,
      label: "FFP Dashboard",
      desc: "Financial compliance",
      color: "text-emerald-500",
    },
    {
      href: `/simulations?club=${id}&name=${encodeURIComponent(club.name)}`,
      icon: TrendingUp,
      label: "Simulate Transfers",
      desc: "Build scenarios",
      color: "text-primary",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
          {club.logo_url ? (
            <Image
              src={club.logo_url}
              alt={club.name}
              width={56}
              height={56}
              className="object-contain"
              unoptimized
            />
          ) : (
            <Trophy className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-2xl truncate">
            {club.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {club.country}
            </span>
            <span className="text-border text-xs">·</span>
            <span className="text-xs text-muted-foreground">{club.league}</span>
            <Badge variant="info">
              {club.season_year}/{String(club.season_year + 1).slice(2)}
            </Badge>
            {ffp && <FFPBadge status={ffp.current_ffp_status.status} />}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {/* Revenue button — available to ALL logged-in users */}
          {isLoggedIn && (
            <Button
              variant="outline"
              size="sm"
              icon={<DollarSign className="w-3.5 h-3.5" />}
              onClick={() => setRevenueOpen(true)}
            >
              {isSdOrAdmin ? "Set Revenue" : "My Revenue Est."}
            </Button>
          )}
          {isSdOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              loading={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              Sync
            </Button>
          )}
        </div>
      </div>

      {/* Quick Nav — 3 equal cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        {navCards.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-all">
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
        ))}
      </div>

      {/* FFP KPIs */}
      {ffp && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          <KpiCard
            label="Annual Revenue"
            value={formatEur(ffp.annual_revenue, true)}
            sub={
              ffp.revenue_configured
                ? `Configured${isSdOrAdmin ? ` · ${ffp.salary_data_source}` : ""}`
                : "Not configured — estimates only"
            }
            icon={<DollarSign className="w-4 h-4" />}
          />
          <KpiCard
            label="Wage Bill"
            value={formatEur(ffp.current_wage_bill, true)}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <KpiCard
            label="Squad Cost Ratio"
            value={formatPct(ffp.current_squad_cost_ratio)}
            sub={`Limit: ${formatPct(ffp.squad_cost_ratio_limit)}`}
          />
          <KpiCard
            label="FFP Status"
            value={
              ffp.current_ffp_status.badge || ffp.current_ffp_status.status
            }
            sub={ffp.current_ffp_status.reason || "—"}
          />
        </div>
      )}

      {/* Revenue info for non-SD users */}
      {isLoggedIn && !isSdOrAdmin && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 animate-fade-up">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            You can set a personal revenue estimate for this club. It's only
            visible to you and affects your own FFP calculations. Official
            revenue is set by admins/sport directors.
          </span>
        </div>
      )}

      {/* Last sync */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-up">
        <Calendar className="w-3.5 h-3.5" />
        Last synced: {formatDate(club.last_synced_at)}
      </div>

      {/* Revenue Modal */}
      {isLoggedIn && revenueOpen && (
        <RevenueModal
          open
          onClose={() => setRevenueOpen(false)}
          clubId={id}
          seasonYear={club.season_year}
          currentRevenue={club.annual_revenue}
          isSdOrAdmin={isSdOrAdmin}
        />
      )}
    </div>
  );
}

function RevenueModal({
  open,
  onClose,
  clubId,
  seasonYear,
  currentRevenue,
  isSdOrAdmin,
}: {
  open: boolean;
  onClose: () => void;
  clubId: number;
  seasonYear: number;
  currentRevenue: number;
  isSdOrAdmin: boolean;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ revenue: number }>({
    defaultValues: {
      revenue:
        currentRevenue > 0
          ? Math.round((currentRevenue / 1_000_000) * 10) / 10
          : 0,
    },
    mode: "onSubmit",
  });
  const onSubmit = async (data: { revenue: number }) => {
    try {
      await clubsApi.setRevenue(clubId, {
        annual_revenue: data.revenue * 1_000_000,
        season_year: seasonYear,
      });
      qc.removeQueries({ queryKey: ["club", clubId] });
      qc.removeQueries({ queryKey: ["ffp", clubId] });
      toast.success(
        isSdOrAdmin
          ? "Official revenue updated for all users"
          : "Personal revenue estimate saved",
      );
      onClose();
    } catch (e: any) {
      toast.error(friendlyError(e.message));
    }
  };
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in p-6">
        <h2 className="font-semibold mb-1">
          {isSdOrAdmin ? "Set Official Revenue" : "Set Revenue Estimate"}
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          {isSdOrAdmin
            ? "This revenue will be used for all users' FFP calculations."
            : "This is your personal estimate — only visible to you. It won't affect other users."}
        </p>
        {!isSdOrAdmin && (
          <div className="flex items-center gap-2 p-2.5 bg-secondary rounded-xl text-xs text-muted-foreground mb-4">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Only you can see this estimate
          </div>
        )}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Annual Revenue (€ millions)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 700"
              className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              {...register("revenue", {
                required: true,
                min: 0,
                valueAsNumber: true,
              })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter value in millions (e.g. 700 = €700M)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
