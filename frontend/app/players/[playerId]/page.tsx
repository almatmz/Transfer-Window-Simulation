"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { playersApi } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  PageLoader,
  ErrorMessage,
  Badge,
  Button,
  Card,
  PositionBadge,
} from "@/components/ui";
import { formatEur, formatDate, friendlyError } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  FileText,
  TrendingUp,
  Edit,
  Plus,
  ArrowRightLeft,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { OverrideModal } from "@/components/player/OverrideModal";
import { ContractModal } from "@/components/player/ContractModal";

// ── Shared row component ──────────────────────────────────────
function Row({ l, v, hl }: { l: string; v: React.ReactNode; hl?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 text-sm gap-4">
      <span className="text-muted-foreground shrink-0">{l}</span>
      <span className={cn("font-medium text-right", hl && "text-primary")}>
        {v ?? "—"}
      </span>
    </div>
  );
}

export default function PlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const router = useRouter();
  const id = parseInt(playerId);
  const { role, isAuthenticated } = useAuth();
  const isSdOrAdmin = role === "sport_director" || role === "admin";

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [showLoanDetail, setShowLoanDetail] = useState(false);

  const {
    data: player,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["player", id],
    queryFn: () => playersApi.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: loansRaw } = useQuery({
    queryKey: ["player-loans", id],
    queryFn: () => playersApi.getLoan(id),
    enabled: !!id && isSdOrAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const { data: extensions } = useQuery({
    queryKey: ["player-contracts", id],
    queryFn: () => playersApi.getContractExtension(id),
    enabled: !!id && isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <PageLoader />;
  if (error || !player)
    return (
      <ErrorMessage
        message={friendlyError((error as Error)?.message ?? "Player not found")}
      />
    );

  const loansArr: any[] = Array.isArray(loansRaw)
    ? loansRaw
    : loansRaw && "id" in (loansRaw as any)
      ? [loansRaw]
      : [];
  const activeLoan = loansArr.find((l: any) => l.is_active);
  // New response shape: { current_contract, effective_contract, extensions[], has_extensions }
  const extData = extensions as any;
  const currentContract = extData?.current_contract ?? null;
  const effectiveContract = extData?.effective_contract ?? null;
  const extensionsList = extData?.extensions ?? [];
  // My editable extension: "only_you" visibility = mine; "everyone" = admin's
  const myExt =
    extensionsList.find((e: any) => e.visibility === "only_you") ?? null;
  const adminExt =
    extensionsList.find((e: any) => e.visibility === "everyone") ?? null;
  const activeExtension = adminExt ?? myExt; // best for display (admin wins)
  const hasExtension = extData?.has_extensions ?? false;
  // activeLoan (from loan deal API) is the authoritative source for SD/Admin
  // Fall back to player squad data for regular users
  const isLoanIn = activeLoan?.loan_direction === "in" || player.is_on_loan;
  const isLoanOut = activeLoan?.loan_direction === "out" || player.loaned_out;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
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
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h1 className="font-display font-bold text-2xl">{player.name}</h1>
            {isLoanIn && <span className="loan-badge">ON LOAN IN</span>}
            {isLoanOut && <span className="loan-badge">LOANED OUT</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <PositionBadge position={player.position} />
            {player.nationality && <Badge>{player.nationality}</Badge>}
            {player.age && <Badge>Age {player.age}</Badge>}
          </div>
        </div>
        {isSdOrAdmin && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => setOverrideOpen(true)}
            >
              Edit Player
            </Button>
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        {/* Contract */}
        <Card>
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Contract
          </h2>
          <Row l="Contract Until" v={player.contract_expiry_year ?? "—"} />
          <Row
            l="Contract Length"
            v={
              player.contract_length_years
                ? `${player.contract_length_years} years`
                : "—"
            }
          />
          <Row
            l="Signed"
            v={
              player.contract_signing_date
                ? formatDate(player.contract_signing_date)
                : "—"
            }
          />
          <Row
            l="Annual Salary"
            v={
              (player.annual_salary ?? player.estimated_annual_salary)
                ? `${formatEur((player.annual_salary ?? player.estimated_annual_salary)!, true)}${player.salary_source ? ` (${player.salary_source.replace(/_/g, " ")})` : ""}`
                : "—"
            }
          />
          <Row
            l="Transfer Value"
            v={
              player.transfer_value
                ? formatEur(player.transfer_value, true)
                : "—"
            }
          />
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setContractOpen(true)}
            >
              {hasExtension
                ? "Update My Extension"
                : "Propose Contract Extension"}
            </Button>
          )}
        </Card>

        {/* Loan — only shown when relevant or SD/Admin */}
        {(isLoanIn || isLoanOut || isSdOrAdmin) && (
          <Card>
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              {isLoanIn
                ? "Loan In Details"
                : isLoanOut
                  ? "Loan Out Details"
                  : "Loan Status"}
            </h2>
            {isLoanIn && (
              <>
                <Row
                  l="Status"
                  v={<span className="loan-badge">ON LOAN IN</span>}
                />
                <Row
                  l="From Club"
                  v={
                    player.loan_from_club ||
                    activeLoan?.counterpart_club_name ||
                    "—"
                  }
                />
                <Row
                  l="Loan Ends"
                  v={
                    player.loan_end_date
                      ? formatDate(player.loan_end_date)
                      : activeLoan?.loan_end_date
                        ? formatDate(activeLoan.loan_end_date)
                        : "—"
                  }
                />
              </>
            )}
            {isLoanOut && (
              <>
                <Row
                  l="Status"
                  v={<span className="loan-badge">LOANED OUT</span>}
                />
                <Row
                  l="To Club"
                  v={
                    player.loaned_out_to_club ||
                    activeLoan?.counterpart_club_name ||
                    "—"
                  }
                />
                <Row
                  l="Loan Ends"
                  v={
                    player.loaned_out_end_date
                      ? formatDate(player.loaned_out_end_date)
                      : activeLoan?.loan_end_date
                        ? formatDate(activeLoan.loan_end_date)
                        : "—"
                  }
                />
              </>
            )}
            {!isLoanIn && !isLoanOut && (
              <p className="text-sm text-muted-foreground pb-2">
                Not currently on loan
              </p>
            )}

            {/* Full deal — SD/Admin expandable */}
            {isSdOrAdmin && activeLoan && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowLoanDetail(!showLoanDetail)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  {showLoanDetail ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {showLoanDetail ? "Hide" : "Show"} full deal details
                </button>
                {showLoanDetail && (
                  <div className="mt-2 p-3 bg-secondary/40 rounded-xl space-y-0">
                    <Row
                      l="Direction"
                      v={
                        activeLoan.loan_direction === "in"
                          ? "Loan In"
                          : "Loan Out"
                      }
                    />
                    <Row
                      l="Counterpart Club"
                      v={activeLoan.counterpart_club_name || "—"}
                    />
                    <Row l="Season" v={activeLoan.loan_season || "—"} />
                    <Row
                      l="Loan Fee"
                      v={
                        activeLoan.loan_fee > 0
                          ? formatEur(activeLoan.loan_fee, true)
                          : "Free"
                      }
                    />
                    <Row
                      l="Salary"
                      v={
                        activeLoan.annual_salary > 0
                          ? formatEur(activeLoan.annual_salary, true) + "/yr"
                          : "—"
                      }
                    />
                    <Row
                      l="Wage Contribution"
                      v={`${activeLoan.wage_contribution_pct}%`}
                    />
                    <Row
                      l="Effective Wage Impact"
                      v={
                        formatEur(activeLoan.effective_wage_impact, true) +
                        "/yr"
                      }
                      hl
                    />
                    {activeLoan.loan_start_date && (
                      <Row
                        l="Start"
                        v={formatDate(activeLoan.loan_start_date)}
                      />
                    )}
                    {activeLoan.loan_end_date && (
                      <Row l="End" v={formatDate(activeLoan.loan_end_date)} />
                    )}
                    {activeLoan.has_option_to_buy && (
                      <>
                        <Row
                          l="Option to Buy"
                          v={
                            activeLoan.option_to_buy_fee
                              ? formatEur(activeLoan.option_to_buy_fee, true)
                              : "Yes"
                          }
                          hl
                        />
                        {activeLoan.option_is_obligation && (
                          <Row l="Type" v="Obligation" />
                        )}
                        {activeLoan.option_contract_years && (
                          <Row
                            l="Option Contract"
                            v={`${activeLoan.option_contract_years} years`}
                          />
                        )}
                        {activeLoan.option_exercised && (
                          <Row l="Exercised" v="✓ Yes" />
                        )}
                      </>
                    )}
                    {activeLoan.notes && <Row l="Notes" v={activeLoan.notes} />}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Acquisition */}
        <Card>
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Acquisition
          </h2>
          <Row
            l="Fee Paid"
            v={
              player.acquisition_fee
                ? formatEur(player.acquisition_fee, true)
                : "—"
            }
          />
          <Row l="Year" v={player.acquisition_year ?? "—"} />
        </Card>

        {/* Contract extension */}
        {hasExtension || currentContract ? (
          <Card>
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              {hasExtension ? "Contract Extension" : "Contract Info"}
            </h2>
            {currentContract && (
              <>
                <Row l="Current Expiry" v={currentContract.expiry_year} />
                <Row
                  l="Current Salary"
                  v={
                    currentContract.annual_salary
                      ? formatEur(currentContract.annual_salary, true) + "/yr"
                      : "—"
                  }
                />
              </>
            )}
            {effectiveContract?.extension_applied && (
              <>
                <div className="my-2 h-px bg-border" />
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  Effective (with extension)
                </p>
                <Row l="New Expiry" v={effectiveContract.expiry_year} />
                <Row
                  l="New Salary"
                  v={
                    effectiveContract.annual_salary
                      ? formatEur(effectiveContract.annual_salary, true) + "/yr"
                      : "—"
                  }
                />
                <Row
                  l="Set by"
                  v={effectiveContract.extension_set_by?.replace("_", " ")}
                />
              </>
            )}
            {activeExtension && (
              <>
                <div className="my-2 h-px bg-border" />
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {activeExtension.visibility === "everyone"
                    ? "👥 Admin proposal"
                    : "🔒 Your proposal"}
                </p>
                <Row
                  l="New Expiry"
                  v={activeExtension.new_contract_expiry_year}
                />
                <Row
                  l="New Salary"
                  v={
                    activeExtension.new_annual_salary
                      ? formatEur(activeExtension.new_annual_salary, true) +
                        "/yr"
                      : "—"
                  }
                />
                <Row l="Starts" v={activeExtension.extension_start_year} />
                <Row
                  l="Signing Bonus"
                  v={
                    activeExtension.signing_bonus
                      ? formatEur(activeExtension.signing_bonus, true)
                      : "—"
                  }
                />
              </>
            )}
          </Card>
        ) : isAuthenticated ? (
          <Card className="flex flex-col items-center justify-center py-6 gap-3 border-dashed">
            <p className="text-sm text-muted-foreground">
              No contract extension yet
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setContractOpen(true)}
            >
              Propose Extension
            </Button>
          </Card>
        ) : null}
      </div>

      {/* Modals */}
      {isSdOrAdmin && (
        <OverrideModal
          open={overrideOpen}
          onClose={() => setOverrideOpen(false)}
          playerId={id}
          player={player}
        />
      )}

      {isAuthenticated && (
        <ContractModal
          open={contractOpen}
          onClose={() => setContractOpen(false)}
          playerId={id}
          existing={myExt}
        />
      )}
    </div>
  );
}
