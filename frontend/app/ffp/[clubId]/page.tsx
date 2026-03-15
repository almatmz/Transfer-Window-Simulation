"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ffpApi, simulationsApi } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { PageLoader, ErrorMessage, Card, FFPBadge } from "@/components/ui";
import { formatEur, formatPct } from "@/lib/utils";
import {
  BarChart3,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";
import Link from "next/link";
import { useState, Suspense } from "react";
import { cn } from "@/lib/utils";

// Custom Tooltip
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl shadow-xl p-3 text-xs min-w-[140px]">
      <p className="font-semibold mb-2 text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4 py-0.5"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </span>
          <span className="font-medium text-foreground">
            {typeof entry.value === "number" && entry.name.includes("%")
              ? `${entry.value.toFixed(1)}%`
              : `€${entry.value}M`}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === "compliant")
    return <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />;
  if (s === "warning")
    return <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />;
  return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
}

//  FFP Content
function FFPContent() {
  const { clubId } = useParams<{ clubId: string }>();
  const searchParams = useSearchParams();
  const id = parseInt(clubId);
  const { isAuthenticated } = useAuth();

  const urlSimId = searchParams.get("sim") ?? "";
  const [simId, setSimId] = useState<string>(urlSimId);

  const {
    data: ffp,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ffp", id, simId],
    queryFn: () => ffpApi.dashboard(id, simId || undefined),
    enabled: !!id,
    staleTime: 1000 * 60,
  });

  const { data: sims } = useQuery({
    queryKey: ["my-sims-for-club", id],
    queryFn: () =>
      simulationsApi
        .listMy()
        .then((list) => list.filter((s) => s.club_api_football_id === id)),
    enabled: !!isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <PageLoader />;
  if (error || !ffp)
    return (
      <ErrorMessage
        message={(error as Error)?.message ?? "Failed to load FFP data"}
      />
    );

  const status = ffp.current_ffp_status;
  const isCompliant = status.status?.toLowerCase() === "compliant";
  const isWarning = status.status?.toLowerCase() === "warning";

  // Chart data — projections
  const projData = ffp.projections.map((p) => ({
    year: `${p.year}/${String(p.year + 1).slice(2)}`,
    Revenue: +(p.revenue / 1e6).toFixed(1),
    "Wage Bill": +(p.wage_bill / 1e6).toFixed(1),
    Amortization: +(p.amortization / 1e6).toFixed(1),
    "SCR %": +(p.squad_cost_ratio * 100).toFixed(1),
    status: p.ffp_status,
  }));

  // Determine bar color by ffp status
  const statusColor = (s: string) => {
    const v = s?.toLowerCase();
    if (v === "compliant") return "#10b981";
    if (v === "warning") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap animate-fade-up">
        <div className="flex items-center gap-3">
          <Link
            href={`/clubs/${id}`}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-xl flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              FFP Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              {ffp.club_name} · Season {ffp.season_year}/
              {String(ffp.season_year + 1).slice(2)}
              {!ffp.revenue_configured && (
                <span className="ml-2 text-amber-500">⚠ Revenue not set</span>
              )}
            </p>
          </div>
        </div>
        <div className="shrink-0 min-w-[180px]">
          <label className="block text-xs text-muted-foreground mb-1">
            Overlay simulation
          </label>
          <select
            value={simId}
            onChange={(e) => setSimId(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">— Baseline only —</option>
            {sims?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.simulation_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={cn(
          "flex items-center gap-3 p-4 rounded-2xl border animate-fade-up",
          isCompliant
            ? "bg-emerald-500/8 border-emerald-500/20"
            : isWarning
              ? "bg-amber-500/8 border-amber-500/20"
              : "bg-red-500/8 border-red-500/20",
        )}
      >
        <StatusIcon status={status.status} />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-bold text-sm",
              isCompliant
                ? "text-emerald-600 dark:text-emerald-400"
                : isWarning
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400",
            )}
          >
            {status.badge || status.status || "—"}
          </p>
          {status.reason && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.reason}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
            <span>
              SCR: <strong>{formatPct(status.squad_cost_ratio)}</strong>
            </span>
            <span>
              Break-even:{" "}
              <strong
                className={
                  status.break_even_ok
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500"
                }
              >
                {formatEur(status.break_even_result, true)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Simulation overlay info */}
      {ffp.simulation_id && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-primary/8 border border-primary/20 rounded-xl text-xs animate-fade-up">
          <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-medium">{ffp.simulation_name}</span>
          <div className="ml-auto flex gap-3 text-muted-foreground">
            {ffp.simulation_extra_wages != null && (
              <>
                <span className="text-red-500">
                  +{formatEur(ffp.simulation_extra_wages, true)} wages
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  -{formatEur(ffp.simulation_wage_relief ?? 0, true)} relief
                </span>
                <span>
                  Net {formatEur(ffp.simulation_net_spend ?? 0, true)}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up">
        {[
          {
            label: "Annual Revenue",
            value: formatEur(ffp.annual_revenue, true),
            sub: ffp.revenue_configured
              ? ffp.salary_data_source
              : "Not configured",
            icon: <DollarSign className="w-4 h-4" />,
          },
          {
            label: "Wage Bill",
            value: formatEur(ffp.current_wage_bill, true),
            sub: `${formatPct(ffp.current_wage_bill / (ffp.annual_revenue || 1))} of revenue`,
            icon: <TrendingUp className="w-4 h-4" />,
          },
          {
            label: "Amortization",
            value: formatEur(ffp.current_amortization, true),
            sub: "Transfer fee spread",
          },
          {
            label: "Squad Cost Ratio",
            value: formatPct(ffp.current_squad_cost_ratio),
            sub: `Limit ${formatPct(ffp.squad_cost_ratio_limit)} · Warn ${formatPct(ffp.squad_cost_ratio_warning)}`,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-card border border-border rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {k.label}
              </p>
              {k.icon && (
                <span className="text-muted-foreground/40">{k.icon}</span>
              )}
            </div>
            <p className="font-bold text-xl font-display">{k.value}</p>
            {k.sub && (
              <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      {projData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up">
          {/* Revenue vs Costs bar chart */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-4">
              Revenue vs Wage Bill (€M)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={projData}
                margin={{ top: 5, right: 5, bottom: 0, left: -15 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Bar
                  dataKey="Revenue"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="Wage Bill"
                  fill="hsl(var(--destructive))"
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* SCR line chart with coloured dots per status */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-4">Squad Cost Ratio (%)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={projData}
                margin={{ top: 5, right: 10, bottom: 0, left: -15 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 85]}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "hsl(var(--border))" }}
                />
                <ReferenceLine
                  y={70}
                  stroke="#ef4444"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: "70% limit",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#ef4444",
                  }}
                />
                <ReferenceLine
                  y={65}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: "65% warn",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#f59e0b",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="SCR %"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        key={payload.year}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={statusColor(payload.status)}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Projection table */}
      {ffp.projections.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-up">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Multi-Year Projection</h3>
            <p className="text-xs text-muted-foreground">
              {ffp.projections.length} years
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {[
                    "Year",
                    "Revenue",
                    "Wages",
                    "Amort.",
                    "Squad Cost",
                    "SCR",
                    "Op. Result",
                    "FFP",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ffp.projections.map((p) => (
                  <tr
                    key={p.year}
                    className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold">
                      {p.year}/{String(p.year + 1).slice(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      {formatEur(p.revenue, true)}
                    </td>
                    <td className="py-2.5 px-3">
                      {formatEur(p.wage_bill, true)}
                    </td>
                    <td className="py-2.5 px-3">
                      {formatEur(p.amortization, true)}
                    </td>
                    <td className="py-2.5 px-3">
                      {formatEur(p.squad_cost, true)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          "font-semibold",
                          p.squad_cost_ratio >= ffp.squad_cost_ratio_limit
                            ? "text-red-500"
                            : p.squad_cost_ratio >= ffp.squad_cost_ratio_warning
                              ? "text-amber-500"
                              : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {formatPct(p.squad_cost_ratio)}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 px-3 font-medium",
                        p.operating_result >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500",
                      )}
                    >
                      {formatEur(p.operating_result, true)}
                    </td>
                    <td className="py-2.5 px-3">
                      <FFPBadge status={p.ffp_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FFPPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <FFPContent />
    </Suspense>
  );
}
