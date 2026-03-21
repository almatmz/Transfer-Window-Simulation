"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { playersApi, CURRENT_SEASON } from "@/lib/api/client";
import { Button, Modal } from "@/components/ui";
import { friendlyError } from "@/lib/utils";

const inp =
  "w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
const lbl = (txt: string, req = false) => (
  <label className="block text-xs font-medium text-muted-foreground mb-1">
    {txt}
    {req && <span className="text-destructive ml-0.5">*</span>}
  </label>
);

interface Props {
  open: boolean;
  onClose: () => void;
  playerId: number;
  existing?: any;
}

export function ContractModal({ open, onClose, playerId, existing }: Props) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: {
      new_contract_expiry_year: existing?.new_contract_expiry_year ?? "",
      new_contract_length_years: existing?.new_contract_length_years ?? "",
      new_annual_salary: existing?.new_annual_salary ?? "",
      extension_start_year: existing?.extension_start_year ?? CURRENT_SEASON,
      signing_bonus: existing?.signing_bonus ?? 0,
      notes: existing?.notes ?? "",
    },
    mode: "onSubmit",
  });

  const deleteMutation = useMutation({
    mutationFn: () => playersApi.deleteContractExtension(playerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player-contracts", playerId] });
      toast.success("Extension removed");
      onClose();
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
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
      toast.error(friendlyError(e.message));
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl("New Expiry Year", true)}
            <input
              type="number"
              {...register("new_contract_expiry_year", { required: true })}
              placeholder="e.g. 2029"
              className={inp}
            />
          </div>
          <div>
            {lbl("Length (years)", true)}
            <input
              type="number"
              {...register("new_contract_length_years", { required: true })}
              placeholder="e.g. 4"
              className={inp}
            />
          </div>
          <div>
            {lbl("New Salary (€)")}
            <input
              type="number"
              {...register("new_annual_salary")}
              placeholder="optional"
              className={inp}
            />
          </div>
          <div>
            {lbl("Starts Year", true)}
            <input
              type="number"
              {...register("extension_start_year", { required: true })}
              className={inp}
            />
          </div>
          <div className="col-span-2">
            {lbl("Signing Bonus (€)")}
            <input
              type="number"
              {...register("signing_bonus")}
              placeholder="0"
              className={inp}
            />
          </div>
        </div>
        <div>
          {lbl("Notes")}
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          {existing && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Propose
          </Button>
        </div>
      </form>
    </Modal>
  );
}
