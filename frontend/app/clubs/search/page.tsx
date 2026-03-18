"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/lib/api/client";
import { Card, Skeleton, EmptyState, Badge } from "@/components/ui";
import { Search, MapPin, Trophy, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  q: z.string().min(2, "Enter at least 2 characters"),
  country: z.string().optional(),
});
type F = z.infer<typeof schema>;

export default function ClubSearchPage() {
  const [params, setParams] = useState<{ q: string; country: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<F>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["clubs-search", params],
    queryFn: () =>
      params ? searchApi.clubs(params.q, params.country) : Promise.resolve([]),
    enabled: !!params,
    staleTime: 1000 * 60 * 30,
  });

  const onSubmit = (v: F) => setParams({ q: v.q, country: v.country || "" });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8 animate-fade-up">
        <h1 className="font-display font-bold text-2xl mb-1">Search Clubs</h1>
        <p className="text-sm text-muted-foreground">
          Find any football club to view squad, FFP, and simulations
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col sm:flex-row gap-2 mb-6 animate-fade-up"
        style={{ animationDelay: "0.05s" }}
        noValidate
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Club name, e.g. Manchester, Barcelona…"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
            {...register("q")}
          />
        </div>
        <input
          placeholder="Country"
          className="w-full sm:w-28 h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
          {...register("country")}
        />
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full sm:w-auto h-10 px-5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Search className="w-3.5 h-3.5" />
          Search
        </button>
      </form>
      {errors.q && (
        <p className="text-xs text-destructive mb-4 -mt-4">
          {errors.q.message}
        </p>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl"
            >
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive p-4 bg-destructive/5 rounded-xl border border-destructive/10">
          {(error as Error).message}
        </p>
      )}

      {data && !isLoading && (
        <>
          {data.length === 0 ? (
            <EmptyState
              icon={<Trophy className="w-8 h-8" />}
              title="No clubs found"
              description="Try a different name or country"
            />
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground mb-3">
                {data.length} result{data.length !== 1 ? "s" : ""}
              </p>
              {data.map((club, i) => (
                <Link
                  key={club.api_football_id}
                  href={`/clubs/${club.api_football_id}`}
                  className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all group animate-fade-up"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                    {club.logo_url ? (
                      <Image
                        src={club.logo_url}
                        alt={club.name}
                        width={36}
                        height={36}
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <Trophy className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {club.name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {club.country}
                      {club.league && (
                        <>
                          <span className="text-border">·</span>
                          {club.league}
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {!params && !isLoading && (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="Search for a club"
          description="Type a club name to get started. Results are cached for 30 minutes."
        />
      )}
    </div>
  );
}
