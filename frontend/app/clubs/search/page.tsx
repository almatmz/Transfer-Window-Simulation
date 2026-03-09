"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/lib/api/client";
import {
  Input,
  Button,
  Card,
  Skeleton,
  ErrorMessage,
  EmptyState,
} from "@/components/ui";
import { Search, MapPin, Trophy } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { searchSchema } from "@/lib/schemas";
import { z } from "zod";
import type { ClubSearchResult } from "@/lib/api/types";

type FormData = z.infer<typeof searchSchema>;

export default function ClubSearchPage() {
  const [searchParams, setSearchParams] = useState<{
    q: string;
    country: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(searchSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clubs-search", searchParams],
    queryFn: () =>
      searchParams
        ? searchApi.clubs(searchParams.q, searchParams.country)
        : Promise.resolve([]),
    enabled: !!searchParams,
  });

  const onSubmit = (values: FormData) => {
    setSearchParams({ q: values.q, country: values.country || "" });
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-display font-black mb-2">
            Search Clubs
          </h1>
          <p className="text-muted-foreground">
            Find any football club to view squad and FFP data
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 mb-8">
          <div className="flex-1">
            <Input
              placeholder="Club name, e.g. Manchester, Barcelona…"
              error={errors.q?.message}
              {...register("q")}
            />
          </div>
          <div className="w-36">
            <Input placeholder="Country (opt.)" {...register("country")} />
          </div>
          <Button type="submit" loading={isLoading}>
            <Search className="w-4 h-4" />
            Search
          </Button>
        </form>

        {/* Results */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl"
              >
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <ErrorMessage
            message={(error as Error).message}
            onRetry={() => refetch()}
          />
        )}

        {data && !isLoading && (
          <>
            {data.length === 0 ? (
              <EmptyState
                icon={<Trophy className="w-7 h-7" />}
                title="No clubs found"
                description="Try a different name or country filter"
              />
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  {data.length} results
                </p>
                <AnimatePresence>
                  {data.map((club: ClubSearchResult, i: number) => (
                    <motion.div
                      key={club.api_football_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link href={`/clubs/${club.api_football_id}`}>
                        <Card hover className="flex items-center gap-4 p-4">
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {club.logo_url ? (
                              <Image
                                src={club.logo_url}
                                alt={club.name}
                                width={40}
                                height={40}
                                className="object-contain"
                                unoptimized
                              />
                            ) : (
                              <Trophy className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-bold truncate">
                              {club.name}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {club.country}
                              {club.league && (
                                <span className="text-muted-foreground/50">
                                  ·
                                </span>
                              )}
                              {club.league}
                            </p>
                          </div>
                          <div className="text-primary text-sm font-medium opacity-0 group-hover:opacity-100">
                            View →
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {!searchParams && !isLoading && (
          <EmptyState
            icon={<Search className="w-7 h-7" />}
            title="Search for a club"
            description="Type a club name above to get started. Results are cached for 6 hours."
          />
        )}
      </motion.div>
    </div>
  );
}
