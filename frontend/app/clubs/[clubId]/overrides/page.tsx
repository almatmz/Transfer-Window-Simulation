"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  squadOverridesApi,
  searchApi,
  clubsApi,
  CURRENT_SEASON,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  PageLoader,
  ErrorMessage,
  Badge,
  Button,
  Card,
  Modal,
  Skeleton,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Settings,
  Search,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

// Reusable player-search-by-club component
function PlayerSearchField({ onSelect }: { onSelect: (p: any) => void }) {
  const [step, setStep] = useState<"club" | "player">("club");
  const [clubQ, setClubQ] = useState("");
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubLoading, setClubLoading] = useState(false);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerQ, setPlayerQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (clubQ.length < 2) {
      setClubs([]);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setClubLoading(true);
      try {
        setClubs(await searchApi.clubs(clubQ));
      } catch {
      } finally {
        setClubLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [clubQ]);

  const pickClub = async (club: any) => {
    setSelectedClub(club);
    setStep("player");
    setPlayerLoading(true);
    setOpen(true);
    try {
      const data = await clubsApi.squad(club.api_football_id, CURRENT_SEASON);
      const arr = data?.players ?? (Array.isArray(data) ? data : []);
      setPlayers(arr);
    } catch {
      setPlayers([]);
    } finally {
      setPlayerLoading(false);
    }
  };

  const filtered = playerQ
    ? players.filter((p: any) =>
        p.name?.toLowerCase().includes(playerQ.toLowerCase()),
      )
    : players;
  const reset = () => {
    setStep("club");
    setSelectedClub(null);
    setPlayers([]);
    setClubQ("");
    setPlayerQ("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {step === "club" ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={clubQ}
            onChange={(e) => {
              setClubQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search club to pick a player…"
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
          />
          {clubLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-medium text-primary shrink-0">
            {selectedClub?.logo_url && (
              <img
                src={selectedClub.logo_url}
                alt=""
                className="w-4 h-4 object-contain"
              />
            )}
            {selectedClub?.name}
            <button onClick={reset}>
              <X className="w-3 h-3 hover:text-destructive" />
            </button>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={playerQ}
              onChange={(e) => {
                setPlayerQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Filter by name…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}
      {open && step === "club" && clubs.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in max-h-48 overflow-y-auto">
          {clubs.slice(0, 8).map((c: any) => (
            <button
              key={c.api_football_id}
              type="button"
              onClick={() => pickClub(c)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary text-left"
            >
              {c.logo_url && (
                <img
                  src={c.logo_url}
                  alt=""
                  className="w-5 h-5 object-contain"
                />
              )}
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.country}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && step === "player" && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in max-h-60 overflow-y-auto">
          {playerLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : (
            filtered.slice(0, 12).map((p: any) => (
              <button
                key={p.api_football_id ?? p.name}
                type="button"
                onClick={() => {
                  onSelect(p);
                  reset();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary text-left"
              >
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-muted-foreground">
                  {p.photo_url ? (
                    <Image
                      src={p.photo_url}
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
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.position}
                    {p.age ? ` · ${p.age}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function SquadOverridesPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { role } = useAuth();
  const isSdOrAdmin = role === "sport_director" || role === "admin";
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["squad-overrides", id],
    queryFn: () => squadOverridesApi.list(id),
    enabled: !!id && isSdOrAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: (ovId: string) => squadOverridesApi.delete(ovId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squad-overrides", id] });
      toast.success("Override removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isSdOrAdmin)
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <Settings className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-semibold">Access restricted</p>
        <p className="text-sm mt-1">Sport Directors and Admins only</p>
        <Link
          href={`/clubs/${id}`}
          className="inline-block mt-4 text-primary text-sm hover:underline"
        >
          ← Back to club
        </Link>
      </div>
    );
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/clubs/${id}`}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Squad Overrides
          </h1>
          <p className="text-xs text-muted-foreground">
            {data?.length ?? 0} overrides · Manually add/remove players from the
            squad for specific seasons
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setAddOpen(true)}
        >
          Add Override
        </Button>
      </div>

      <div className="space-y-2">
        {data?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No overrides yet — use this to manually add or remove players from
            the squad
          </div>
        )}
        {data?.map((ov) => (
          <div
            key={ov.id}
            className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-2xl hover:border-primary/20 transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <Badge variant={ov.action === "add" ? "success" : "danger"}>
                  {ov.action.toUpperCase()}
                </Badge>
                <p className="font-semibold text-sm">{ov.player_name}</p>
                <Badge>{ov.position}</Badge>
                <Badge variant="info">Season {ov.season_year}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                By {ov.set_by_role} · {formatDate(ov.created_at)}
                {ov.notes && ` · ${ov.notes}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              className="text-muted-foreground hover:text-destructive"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`Remove override for ${ov.player_name}?`))
                  deleteMutation.mutate(ov.id);
              }}
            />
          </div>
        ))}
      </div>

      <AddOverrideModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clubId={id}
      />
    </div>
  );
}

function AddOverrideModal({
  open,
  onClose,
  clubId,
}: {
  open: boolean;
  onClose: () => void;
  clubId: number;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: {
      action: "add",
      season_year: CURRENT_SEASON,
      position: "Midfielder",
      is_on_loan: false,
    },
    mode: "onSubmit",
  });
  const action = watch("action");

  const handlePlayerPick = (p: any) => {
    if (p.name) setValue("player_name", p.name);
    if (p.position) setValue("position", p.position);
    if (p.age) setValue("age", p.age);
    if (p.nationality) setValue("nationality", p.nationality);
    if (p.annual_salary) setValue("annual_salary", p.annual_salary);
    if (p.transfer_value) setValue("transfer_value", p.transfer_value);
    if (p.contract_expiry_year)
      setValue("contract_expiry_year", p.contract_expiry_year);
    if (p.api_football_id)
      setValue("api_football_player_id", p.api_football_id);
    if (p.is_on_loan) setValue("is_on_loan", true);
    if (p.loan_from_club) setValue("loan_from_club", p.loan_from_club);
    toast.success(`Auto-filled: ${p.name}`);
  };

  const onSubmit = async (data: any) => {
    try {
      await squadOverridesApi.create(clubId, {
        action: data.action,
        season_year: parseInt(data.season_year),
        api_football_player_id: data.api_football_player_id
          ? parseInt(data.api_football_player_id)
          : null,
        player_name: data.player_name,
        position: data.position,
        age: data.age ? parseInt(data.age) : null,
        nationality: data.nationality,
        annual_salary: data.annual_salary ? parseFloat(data.annual_salary) : 0,
        transfer_value: data.transfer_value
          ? parseFloat(data.transfer_value)
          : 0,
        contract_expiry_year: data.contract_expiry_year
          ? parseInt(data.contract_expiry_year)
          : 0,
        is_on_loan: data.is_on_loan === true || data.is_on_loan === "true",
        loan_from_club: data.loan_from_club || null,
        notes: data.notes,
      });
      qc.invalidateQueries({ queryKey: ["squad-overrides", clubId] });
      qc.invalidateQueries({ queryKey: ["squad", clubId] });
      toast.success("Override added");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Squad Override" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Player search */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            Search a player to auto-fill (or fill manually)
          </p>
          <PlayerSearchField onSelect={handlePlayerPick} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Action</label>
            <select
              {...register("action")}
              className="w-full h-9 px-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="add">Add to squad</option>
              <option value="remove">Remove from squad</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Season Year
            </label>
            <input
              type="number"
              {...register("season_year")}
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Player Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("player_name", { required: true })}
              placeholder="Player name"
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Position</label>
            <input
              {...register("position")}
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Age</label>
            <input
              type="number"
              {...register("age")}
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {action === "add" && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Annual Salary (€)
                </label>
                <input
                  type="number"
                  {...register("annual_salary")}
                  className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Transfer Value (€)
                </label>
                <input
                  type="number"
                  {...register("transfer_value")}
                  className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Contract Expiry Year
                </label>
                <input
                  type="number"
                  {...register("contract_expiry_year")}
                  className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input
                  type="checkbox"
                  id="is_loan"
                  {...register("is_on_loan")}
                  className="w-4 h-4 rounded accent-primary"
                />
                <label htmlFor="is_loan" className="text-sm font-medium">
                  On loan
                </label>
                <input
                  {...register("loan_from_club")}
                  placeholder="From club (if on loan)"
                  className="flex-1 h-8 px-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
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
            Add Override
          </Button>
        </div>
      </form>
    </Modal>
  );
}
