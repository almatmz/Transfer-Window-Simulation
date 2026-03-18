'use client';
import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { searchApi, clubsApi, CURRENT_SEASON } from '@/lib/api/client';
import { formatEur } from '@/lib/utils';

interface Props { onSelect: (p: any) => void; }

export function PlayerSearchField({ onSelect }: Props) {
  const [step, setStep] = useState<'club' | 'player'>('club');
  const [clubQ, setClubQ] = useState('');
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubLoading, setClubLoading] = useState(false);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerQ, setPlayerQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (clubQ.length < 2) { setClubs([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setClubLoading(true);
      try { setClubs(await searchApi.clubs(clubQ)); }
      catch {} finally { setClubLoading(false); }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [clubQ]);

  const pickClub = async (club: any) => {
    setSelectedClub(club); setStep('player'); setPlayerLoading(true); setOpen(true);
    try {
      const data = await clubsApi.squad(club.api_football_id, CURRENT_SEASON);
      setPlayers(data?.players ?? (Array.isArray(data) ? data : []));
    } catch { setPlayers([]); }
    finally { setPlayerLoading(false); }
  };

  const reset = () => { setStep('club'); setSelectedClub(null); setPlayers([]); setClubQ(''); setPlayerQ(''); setOpen(false); };
  const filtered = playerQ ? players.filter(p => p.name?.toLowerCase().includes(playerQ.toLowerCase())) : players;

  const inputCls = "w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground";

  return (
    <div ref={ref} className="relative">
      {step === 'club' ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={clubQ} onChange={e => { setClubQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} placeholder="Search any club to pick a player…" className={inputCls} />
          {clubLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
      ) : (
        <div className="flex gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-medium text-primary shrink-0">
            {selectedClub?.logo_url && <img src={selectedClub.logo_url} alt="" className="w-4 h-4 object-contain" />}
            {selectedClub?.name}
            <button type="button" onClick={reset}><X className="w-3 h-3 hover:text-destructive" /></button>
          </span>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={playerQ} onChange={e => { setPlayerQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)} placeholder="Filter by name…" className={inputCls} />
          </div>
        </div>
      )}

      {open && step === 'club' && clubs.length > 0 && (
        <div className="absolute z-50 top-full mt-1 inset-x-0 bg-popover border border-border rounded-xl shadow-xl overflow-y-auto max-h-52 animate-scale-in">
          {clubs.slice(0, 8).map(c => (
            <button key={c.api_football_id} type="button" onClick={() => pickClub(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary text-left transition-colors">
              {c.logo_url && <img src={c.logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />}
              <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.country} · {c.league}</p></div>
            </button>
          ))}
        </div>
      )}

      {open && step === 'player' && (
        <div className="absolute z-50 top-full mt-1 inset-x-0 bg-popover border border-border rounded-xl shadow-xl overflow-y-auto max-h-64 animate-scale-in">
          {playerLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />Loading squad…
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No players found</p>
          ) : filtered.slice(0, 15).map(p => (
            <button key={p.api_football_id ?? p.name} type="button"
              onClick={() => { onSelect(p); reset(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary text-left transition-colors">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-muted-foreground">
                {p.photo_url
                  ? <Image src={p.photo_url} alt={p.name} width={32} height={32} className="object-cover rounded-full" unoptimized />
                  : p.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.position}{p.age ? ` · ${p.age}` : ''}{p.nationality ? ` · ${p.nationality}` : ''}</p>
              </div>
              {p.transfer_value && <span className="text-xs text-muted-foreground shrink-0">{formatEur(p.transfer_value, true)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
