'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clubsApi } from '@/lib/api/client';
import { Skeleton, ErrorMessage, EmptyState, Badge } from '@/components/ui';
import { formatEur } from '@/lib/utils';
import { Users, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function SquadPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = Number(clubId);

  const { data: squad, isLoading, error, refetch } = useQuery({
    queryKey: ['squad', id],
    queryFn: () => clubsApi.squad(id),
  });

  const players = Array.isArray(squad) ? squad : [];

  // Detect available keys from first player
  const samplePlayer = players[0] as Record<string, unknown> | undefined;
  const hasPhoto = samplePlayer && ('photo_url' in samplePlayer || 'photo' in samplePlayer);

  const positionOrder = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF', 'SS'];

  const groupedByPosition = players.reduce((acc: Record<string, unknown[]>, p: unknown) => {
    const player = p as Record<string, unknown>;
    const pos = String(player.position ?? player.pos ?? 'Unknown');
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(player);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/clubs/${id}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-display font-black flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> Squad
            </h1>
            <p className="text-muted-foreground text-sm">{players.length} players</p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <ErrorMessage message={(error as Error).message} onRetry={refetch} />}

        {!isLoading && !error && players.length === 0 && (
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title="Squad not loaded"
            description="Try triggering a sync from the club page"
          />
        )}

        {!isLoading && players.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedByPosition).map(([position, posPlayers]) => (
              <div key={position}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                  {position}
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Player</th>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Nationality</th>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Age</th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salary (est.)</th>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Contract</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(posPlayers as Record<string, unknown>[]).map((player, idx) => {
                        const playerId = player.api_football_id ?? player.id;
                        const name = String(player.name ?? player.firstname ?? 'Unknown');
                        const photo = String(player.photo_url ?? player.photo ?? '');
                        const salary = (player.annual_salary ?? player.estimated_salary) as number | undefined;
                        const contract = player.contract_expiry_year as number | undefined;
                        const age = player.age as number | undefined;
                        const nat = String(player.nationality ?? '');

                        const row = (
                          <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                  {photo ? (
                                    <Image src={photo} alt={name} width={32} height={32} className="object-cover" unoptimized />
                                  ) : (
                                    <User className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span className="font-medium truncate max-w-[160px]">{name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground hidden md:table-cell">{nat || '—'}</td>
                            <td className="p-3 text-muted-foreground">{age ?? '—'}</td>
                            <td className="p-3 text-right font-mono text-sm">
                              {salary ? formatEur(salary, true) : '—'}
                            </td>
                            <td className="p-3 text-muted-foreground hidden sm:table-cell">
                              {contract ? `Until ${contract}` : '—'}
                            </td>
                          </tr>
                        );

                        return playerId ? (
                          <Link key={idx} href={`/players/${playerId}`} className="contents">
                            {row}
                          </Link>
                        ) : row;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
