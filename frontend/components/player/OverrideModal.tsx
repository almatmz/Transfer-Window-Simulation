"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Trash2, Shield } from "lucide-react";
import { playersApi } from "@/lib/api/client";
import { Button, Modal } from "@/components/ui";
import { friendlyError } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

const inpSm =
  "w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
const L = ({ t }: { t: string }) => (
  <label className="block text-xs font-medium text-muted-foreground mb-1">
    {t}
  </label>
);

interface Props {
  open: boolean;
  onClose: () => void;
  playerId: number;
  player: any;
  clubId?: number;
}

export function OverrideModal({
  open,
  onClose,
  playerId,
  player,
  clubId,
}: Props) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: {
      position: player.position ?? "",
      nationality: player.nationality ?? "",
      age: player.age ?? "",
      annual_salary:
        player.annual_salary ?? player.estimated_annual_salary ?? "",
      transfer_value: player.transfer_value ?? "",
      contract_expiry_year: player.contract_expiry_year ?? "",
      contract_length_years: player.contract_length_years ?? "",
      acquisition_fee: player.acquisition_fee ?? "",
      acquisition_year: player.acquisition_year ?? "",
      loan_status: player.is_on_loan
        ? "loan_in"
        : player.loaned_out
          ? "loaned_out"
          : "none",
      // Loan In fields
      loan_from_club: player.loan_from_club ?? "",
      loan_start_date: player.loan_start_date ?? "",
      loan_end_date: player.loan_end_date ?? "",
      loan_fee: player.loan_fee ?? "",
      loan_wage_contribution_pct: player.loan_wage_contribution_pct ?? "",
      loan_option_to_buy: player.loan_option_to_buy ?? false,
      loan_option_to_buy_fee: player.loan_option_to_buy_fee ?? "",
      // Loaned Out fields
      loaned_out_to_club: player.loaned_out_to_club ?? "",
      loaned_out_start_date: player.loaned_out_start_date ?? "",
      loaned_out_end_date: player.loaned_out_end_date ?? "",
      loaned_out_fee: player.loaned_out_fee ?? "",
      loaned_out_wage_contribution_pct:
        player.loaned_out_wage_contribution_pct ?? "",
      loaned_out_option_to_buy: player.loaned_out_option_to_buy ?? false,
      loaned_out_option_to_buy_fee: player.loaned_out_option_to_buy_fee ?? "",
      notes: "",
    },
    mode: "onSubmit",
  });

  const loanStatus = watch("loan_status");
  const hasLoanOpt = watch("loan_option_to_buy");
  const hasLoanOutOpt = watch("loaned_out_option_to_buy");

  const deleteMutation = useMutation({
    mutationFn: () => playersApi.deleteOverride(playerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player", playerId] });
      qc.invalidateQueries({ queryKey: ["player-loans", playerId] });
      if (clubId) {
        qc.invalidateQueries({ queryKey: ["squad", clubId] });
        qc.invalidateQueries({ queryKey: ["squad-overrides", clubId] });
      }
      toast.success("Override removed");
      onClose();
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  const onSubmit = async (data: any) => {
    const n = (v: any) => (v === "" || v == null ? undefined : Number(v));
    const s = (v: any) => (v === "" ? undefined : v);
    const b = (v: any) => v === true || v === "true";

    const body: any = {
      position: s(data.position),
      nationality: s(data.nationality),
      age: n(data.age),
      annual_salary: n(data.annual_salary),
      transfer_value: n(data.transfer_value),
      contract_expiry_year: n(data.contract_expiry_year),
      contract_length_years: n(data.contract_length_years),
      acquisition_fee: n(data.acquisition_fee),
      acquisition_year: n(data.acquisition_year),
      notes: s(data.notes),
    };

    // Loan status
    if (data.loan_status === "loan_in") {
      body.is_on_loan = true;
      body.loaned_out = false;
      body.loan_from_club = s(data.loan_from_club);
      body.loan_start_date = s(data.loan_start_date);
      body.loan_end_date = s(data.loan_end_date);
      body.loan_fee = n(data.loan_fee);
      body.loan_wage_contribution_pct = n(data.loan_wage_contribution_pct);
      body.loan_option_to_buy = b(data.loan_option_to_buy);
      body.loan_option_to_buy_fee = b(data.loan_option_to_buy)
        ? n(data.loan_option_to_buy_fee)
        : null;
    } else if (data.loan_status === "loaned_out") {
      body.is_on_loan = false;
      body.loaned_out = true;
      body.loaned_out_to_club = s(data.loaned_out_to_club);
      body.loaned_out_start_date = s(data.loaned_out_start_date);
      body.loaned_out_end_date = s(data.loaned_out_end_date);
      body.loaned_out_fee = n(data.loaned_out_fee);
      body.loaned_out_wage_contribution_pct = n(
        data.loaned_out_wage_contribution_pct,
      );
      body.loaned_out_option_to_buy = b(data.loaned_out_option_to_buy);
      body.loaned_out_option_to_buy_fee = b(data.loaned_out_option_to_buy)
        ? n(data.loaned_out_option_to_buy_fee)
        : null;
    } else {
      body.is_on_loan = false;
      body.loaned_out = false;
    }

    // Remove undefined
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    try {
      await playersApi.setOverride(playerId, body);
      qc.invalidateQueries({ queryKey: ["player", playerId] });
      qc.invalidateQueries({ queryKey: ["player-loans", playerId] });
      if (clubId) {
        qc.invalidateQueries({ queryKey: ["squad", clubId] });
        qc.invalidateQueries({ queryKey: ["squad-overrides", clubId] });
      }
      toast.success("Player data updated");
      onClose();
    } catch (e: any) {
      toast.error(friendlyError(e.message));
    }
  };

  const F = ({
    l,
    name,
    type = "text",
    ph,
  }: {
    l: string;
    name: string;
    type?: string;
    ph?: string;
  }) => (
    <div>
      <L t={l} />
      <input
        type={type}
        placeholder={ph}
        {...register(name)}
        className={inpSm}
      />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Edit Player Data" size="md">
      <div className="space-y-4">
        {!isAdmin && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400">
            <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Your changes are private — only visible to you. Admin changes are
            visible to all users.
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* Identity */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Identity
            </p>
            <div className="grid grid-cols-3 gap-2">
              <F l="Position" name="position" ph="e.g. Defender" />
              <F l="Age" name="age" type="number" />
              <F l="Nationality" name="nationality" ph="e.g. Spanish" />
            </div>
          </section>

          {/* Financials */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Financials
            </p>
            <div className="grid grid-cols-2 gap-2">
              <F
                l="Annual Salary (€)"
                name="annual_salary"
                type="number"
                ph="e.g. 5000000"
              />
              <F
                l="Transfer Value (€)"
                name="transfer_value"
                type="number"
                ph="e.g. 40000000"
              />
              <F l="Acquisition Fee (€)" name="acquisition_fee" type="number" />
              <F
                l="Acquisition Year"
                name="acquisition_year"
                type="number"
                ph="e.g. 2022"
              />
            </div>
          </section>

          {/* Contract */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Contract
            </p>
            <div className="grid grid-cols-2 gap-2">
              <F
                l="Expiry Year"
                name="contract_expiry_year"
                type="number"
                ph="e.g. 2028"
              />
              <F
                l="Length (years)"
                name="contract_length_years"
                type="number"
                ph="e.g. 4"
              />
            </div>
          </section>

          {/* Loan Status — 3-way picker */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Loan Status
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                {
                  value: "none",
                  icon: "✅",
                  label: "In Team",
                  desc: "No loan",
                },
                {
                  value: "loan_in",
                  icon: "📥",
                  label: "Loan In",
                  desc: "Arriving from club",
                },
                {
                  value: "loaned_out",
                  icon: "📤",
                  label: "Loaned Out",
                  desc: "Sent to club",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex flex-col gap-0.5 p-2.5 rounded-xl border cursor-pointer transition-all text-center",
                    loanStatus === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <input
                    type="radio"
                    {...register("loan_status")}
                    value={opt.value}
                    className="sr-only"
                  />
                  <span className="text-xs font-semibold">
                    {opt.icon} {opt.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {opt.desc}
                  </span>
                </label>
              ))}
            </div>

            {/* Loan In fields */}
            {loanStatus === "loan_in" && (
              <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  📥 Loan In Details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <F
                      l="From Club"
                      name="loan_from_club"
                      ph="e.g. Real Madrid"
                    />
                  </div>
                  <F l="Start Date" name="loan_start_date" type="date" />
                  <F l="End Date" name="loan_end_date" type="date" />
                  <F
                    l="Loan Fee (€)"
                    name="loan_fee"
                    type="number"
                    ph="0 = free"
                  />
                  <F
                    l="Wage Contribution %"
                    name="loan_wage_contribution_pct"
                    type="number"
                    ph="e.g. 100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="loanOpt"
                    {...register("loan_option_to_buy")}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <label htmlFor="loanOpt" className="text-xs font-medium">
                    Option to buy
                  </label>
                </div>
                {hasLoanOpt && (
                  <F
                    l="Option to Buy Fee (€)"
                    name="loan_option_to_buy_fee"
                    type="number"
                  />
                )}
              </div>
            )}

            {/* Loaned Out fields */}
            {loanStatus === "loaned_out" && (
              <div className="p-3 bg-orange-500/5 border border-orange-500/15 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                  📤 Loaned Out Details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <F
                      l="To Club"
                      name="loaned_out_to_club"
                      ph="e.g. Olympique Lyon"
                    />
                  </div>
                  <F l="Start Date" name="loaned_out_start_date" type="date" />
                  <F l="End Date" name="loaned_out_end_date" type="date" />
                  <F
                    l="Fee Received (€)"
                    name="loaned_out_fee"
                    type="number"
                    ph="0 = free"
                  />
                  <F
                    l="Wage Contribution %"
                    name="loaned_out_wage_contribution_pct"
                    type="number"
                    ph="e.g. 52"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="loanOutOpt"
                    {...register("loaned_out_option_to_buy")}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <label htmlFor="loanOutOpt" className="text-xs font-medium">
                    Option/obligation to buy back
                  </label>
                </div>
                {hasLoanOutOpt && (
                  <F
                    l="Option Fee (€)"
                    name="loaned_out_option_to_buy_fee"
                    type="number"
                  />
                )}
              </div>
            )}
          </section>

          {/* Notes */}
          <div>
            <L t="Notes" />
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Optional note…"
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
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
              <Trash2 className="w-3.5 h-3.5" />
              Remove Override
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
