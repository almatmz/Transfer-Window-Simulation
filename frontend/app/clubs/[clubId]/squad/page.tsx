"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  clubsApi,
  squadOverridesApi,
  searchApi,
  CURRENT_SEASON,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  ErrorMessage,
  PositionBadge,
  Skeleton,
  Button,
  Modal,
  Badge,
} from "@/components/ui";
import { formatEur } from "@/lib/utils";
import {
  Users,
  Lock,
  ArrowLeft,
  AlertCircle,
  Plus,
  Trash2,
  Settings,
  Search,
  Loader2,
  X,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const POS_ORDER = [
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Attacker",
  "Unknown",
];

function extractPlayers(data: any): { players: any[]; expired: any[] } {
  if (!data) return { players: [], expired: [] };
  if (Array.isArray(data))
    return { players: dedupe(normalizePlayers(data)), expired: [] };
  const playerKeys = [
    "players",
    "squad",
    "results",
    "data",
    "items",
    "members",
  ];
  const expiredKeys = ["expired_contracts", "expired", "expired_players"];
  for (const key of playerKeys) {
    if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
      const expiredArr = expiredKeys.reduce<any[]>(
        (acc, k) => (data[k] && Array.isArray(data[k]) ? data[k] : acc),
        [],
      );
      return {
        players: dedupe(normalizePlayers(data[key])),
        expired: normalizePlayers(expiredArr),
      };
    }
  }
  let bestKey = "",
    bestLen = 0,
    expiredArr: any[] = [];
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) {
      if (expiredKeys.includes(key)) expiredArr = data[key];
      else if ((data[key] as any[]).length > bestLen) {
        bestLen = (data[key] as any[]).length;
        bestKey = key;
      }
    }
  }
  if (bestKey)
    return {
      players: dedupe(normalizePlayers(data[bestKey])),
      expired: normalizePlayers(expiredArr),
    };
  return { players: [], expired: [] };
}

// Deduplicate by internal id and api_football_id (backend sometimes returns players twice)
function dedupe(arr: any[]): any[] {
  const seenIds = new Set<string>();
  const seenApiIds = new Set<number>();
  return arr.filter((p) => {
    const id = p.id as string;
    const apiId = p.api_football_id as number;
    // For override players with api_football_id=0, dedupe by internal id only
    if (id) {
      if (seenIds.has(id)) return false;
      seenIds.add(id);
    }
    // For regular players, also dedupe by api_football_id
    if (apiId && apiId > 0) {
      if (seenApiIds.has(apiId)) return false;
      seenApiIds.add(apiId);
    }
    return true;
  });
}

function normalizePlayers(arr: any[]): any[] {
  if (!arr?.length) return [];
  return arr.map((p: any) => ({
    ...p,
    annual_salary: p.annual_salary ?? p.estimated_annual_salary ?? null,
    transfer_value: p.transfer_value ?? p.market_value ?? null,
    position: normalizePosition(p.position),
    is_on_loan: p.is_on_loan ?? false,
    loaned_out: p.loaned_out ?? false,
  }));
}

function normalizePosition(pos: string | null | undefined): string {
  if (!pos) return "Unknown";
  const p = pos.toUpperCase().trim();
  if (["GK", "GOALKEEPER", "PORTERO"].includes(p)) return "Goalkeeper";
  if (
    [
      "CB",
      "LB",
      "RB",
      "LWB",
      "RWB",
      "DF",
      "DEFENDER",
      "BACK",
      "CENTRE-BACK",
      "CENTRE BACK",
    ].includes(p)
  )
    return "Defender";
  if (
    [
      "CM",
      "CDM",
      "CAM",
      "DM",
      "AM",
      "MF",
      "MIDFIELDER",
      "MIDFIELD",
      "LM",
      "RM",
    ].includes(p)
  )
    return "Midfielder";
  if (
    [
      "ST",
      "CF",
      "LW",
      "RW",
      "FW",
      "SS",
      "FORWARD",
      "ATTACKER",
      "STRIKER",
      "WINGER",
    ].includes(p)
  )
    return "Attacker";
  if (["GOALKEEPER", "DEFENDER", "MIDFIELDER", "ATTACKER"].includes(p))
    return p.charAt(0) + p.slice(1).toLowerCase();
  return pos;
}

//  Player Search By Club
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
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
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
      setPlayers(data?.players ?? (Array.isArray(data) ? data : []));
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
            placeholder="Search any club to pick a player…"
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
            <button type="button" onClick={reset}>
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
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in max-h-52 overflow-y-auto">
          {clubs.slice(0, 8).map((c: any) => (
            <button
              key={c.api_football_id}
              type="button"
              onClick={() => pickClub(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary text-left transition-colors"
            >
              {c.logo_url && (
                <img
                  src={c.logo_url}
                  alt=""
                  className="w-5 h-5 object-contain shrink-0"
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
      )}
      {open && step === "player" && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in max-h-64 overflow-y-auto">
          {playerLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading squad…
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No players found
            </p>
          ) : (
            filtered.slice(0, 15).map((p: any) => (
              <button
                key={p.api_football_id ?? p.name}
                type="button"
                onClick={() => {
                  onSelect(p);
                  reset();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-muted-foreground">
                  {p.photo_url ? (
                    <Image
                      src={p.photo_url}
                      alt={p.name}
                      width={32}
                      height={32}
                      className="object-cover rounded-full"
                      unoptimized
                    />
                  ) : (
                    p.name?.[0]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.position}
                    {p.age ? ` · Age ${p.age}` : ""}
                    {p.nationality ? ` · ${p.nationality}` : ""}
                  </p>
                </div>
                {p.transfer_value && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatEur(p.transfer_value, true)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

//  Add Player Modal
function AddPlayerModal({
  open,
  onClose,
  clubId,
  clubName,
  season,
}: {
  open: boolean;
  onClose: () => void;
  clubId: number;
  clubName?: string;
  season: number;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: {
      season_year: season,
      position: "Midfielder",
      loan_status: "none", // 'none' | 'loaned_out' | 'loan_in'
      annual_salary: "",
      transfer_value: "",
      contract_expiry_year: "",
      age: "",
    },
    mode: "onSubmit",
  });

  const loanStatus = watch("loan_status");

  const handlePick = (p: any) => {
    if (p.name) setValue("player_name", p.name);
    if (p.position) setValue("position", p.position);
    if (p.age) setValue("age", p.age);
    if (p.nationality) setValue("nationality", p.nationality);
    const sal = p.estimated_annual_salary ?? p.annual_salary;
    if (sal) setValue("annual_salary", sal);
    if (p.transfer_value) setValue("transfer_value", p.transfer_value);
    if (p.contract_expiry_year)
      setValue("contract_expiry_year", p.contract_expiry_year);
    if (p.api_football_id && p.api_football_id > 0)
      setValue("api_football_player_id", p.api_football_id);
    // Do NOT auto-fill loan info — user picks the club context themselves
    toast.success(`Auto-filled: ${p.name} — set loan status below if needed`);
  };

  const onSubmit = async (data: any) => {
    const isLoanIn = data.loan_status === "loan_in"; // Someone else's player on loan HERE
    const isLoanOut = data.loan_status === "loaned_out"; // OUR player loaned OUT to another club
    try {
      await squadOverridesApi.create(clubId, {
        action: "add",
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
        is_on_loan: isLoanIn, // true only if coming IN on loan
        loan_from_club: isLoanIn ? data.loan_from_club : null,
        notes:
          [data.notes, isLoanOut ? `Loaned out to: ${data.loaned_out_to}` : ""]
            .filter(Boolean)
            .join(" | ") || "",
      });
      qc.removeQueries({ queryKey: ["squad", clubId] });
      toast.success(`${data.player_name} added to squad`);
      reset();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const inputCls =
    "w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <Modal open={open} onClose={onClose} title="Add Player to Squad" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Player search */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            Search any club to pick a player and auto-fill their details
          </p>
          <PlayerSearchField onSelect={handlePick} />
        </div>

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Player Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("player_name", { required: true })}
              placeholder="Full name"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Position</label>
            <select
              {...register("position")}
              className="w-full h-9 px-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {["Goalkeeper", "Defender", "Midfielder", "Attacker"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Season Year
            </label>
            <input
              type="number"
              {...register("season_year")}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Age</label>
            <input
              type="number"
              {...register("age")}
              placeholder="e.g. 18"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Nationality
            </label>
            <input
              {...register("nationality")}
              placeholder="e.g. Brazilian"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Annual Salary (€)
            </label>
            <input
              type="number"
              {...register("annual_salary")}
              placeholder="e.g. 6000000"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Transfer Value (€)
            </label>
            <input
              type="number"
              {...register("transfer_value")}
              placeholder="e.g. 80000000"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Contract Expiry Year
            </label>
            <input
              type="number"
              {...register("contract_expiry_year")}
              placeholder="e.g. 2029"
              className={inputCls}
            />
          </div>
        </div>

        {/* Loan status — clear 3-way picker */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-foreground">
            Loan Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                value: "none",
                label: "✅ Owns player",
                desc: "No loan involved",
              },
              {
                value: "loaned_out",
                label: "📤 Loaned OUT",
                desc: `${clubName ?? "Club"} owns, player is away`,
              },
              {
                value: "loan_in",
                label: "📥 Loan IN",
                desc: "Borrowed from another club",
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex flex-col gap-0.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  loanStatus === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <input
                  type="radio"
                  {...register("loan_status")}
                  value={opt.value}
                  className="sr-only"
                />
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {opt.desc}
                </span>
              </label>
            ))}
          </div>

          {/* Loaned OUT — player belongs here but is at another club */}
          {loanStatus === "loaned_out" && (
            <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl space-y-2">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                Player is registered in {clubName ?? "this club"}'s squad but
                currently playing at another club on loan.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Currently loaned out to
                </label>
                <input
                  {...register("loaned_out_to")}
                  placeholder="e.g. Olympique Lyon"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Loan IN — player comes from another club */}
          {loanStatus === "loan_in" && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Player is owned by another club and is playing here on loan.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1">
                  On loan from
                </label>
                <input
                  {...register("loan_from_club")}
                  placeholder="e.g. FC Barcelona"
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="Any additional notes…"
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
          <Button
            type="submit"
            className="flex-1"
            loading={isSubmitting}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add to Squad
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Main Squad Page
export default function SquadPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { role } = useAuth();
  const qc = useQueryClient();
  const isSdOrAdmin = role === "sport_director" || role === "admin";
  const [viewSeason, setViewSeason] = useState(CURRENT_SEASON);
  const [posFilter, setPosFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);

  const {
    data: rawData,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["squad", id, viewSeason],
    queryFn: () => clubsApi.squad(id, viewSeason),
    enabled: !!id,
    staleTime: 0, // always refetch — squad changes must show immediately
    gcTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Also load overrides list so we can show remove buttons on override-added players
  const { data: overrides } = useQuery({
    queryKey: ["squad-overrides", id],
    queryFn: () => squadOverridesApi.list(id),
    enabled: !!id && isSdOrAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (ovId: string) => squadOverridesApi.delete(ovId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["squad", id] });
      qc.invalidateQueries({ queryKey: ["squad-overrides", id] });
      toast.success("Player removed from squad");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Quick remove: create a "remove" override for a regular squad player
  const quickRemoveMutation = useMutation({
    mutationFn: ({
      playerId,
      playerName,
    }: {
      playerId: number;
      playerName: string;
    }) =>
      squadOverridesApi.create(id, {
        action: "remove",
        season_year: viewSeason,
        api_football_player_id: playerId,
        player_name: playerName,
      }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["squad", id] });
      qc.invalidateQueries({ queryKey: ["squad-overrides", id] });
      toast.success("Player removed from squad for this season");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Reset: delete ALL my overrides for this club
  const resetMutation = useMutation({
    mutationFn: async () => {
      // Fetch fresh overrides list
      const fresh = await squadOverridesApi.list(id);
      const active = fresh.filter((o: any) => o.is_active);

      // Also collect override IDs directly from squad players in rawData
      // (backend embeds the override doc _id as player.id for squad_override players)
      const squadData = rawData as any;
      const extraIds: string[] = [];
      const allPlayers: any[] = [
        ...(squadData?.players ?? []),
        ...(squadData?.admin_additions ?? []),
      ];
      allPlayers.forEach((p: any) => {
        if (
          p.data_source?.startsWith("squad_override") &&
          p.id &&
          !active.find((o: any) => o.id === p.id)
        ) {
          extraIds.push(p.id);
        }
      });

      const totalIds = [...active.map((o: any) => o.id), ...extraIds];

      if (totalIds.length === 0) throw new Error("no_overrides");

      // Delete all — some may 404 if already gone, ignore those errors
      const results = await Promise.allSettled(
        totalIds.map((oid) => squadOverridesApi.delete(oid)),
      );
      const deleted = results.filter((r) => r.status === "fulfilled").length;
      return deleted;
    },
    onSuccess: (count: number) => {
      qc.removeQueries({ queryKey: ["squad", id] });
      qc.removeQueries({ queryKey: ["squad-overrides", id] });
      toast.success(`Reset ${count} squad override${count !== 1 ? "s" : ""}`);
    },
    onError: (e: any) => {
      if (e.message === "no_overrides") toast("No overrides found to reset");
      else toast.error(e.message);
    },
  });

  const { players, expired } = extractPlayers(rawData);

  // Build lookup maps: override api_football_id -> override doc _id, and name -> override doc _id
  const addOverrideByPlayerId = new Map<number, string>();
  const addOverrideByName = new Map<string, string>();
  overrides
    ?.filter((o) => o.action === "add" && o.is_active)
    .forEach((o) => {
      if (o.api_football_player_id && o.api_football_player_id > 0)
        addOverrideByPlayerId.set(o.api_football_player_id, o.id);
      if (o.player_name)
        addOverrideByName.set(o.player_name.toLowerCase().trim(), o.id);
    });

  const allPositions = [
    "All",
    ...POS_ORDER.filter((p) =>
      players.some((pl: any) => (pl.position || "Unknown") === p),
    ),
  ];
  const filtered =
    posFilter === "All"
      ? players
      : players.filter((p: any) => (p.position || "Unknown") === posFilter);
  const byPos: Record<string, any[]> = {};
  filtered.forEach((p: any) => {
    const pos = p.position || "Unknown";
    if (!byPos[pos]) byPos[pos] = [];
    byPos[pos].push(p);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/clubs/${id}`}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Squad
            {isFetching && !isLoading && (
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            Season {viewSeason}/{String(viewSeason + 1).slice(2)} ·{" "}
            {players.length} players
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={viewSeason}
            onChange={(e) => setViewSeason(Number(e.target.value))}
            className="h-8 px-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {Array.from({ length: 6 }, (_, i) => CURRENT_SEASON + i).map(
              (y) => (
                <option key={y} value={y}>
                  {y}/{String(y + 1).slice(2)}
                </option>
              ),
            )}
          </select>
          {isSdOrAdmin && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                loading={resetMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      "Reset all your squad overrides for this club? This cannot be undone.",
                    )
                  )
                    resetMutation.mutate();
                }}
              >
                Reset
              </Button>
              <Button
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setAddOpen(true)}
              >
                Add Player
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Position filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {allPositions.map((pos) => (
          <button
            key={pos}
            onClick={() => setPosFilter(pos)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              posFilter === pos
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {pos}
          </button>
        ))}
      </div>

      {!isSdOrAdmin && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Salary data is estimated (Capology). Sport Directors & Admins see
          verified salaries.
        </div>
      )}

      {/* Skeletons */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(11)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
            >
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-10 rounded" />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorMessage message={(error as Error).message} />}

      {!isLoading && !error && players.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No players found</p>
          <p className="text-xs mt-1">
            The backend may still be syncing. Go back to club and trigger a
            sync.
          </p>
        </div>
      )}

      {/* Players grouped by position */}
      {!isLoading &&
        !error &&
        POS_ORDER.map((pos) => {
          const group = byPos[pos];
          if (!group?.length) return null;
          return (
            <div key={pos}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                {pos}s ({group.length})
                <span className="h-px flex-1 bg-border" />
              </h3>
              <div className="space-y-1">
                {group.map((p: any) => {
                  // Detect if this player is an override addition
                  const isOverride =
                    p.api_football_id === 0 ||
                    p.data_source?.startsWith("squad_override") ||
                    addOverrideByName.has(p.name?.toLowerCase()?.trim()) ||
                    (p.api_football_id > 0 &&
                      addOverrideByPlayerId.has(p.api_football_id));
                  const overrideId =
                    (p.api_football_id > 0
                      ? addOverrideByPlayerId.get(p.api_football_id)
                      : undefined) ??
                    addOverrideByName.get(p.name?.toLowerCase()?.trim());
                  const playerHref =
                    p.api_football_id && p.api_football_id > 0
                      ? `/players/${p.api_football_id}`
                      : null;

                  const inner = (
                    <div
                      className={cn(
                        "flex items-center gap-3 p-3 bg-card border rounded-xl transition-all",
                        playerHref
                          ? "hover:border-primary/30 hover:shadow-sm cursor-pointer"
                          : "cursor-default",
                        isOverride
                          ? "border-violet-500/30 bg-violet-500/5"
                          : "border-border",
                      )}
                    >
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                        {p.photo_url ? (
                          <Image
                            src={p.photo_url}
                            alt={p.name}
                            width={36}
                            height={36}
                            className="object-cover rounded-full"
                            unoptimized
                          />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">
                            {p.name?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.is_on_loan && (
                            <span className="loan-badge">LOAN IN</span>
                          )}
                          {p.loaned_out && (
                            <span className="loan-badge">LOANED OUT</span>
                          )}
                          {isOverride && (
                            <Badge
                              variant="violet"
                              className="text-[10px] py-0"
                            >
                              Override
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.nationality}
                          {p.age ? ` · Age ${p.age}` : ""}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-medium">
                            {p.annual_salary ? (
                              formatEur(p.annual_salary, true) + "/yr"
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.contract_expiry_year
                              ? `Exp. ${p.contract_expiry_year}`
                              : "No contract"}
                          </p>
                        </div>
                        <PositionBadge position={p.position} />
                      </div>
                      <div className="flex sm:hidden">
                        <PositionBadge position={p.position} />
                      </div>

                      {/* Remove button for SD/Admin */}
                      {isSdOrAdmin && (
                        <button
                          type="button"
                          title="Remove from squad"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              !confirm(
                                `Remove ${p.name} from the squad for ${viewSeason}/${String(viewSeason + 1).slice(2)}?`,
                              )
                            )
                              return;

                            // Case 1: Player was added via squad override — delete the override doc directly
                            // The player.id IS the override document _id in this case
                            if (
                              p.data_source?.startsWith("squad_override") &&
                              p.id
                            ) {
                              removeOverrideMutation.mutate(p.id);
                            }
                            // Case 2: Player looked up via overrides list
                            else if (overrideId) {
                              removeOverrideMutation.mutate(overrideId);
                            }
                            // Case 3: Regular API player — create a "remove" override
                            else if (
                              p.api_football_id &&
                              p.api_football_id > 0
                            ) {
                              quickRemoveMutation.mutate({
                                playerId: p.api_football_id,
                                playerName: p.name,
                              });
                            } else {
                              toast.error(
                                "Cannot remove this player — no API ID found",
                              );
                            }
                          }}
                          className="ml-1 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );

                  return (
                    <div
                      key={p.id ?? p.api_football_id ?? p.name}
                      className="group"
                    >
                      {playerHref ? (
                        <Link href={playerHref}>{inner}</Link>
                      ) : (
                        inner
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* Expired contracts */}
      {!isLoading && expired.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            Contract expired before {viewSeason} ({expired.length})
            <span className="h-px flex-1 bg-border" />
          </h3>
          <div className="space-y-1 opacity-50">
            {expired.map((p: any) => (
              <div
                key={p.api_football_id ?? p.name}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
              >
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">
                    {p.name?.[0]}
                  </span>
                </div>
                <p className="text-sm line-through text-muted-foreground flex-1">
                  {p.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Exp. {p.contract_expiry_year}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddPlayerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clubId={id}
        clubName={(rawData as any)?.club_name}
        season={viewSeason}
      />
    </div>
  );
}
