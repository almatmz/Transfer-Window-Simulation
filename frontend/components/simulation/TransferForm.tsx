"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Image from "next/image";
import { Search } from "lucide-react";
import { simulationsApi } from "@/lib/api/client";
import type { PlayerData } from "@/lib/api/client";
import { Button, Modal } from "@/components/ui";
import { formatEur, friendlyError } from "@/lib/utils";
import { PlayerPicker } from "./PlayerPicker";

interface Props {
  open: boolean;
  onClose: () => void;
  simId: string;
  tab: string;
  editIdx: number | null;
  editData: any;
  /** Club's own squad — used for sell/loan-out picker */
  clubSquad: PlayerData[];
}

export function TransferForm({
  open,
  onClose,
  simId,
  tab,
  editIdx,
  editData,
  clubSquad,
}: Props) {
  const qc = useQueryClient();
  const isEdit = editIdx !== null;
  const isBuy = tab === "buys",
    isSell = tab === "sells";
  const isLoanIn = tab === "loans_in",
    isLoanOut = tab === "loans_out";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: editData ?? {
      position: "",
      age: "",
      nationality: "",
      transfer_fee: "",
      loan_fee: "",
      loan_fee_received: "",
      annual_salary: "",
      contract_length_years: 1,
      wage_contribution_pct: 100,
      has_option_to_buy: false,
      has_option_to_sell: false,
    },
    mode: "onSubmit",
  });
  const hasOptBuy = watch("has_option_to_buy");
  const hasOptSell = watch("has_option_to_sell");
  const playerName = watch("player_name");

  // Check for duplicate in current list
  const existingList: any[] =
    !isEdit && (isBuy || isLoanIn)
      ? ((qc.getQueryData(["sim", simId]) as any)?.[
          isBuy ? "buys" : "loans_in"
        ] ?? [])
      : [];
  const isDuplicate =
    !isEdit &&
    !!playerName &&
    existingList.some(
      (e: any) =>
        e.player_name?.toLowerCase().trim() === playerName.toLowerCase().trim(),
    );

  const fillFromPlayer = (p: any) => {
    setValue("player_name", p.name);
    setValue("position", p.position || "");
    if (p.age) setValue("age", p.age);
    if (p.nationality) setValue("nationality", p.nationality);
    const sal = p.estimated_annual_salary ?? p.annual_salary;
    if (sal) setValue("annual_salary", sal);
    if (p.transfer_value && (isBuy || isSell))
      setValue("transfer_fee", p.transfer_value);
    if (p.api_football_id > 0)
      setValue("api_football_player_id", p.api_football_id);
    toast.success(`Auto-filled: ${p.name}`);
  };

  const n = (v: any) => (v === "" || v == null ? undefined : Number(v));
  const b = (v: any) => v === true || v === "true";

  const onSubmit = async (data: any) => {
    // Duplicate check — same player can't be bought/loaned-in twice
    if (!isEdit && (isBuy || isLoanIn)) {
      const existing = isBuy
        ? ((qc.getQueryData(["sim", simId]) as any)?.buys ?? [])
        : ((qc.getQueryData(["sim", simId]) as any)?.loans_in ?? []);
      const name = data.player_name?.toLowerCase().trim();
      const apiId = data.api_football_player_id
        ? Number(data.api_football_player_id)
        : null;
      const dupe = existing.find((e: any) => {
        if (apiId && e.api_football_player_id === apiId) return true;
        return e.player_name?.toLowerCase().trim() === name;
      });
      if (dupe) {
        toast.error(
          `${data.player_name} is already in your ${isBuy ? "buys" : "loans in"} list`,
        );
        return;
      }
    }
    try {
      if (isBuy) {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          age: n(data.age) ?? 0,
          nationality: data.nationality || "",
          transfer_fee: n(data.transfer_fee) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          contract_length_years: n(data.contract_length_years) ?? 1,
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editBuy(simId, editIdx!, body)
          : await simulationsApi.addBuy(simId, body);
      } else if (isSell) {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          transfer_fee: n(data.transfer_fee) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          contract_length_years: n(data.contract_length_years) ?? 1,
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editSell(simId, editIdx!, body)
          : await simulationsApi.addSell(simId, body);
      } else if (isLoanIn) {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          age: n(data.age) ?? 0,
          loan_fee: n(data.loan_fee) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          wage_contribution_pct: n(data.wage_contribution_pct) ?? 100,
          contract_length_years: n(data.contract_length_years) ?? 1,
          has_option_to_buy: b(data.has_option_to_buy),
          option_to_buy_fee: n(data.option_to_buy_fee),
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editLoanIn(simId, editIdx!, body)
          : await simulationsApi.addLoanIn(simId, body);
      } else {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          loan_fee_received: n(data.loan_fee_received) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          wage_contribution_pct: n(data.wage_contribution_pct) ?? 100,
          contract_length_years: n(data.contract_length_years) ?? 1,
          has_option_to_sell: b(data.has_option_to_sell),
          option_to_sell_fee: n(data.option_to_sell_fee),
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editLoanOut(simId, editIdx!, body)
          : await simulationsApi.addLoanOut(simId, body);
      }
      qc.invalidateQueries({ queryKey: ["sim", simId] });
      qc.removeQueries({ queryKey: ["sim-squad", simId] });
      toast.success(isEdit ? "Updated" : "Added");
      onClose();
    } catch (e: any) {
      toast.error(friendlyError(e.message));
    }
  };

  const title = isBuy
    ? "Buy"
    : isSell
      ? "Sell"
      : isLoanIn
        ? "Loan In"
        : "Loan Out";
  const inp =
    "w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? "Edit" : "Add"} ${title}`}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {/* Duplicate warning */}
        {isDuplicate && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400">
            <span className="shrink-0">⚠️</span>
            <span>
              <strong>{playerName}</strong> is already in your{" "}
              {isBuy ? "buys" : "loans in"} list.
            </span>
          </div>
        )}

        {/* Player search/selection */}
        {!isEdit && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">
              {isSell || isLoanOut
                ? "Pick from your club squad:"
                : "Search any club for an incoming player:"}
            </p>
            {(isSell || isLoanOut) && clubSquad.length > 0 ? (
              <SquadPicker players={clubSquad} onSelect={fillFromPlayer} />
            ) : (
              <PlayerPicker onSelect={fillFromPlayer} />
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Player Name *
            </label>
            <input
              {...register("player_name", { required: true })}
              placeholder="Player name"
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Position</label>
            <input
              {...register("position")}
              placeholder="e.g. Midfielder"
              className={inp}
            />
          </div>
          {(isBuy || isLoanIn) && (
            <div>
              <label className="block text-xs font-medium mb-1">Age</label>
              <input
                type="number"
                min="15"
                max="45"
                {...register("age")}
                className={inp}
              />
            </div>
          )}
          {isBuy && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Nationality
              </label>
              <input {...register("nationality")} className={inp} />
            </div>
          )}
          {(isBuy || isSell) && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Transfer Fee (€) *
              </label>
              <input
                type="number"
                min="0"
                {...register("transfer_fee")}
                placeholder="e.g. 50000000"
                className={inp}
              />
            </div>
          )}
          {isLoanIn && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Loan Fee (€)
              </label>
              <input
                type="number"
                min="0"
                {...register("loan_fee")}
                placeholder="0"
                className={inp}
              />
            </div>
          )}
          {isLoanOut && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Loan Fee Received (€)
              </label>
              <input
                type="number"
                min="0"
                {...register("loan_fee_received")}
                placeholder="0"
                className={inp}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1">
              Annual Salary (€)
            </label>
            <input
              type="number"
              min="0"
              {...register("annual_salary")}
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Contract Length (yrs)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              {...register("contract_length_years")}
              className={inp}
            />
          </div>
          {(isLoanIn || isLoanOut) && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Wage Contribution %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                {...register("wage_contribution_pct")}
                className={inp}
              />
            </div>
          )}
        </div>

        {isLoanIn && (
          <div className="space-y-2 p-3 bg-secondary/40 rounded-xl">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="optbuy"
                {...register("has_option_to_buy")}
                className="w-4 h-4 rounded accent-primary"
              />
              <label htmlFor="optbuy" className="text-sm">
                Option to buy
              </label>
            </div>
            {b(hasOptBuy) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Option Fee (€)
                  </label>
                  <input
                    type="number"
                    {...register("option_to_buy_fee")}
                    className={inp}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Option Year
                  </label>
                  <input
                    type="number"
                    {...register("option_to_buy_year")}
                    className={inp}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {isLoanOut && (
          <div className="space-y-2 p-3 bg-secondary/40 rounded-xl">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="optsell"
                {...register("has_option_to_sell")}
                className="w-4 h-4 rounded accent-primary"
              />
              <label htmlFor="optsell" className="text-sm">
                Option/obligation to sell
              </label>
            </div>
            {b(hasOptSell) && (
              <div>
                <label className="block text-xs font-medium mb-1">
                  Option Fee (€)
                </label>
                <input
                  type="number"
                  {...register("option_to_sell_fee")}
                  className={inp}
                />
              </div>
            )}
          </div>
        )}

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
            {isEdit ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Searchable list of the club's own squad players */
function SquadPicker({
  players,
  onSelect,
}: {
  players: PlayerData[];
  onSelect: (p: PlayerData) => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
      <input
        placeholder="Filter squad…"
        className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
        onChange={(e) => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll("[data-squad-player]").forEach((el) => {
            (el as HTMLElement).style.display = (
              el.getAttribute("data-squad-player") ?? ""
            )
              .toLowerCase()
              .includes(q)
              ? ""
              : "none";
          });
        }}
      />
      <div className="mt-1 border border-border rounded-xl overflow-y-auto max-h-44 divide-y divide-border/50">
        {players.slice(0, 40).map((p) => (
          <button
            key={(p as any).api_football_id ?? p.name}
            type="button"
            data-squad-player={p.name}
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary text-left transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-muted-foreground">
              {(p as any).photo_url ? (
                <Image
                  src={(p as any).photo_url}
                  alt={p.name}
                  width={28}
                  height={28}
                  className="object-cover rounded-full"
                  unoptimized
                />
              ) : (
                p.name?.[0]
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-xs">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.position}</p>
            </div>
            {((p as any).estimated_annual_salary ??
              (p as any).annual_salary) && (
              <span className="text-[10px] text-muted-foreground">
                {formatEur(
                  (p as any).estimated_annual_salary ??
                    (p as any).annual_salary,
                  true,
                )}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
