"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { simulationsApi, searchApi, CURRENT_SEASON } from "@/lib/api/client";
import type { SimulationSummary } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { PageLoader, FFPBadge, Badge, Button, Skeleton } from "@/components/ui";
import { formatEur, formatDate, friendlyError } from "@/lib/utils";
import {
  Plus,
  Trash2,
  ExternalLink,
  Activity,
  Search,
  Loader2,
  Trophy,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

// ── Club search for new simulation ───────────────────────────
function ClubSearch({ onSelect }: { onSelect: (c: any) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchApi.clubs(q));
        setOpen(true);
      } catch {
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.length >= 2 && setOpen(true)}
        placeholder="Search for a club to simulate…"
        className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 inset-x-0 bg-popover border border-border rounded-xl shadow-xl overflow-y-auto max-h-56 animate-scale-in">
            {results.slice(0, 8).map((c) => (
              <button
                key={c.api_football_id}
                type="button"
                onClick={() => {
                  onSelect(c);
                  setQ("");
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-sm hover:bg-secondary text-left transition-colors"
              >
                {c.logo_url && (
                  <img
                    src={c.logo_url}
                    alt=""
                    className="w-6 h-6 object-contain shrink-0"
                  />
                )}
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.country} · {c.league}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── New simulation inline form ────────────────────────────────
function NewSimForm({
  defaultClub,
  onDone,
}: {
  defaultClub?: any;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [club, setClub] = useState<any>(defaultClub ?? null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: {
      simulation_name: "",
      window_type: "summer",
      season: `${CURRENT_SEASON}/${String(CURRENT_SEASON + 1).slice(2)}`,
    },
  });
  const router = useRouter();

  const onSubmit = async (data: any) => {
    if (!club) {
      toast.error("Please select a club first");
      return;
    }
    try {
      const sim = await simulationsApi.create({
        ...data,
        club_api_football_id: club.api_football_id,
      });
      qc.invalidateQueries({ queryKey: ["my-sims"] });
      toast.success("Simulation created!");
      router.push(`/simulations/${sim.id}`);
    } catch (e: any) {
      toast.error(friendlyError(e.message));
    }
  };

  return (
    <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3 animate-fade-up">
      <h3 className="font-semibold text-sm">New Simulation</h3>
      {club ? (
        <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          {club.logo_url && (
            <img
              src={club.logo_url}
              alt=""
              className="w-6 h-6 object-contain shrink-0"
            />
          )}
          <span className="text-sm font-medium flex-1 truncate">
            {club.name}
          </span>
          <button
            type="button"
            onClick={() => setClub(null)}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Change
          </button>
        </div>
      ) : (
        <ClubSearch onSelect={setClub} />
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <input
          {...register("simulation_name", { required: true })}
          placeholder="Simulation name (e.g. Summer 2026 rebuild)"
          className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            {...register("window_type")}
            className="h-9 px-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none"
          >
            <option value="summer">☀️ Summer</option>
            <option value="winter">❄️ Winter</option>
          </select>
          <input
            {...register("season")}
            placeholder="2025/26"
            className="h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onDone}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}

function SimulationsContent() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const prefillClubId = searchParams.get("club");
  const prefillClubName = searchParams.get("name");

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  // Auto-open form if coming from club page
  useEffect(() => {
    if (prefillClubId) setShowNew(true);
  }, [prefillClubId]);

  const { data: sims = [], isLoading } = useQuery<SimulationSummary[]>({
    queryKey: ["my-sims"],
    queryFn: simulationsApi.listMy,
    enabled: !!isAuthenticated,
    staleTime: 1000 * 30,
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => simulationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-sims"] });
      toast.success("Simulation deleted");
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  if (loading || (!isAuthenticated && !loading)) return <PageLoader />;

  const prefillClub =
    prefillClubId && prefillClubName
      ? {
          api_football_id: parseInt(prefillClubId),
          name: decodeURIComponent(prefillClubName),
        }
      : undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            My Simulations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "…"
              : `${sims.length} simulation${sims.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {!showNew && (
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowNew(true)}
          >
            New Simulation
          </Button>
        )}
      </div>

      {/* New sim form — inline, no modal */}
      {showNew && (
        <NewSimForm
          defaultClub={prefillClub}
          onDone={() => setShowNew(false)}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : sims.length === 0 && !showNew ? (
        <div className="text-center py-16">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">
            No simulations yet
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first transfer scenario
          </p>
          <Button
            className="mt-4"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowNew(true)}
          >
            New Simulation
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sims.map((sim) => (
            <div
              key={sim.id}
              className="flex items-start gap-3 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-semibold text-sm">{sim.simulation_name}</p>
                  <FFPBadge status={sim.overall_ffp_status} />
                  {sim.is_public && <Badge variant="info">Public</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    {sim.club_name}
                  </span>
                  <span>
                    {sim.window_type === "summer" ? "☀️" : "❄️"} {sim.season}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatDate(sim.created_at)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs mt-1.5">
                  {sim.total_buys > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      +{sim.total_buys} buys
                    </span>
                  )}
                  {sim.total_sells > 0 && (
                    <span className="text-red-500 font-medium">
                      -{sim.total_sells} sells
                    </span>
                  )}
                  {sim.total_loans_in + sim.total_loans_out > 0 && (
                    <span className="text-violet-500 font-medium">
                      {sim.total_loans_in + sim.total_loans_out} loans
                    </span>
                  )}
                  {sim.net_spend !== 0 && (
                    <span
                      className={cn(
                        "font-semibold",
                        sim.net_spend > 0
                          ? "text-red-500"
                          : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      Net: {formatEur(sim.net_spend, true)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href={`/simulations/${sim.id}`}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                  >
                    Open
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  className="text-muted-foreground hover:text-destructive"
                  loading={delMutation.isPending}
                  onClick={() =>
                    confirm("Delete this simulation?") &&
                    delMutation.mutate(sim.id)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SimulationsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SimulationsContent />
    </Suspense>
  );
}
