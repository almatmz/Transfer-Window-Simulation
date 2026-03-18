"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { simulationCreateSchema } from "@/lib/schemas";
import { simulationsApi } from "@/lib/api/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Input, Select, Modal } from "@/components/ui";

type FormData = z.infer<typeof simulationCreateSchema>;

interface Props {
  clubId: number;
  clubName: string;
  onClose: () => void;
  onCreated: (simId: string) => void;
}

export function SimulationCreateModal({
  clubId,
  clubName,
  onClose,
  onCreated,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(simulationCreateSchema),
    defaultValues: {
      club_api_football_id: clubId,
      window_type: "summer",
      season: "2025/26",
      is_public: false,
    },
  });

  const mut = useMutation({
    mutationFn: simulationsApi.create,
    onSuccess: (sim) => {
      toast.success("Simulation created!");
      onCreated(sim.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={`New Simulation — ${clubName}`}>
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">
        <input
          type="hidden"
          {...register("club_api_football_id", { valueAsNumber: true })}
        />
        <Input
          label="Simulation name"
          placeholder="e.g. Summer 2026 rebuild"
          error={errors.simulation_name?.message}
          {...register("simulation_name")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Window"
            options={[
              { value: "summer", label: "Summer" },
              { value: "winter", label: "Winter" },
            ]}
            {...register("window_type")}
          />
          <Input
            label="Season"
            placeholder="2025/26"
            error={errors.season?.message}
            {...register("season")}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="rounded"
            {...register("is_public")}
          />
          Make this simulation public
        </label>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Create Simulation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
