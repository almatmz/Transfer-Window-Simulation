"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { playersApi, CURRENT_SEASON } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  PageLoader,
  ErrorMessage,
  Badge,
  Button,
  Card,
  Modal,
  PositionBadge,
  FFPBadge,
} from "@/components/ui";
import { formatEur, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  Edit,
  Trash2,
  Plus,
  ArrowRightLeft,
  FileText,
  Shield,
  Lock,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";

export default function PlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const router = useRouter();
  const id = parseInt(playerId);
  const { role, isAuthenticated } = useAuth();
  const isSdOrAdmin = role === "sport_director" || role === "admin";
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);

  const {
    data: player,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["player", id],
    queryFn: () => playersApi.get(id),
    enabled: !!id,
  });

  const { data: loans } = useQuery({
    queryKey: ["player-loans", id],
    queryFn: () => playersApi.getLoan(id),
    enabled: !!id && isSdOrAdmin,
  });

  const { data: extensions } = useQuery({
    queryKey: ["player-contracts", id],
    queryFn: () => playersApi.getContractExtension(id),
    enabled: !!id && isAuthenticated,
  });

  const { data: overrides } = useQuery({
    queryKey: ["player-overrides", id],
    queryFn: () => playersApi.listOverrides(id),
    enabled: !!id && isSdOrAdmin,
  });

  if (isLoading) return <PageLoader />;
  if (error || !player)
    return (
      <ErrorMessage message={(error as Error)?.message ?? "Player not found"} />
    );

  // API may return single object or array — normalise
  const loansArr: any[] = Array.isArray(loans)
    ? loans
    : loans && typeof loans === "object" && "id" in (loans as any)
      ? [loans]
      : [];
  const activeLoan = loansArr.find((l: any) => l.is_active);
  const activeExtension = extensions?.[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 animate-fade-up">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors mt-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
          {player.photo_url ? (
            <Image
              src={player.photo_url}
              alt={player.name}
              width={64}
              height={64}
              className="object-cover rounded-2xl"
              unoptimized
            />
          ) : (
            <User className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="font-display font-bold text-2xl">{player.name}</h1>
            {(player.is_on_loan || player.loaned_out) && (
              <span className="loan-badge">
                {player.loaned_out ? "LOANED OUT" : "ON LOAN"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PositionBadge position={player.position} />
            {player.nationality && <Badge>{player.nationality}</Badge>}
            {player.age && <Badge variant="default">Age {player.age}</Badge>}
          </div>
        </div>
        {isSdOrAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => setOverrideOpen(true)}
            >
              Override
            </Button>
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        {/* Contract Info */}
        <Card>
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Contract
          </h2>
          <div className="space-y-2">
            {[
              {
                label: "Contract Until",
                value: player.contract_expiry_year
                  ? `${player.contract_expiry_year}`
                  : "—",
              },
              {
                label: "Contract Length",
                value: player.contract_length_years
                  ? `${player.contract_length_years} years`
                  : "—",
              },
              {
                label: "Signed",
                value: player.contract_signing_date
                  ? formatDate(player.contract_signing_date)
                  : "—",
              },
              {
                label: "Annual Salary",
                value:
                  (player.annual_salary ?? player.estimated_annual_salary)
                    ? formatEur(
                        (player.annual_salary ??
                          player.estimated_annual_salary)!,
                        true,
                      ) +
                      (player.salary_source
                        ? ` (${player.salary_source.replace("_", " ")})`
                        : "")
                    : isSdOrAdmin
                      ? "—"
                      : "(hidden)",
              },
              {
                label: "Transfer Value",
                value: player.transfer_value
                  ? formatEur(player.transfer_value, true)
                  : "—",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between items-center text-sm py-1 border-b border-border last:border-0"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setContractOpen(true)}
            >
              Propose Contract Extension
            </Button>
          )}
        </Card>

        {/* Loan Info */}
        <Card>
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Loan Details
          </h2>
          {player.is_on_loan ? (
            <div className="space-y-2">
              {[
                { label: "From Club", value: player.loan_from_club || "—" },
                {
                  label: "Loan Ends",
                  value: player.loan_end_date
                    ? formatDate(player.loan_end_date)
                    : "—",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between text-sm py-1 border-b border-border last:border-0"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not currently on loan
            </p>
          )}
          {activeLoan && isSdOrAdmin && (
            <div className="mt-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl space-y-1.5 text-xs">
              <p className="font-semibold text-violet-600 dark:text-violet-400">
                Active Loan Deal
              </p>
              <p>
                Direction:{" "}
                <span className="font-medium">
                  {activeLoan.loan_direction.toUpperCase()}
                </span>
              </p>
              <p>
                Club:{" "}
                <span className="font-medium">
                  {activeLoan.counterpart_club_name || "—"}
                </span>
              </p>
              <p>
                Wage impact:{" "}
                <span className="font-medium">
                  {formatEur(activeLoan.effective_wage_impact, true)}/yr
                </span>
              </p>
              {activeLoan.has_option_to_buy && (
                <p>
                  Option to buy:{" "}
                  <span className="font-medium">
                    {formatEur(activeLoan.option_to_buy_fee ?? 0, true)}
                  </span>
                  {activeLoan.option_is_obligation && " (OBLIGATION)"}
                </p>
              )}
            </div>
          )}
          {isSdOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setLoanOpen(true)}
            >
              Set Loan Deal
            </Button>
          )}
          {!isSdOrAdmin && !player.is_on_loan && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
              <Lock className="w-3 h-3" />
              Detailed loan data requires Sport Director access
            </div>
          )}
        </Card>

        {/* Acquisition */}
        <Card>
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Acquisition
          </h2>
          <div className="space-y-2">
            {[
              {
                label: "Fee Paid",
                value: player.acquisition_fee
                  ? formatEur(player.acquisition_fee, true)
                  : "—",
              },
              {
                label: "Year",
                value: player.acquisition_year
                  ? `${player.acquisition_year}`
                  : "—",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between text-sm py-1 border-b border-border last:border-0"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Active Contract Extension */}
        {activeExtension && (
          <Card>
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Contract Extension Proposed
            </h2>
            <div className="space-y-2">
              {[
                {
                  label: "New Expiry",
                  value: `${activeExtension.new_contract_expiry_year}`,
                },
                {
                  label: "New Salary",
                  value: activeExtension.new_annual_salary
                    ? formatEur(activeExtension.new_annual_salary, true) + "/yr"
                    : "—",
                },
                {
                  label: "Starts",
                  value: `${activeExtension.extension_start_year}`,
                },
                {
                  label: "Signing Bonus",
                  value: activeExtension.signing_bonus
                    ? formatEur(activeExtension.signing_bonus, true)
                    : "—",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between text-sm py-1 border-b border-border last:border-0"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* SD Overrides */}
        {isSdOrAdmin && overrides && overrides.length > 0 && (
          <Card className="md:col-span-2">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Edit className="w-4 h-4 text-primary" />
              Active Overrides
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["Set By", "Salary", "Expiry", "Notes", "Updated"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left py-2 pr-4 font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2 pr-4">{o.set_by_role}</td>
                      <td className="py-2 pr-4">
                        {o.annual_salary
                          ? formatEur(o.annual_salary, true)
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {o.contract_expiry_year ?? "—"}
                      </td>
                      <td className="py-2 pr-4 max-w-[120px] truncate">
                        {o.notes || "—"}
                      </td>
                      <td className="py-2 pr-4">{formatDate(o.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      {isSdOrAdmin && (
        <OverrideModal
          open={overrideOpen}
          onClose={() => setOverrideOpen(false)}
          playerId={id}
        />
      )}
      {isSdOrAdmin && (
        <LoanModal
          open={loanOpen}
          onClose={() => setLoanOpen(false)}
          playerId={id}
        />
      )}
      {isAuthenticated && (
        <ContractExtensionModal
          open={contractOpen}
          onClose={() => setContractOpen(false)}
          playerId={id}
        />
      )}
    </div>
  );
}

// ── Override Modal ────────────────────────────────────────────
function OverrideModal({
  open,
  onClose,
  playerId,
}: {
  open: boolean;
  onClose: () => void;
  playerId: number;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<any>({ mode: "onSubmit" });
  const deleteMutation = useMutation({
    mutationFn: () => playersApi.deleteOverride(playerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player", playerId] });
      qc.invalidateQueries({ queryKey: ["player-overrides", playerId] });
      toast.success("Override removed");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const onSubmit = async (data: any) => {
    const body: any = {};
    if (data.annual_salary) body.annual_salary = parseFloat(data.annual_salary);
    if (data.transfer_value)
      body.transfer_value = parseFloat(data.transfer_value);
    if (data.contract_expiry_year)
      body.contract_expiry_year = parseInt(data.contract_expiry_year);
    if (data.contract_length_years)
      body.contract_length_years = parseInt(data.contract_length_years);
    if (data.position) body.position = data.position;
    if (data.is_on_loan !== undefined)
      body.is_on_loan = data.is_on_loan === "true";
    if (data.loan_from_club) body.loan_from_club = data.loan_from_club;
    if (data.notes) body.notes = data.notes;
    try {
      await playersApi.setOverride(playerId, body);
      qc.invalidateQueries({ queryKey: ["player", playerId] });
      qc.invalidateQueries({ queryKey: ["player-overrides", playerId] });
      toast.success("Override saved");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Override Player Data" size="md">
      <p className="text-xs text-muted-foreground mb-4">
        Leave blank to keep existing values. Only filled fields are overridden.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Annual Salary (€)",
              name: "annual_salary",
              type: "number",
            },
            {
              label: "Transfer Value (€)",
              name: "transfer_value",
              type: "number",
            },
            {
              label: "Contract Expiry Year",
              name: "contract_expiry_year",
              type: "number",
            },
            {
              label: "Contract Length (years)",
              name: "contract_length_years",
              type: "number",
            },
            { label: "Position", name: "position", type: "text" },
            { label: "Loan From Club", name: "loan_from_club", type: "text" },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium mb-1">
                {f.label}
              </label>
              <input
                type={f.type}
                {...register(f.name)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">On Loan</label>
          <select
            {...register("is_on_loan")}
            className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">— unchanged —</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Remove Override
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting}>
            Save Override
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Loan Modal ────────────────────────────────────────────────
function LoanModal({
  open,
  onClose,
  playerId,
}: {
  open: boolean;
  onClose: () => void;
  playerId: number;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: {
      loan_direction: "in",
      wage_contribution_pct: 100,
      has_option_to_buy: false,
    },
    mode: "onSubmit",
  });
  const hasOption = watch("has_option_to_buy");
  const onSubmit = async (data: any) => {
    try {
      await playersApi.setLoan(playerId, {
        loan_direction: data.loan_direction,
        counterpart_club_name: data.counterpart_club_name,
        loan_fee: parseFloat(data.loan_fee || "0"),
        annual_salary: parseFloat(data.annual_salary || "0"),
        wage_contribution_pct: parseFloat(data.wage_contribution_pct || "100"),
        loan_start_date: data.loan_start_date || null,
        loan_end_date: data.loan_end_date || null,
        has_option_to_buy:
          data.has_option_to_buy === true || data.has_option_to_buy === "true",
        option_to_buy_fee: data.option_to_buy_fee
          ? parseFloat(data.option_to_buy_fee)
          : null,
        option_is_obligation: data.option_is_obligation === "true",
        notes: data.notes,
      });
      qc.invalidateQueries({ queryKey: ["player", playerId] });
      qc.invalidateQueries({ queryKey: ["player-loans", playerId] });
      toast.success("Loan deal saved");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Set Loan Deal" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Direction</label>
            <select
              {...register("loan_direction")}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="in">Loan In (arriving)</option>
              <option value="out">Loan Out (leaving)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Counterpart Club
            </label>
            <input
              {...register("counterpart_club_name")}
              placeholder="Club name"
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {[
            { label: "Loan Fee (€)", name: "loan_fee", type: "number" },
            {
              label: "Annual Salary (€)",
              name: "annual_salary",
              type: "number",
            },
            {
              label: "Wage Contribution %",
              name: "wage_contribution_pct",
              type: "number",
            },
            { label: "Loan Season", name: "loan_season", type: "text" },
            { label: "Start Date", name: "loan_start_date", type: "date" },
            { label: "End Date", name: "loan_end_date", type: "date" },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium mb-1">
                {f.label}
              </label>
              <input
                type={f.type}
                {...register(f.name)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="hasOption"
            {...register("has_option_to_buy")}
            className="rounded"
          />
          <label htmlFor="hasOption" className="text-xs font-medium">
            Has option/obligation to buy
          </label>
        </div>
        {hasOption && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-secondary rounded-xl">
            {[
              {
                label: "Option Fee (€)",
                name: "option_to_buy_fee",
                type: "number",
              },
              {
                label: "Contract Years if Bought",
                name: "option_contract_years",
                type: "number",
              },
            ].map((f) => (
              <div key={f.name}>
                <label className="block text-xs font-medium mb-1">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  {...register(f.name)}
                  className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium mb-1">
                Obligation?
              </label>
              <select
                {...register("option_is_obligation")}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none"
              >
                <option value="false">Option (optional)</option>
                <option value="true">Obligation (must buy)</option>
              </select>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            Save Loan Deal
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Contract Extension Modal ──────────────────────────────────
function ContractExtensionModal({
  open,
  onClose,
  playerId,
}: {
  open: boolean;
  onClose: () => void;
  playerId: number;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    defaultValues: { extension_start_year: CURRENT_SEASON, signing_bonus: 0 },
    mode: "onSubmit",
  });
  const deleteMutation = useMutation({
    mutationFn: () => playersApi.deleteContractExtension(playerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player-contracts", playerId] });
      toast.success("Extension removed");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const onSubmit = async (data: any) => {
    try {
      await playersApi.setContractExtension(playerId, {
        new_contract_expiry_year: parseInt(data.new_contract_expiry_year),
        new_contract_length_years: parseInt(data.new_contract_length_years),
        new_annual_salary: data.new_annual_salary
          ? parseFloat(data.new_annual_salary)
          : null,
        extension_start_year: parseInt(data.extension_start_year),
        signing_bonus: parseFloat(data.signing_bonus || "0"),
        notes: data.notes,
      });
      qc.invalidateQueries({ queryKey: ["player-contracts", playerId] });
      toast.success("Contract extension proposed");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Propose Contract Extension"
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {[
          {
            label: "New Expiry Year",
            name: "new_contract_expiry_year",
            type: "number",
            required: true,
          },
          {
            label: "New Contract Length (years)",
            name: "new_contract_length_years",
            type: "number",
            required: true,
          },
          {
            label: "New Annual Salary (€)",
            name: "new_annual_salary",
            type: "number",
          },
          {
            label: "Extension Starts Year",
            name: "extension_start_year",
            type: "number",
            required: true,
          },
          { label: "Signing Bonus (€)", name: "signing_bonus", type: "number" },
        ].map((f) => (
          <div key={f.name}>
            <label className="block text-xs font-medium mb-1">
              {f.label}
              {f.required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <input
              type={f.type}
              {...register(f.name, { required: f.required })}
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Remove
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting}>
            Propose
          </Button>
        </div>
      </form>
    </Modal>
  );
}
