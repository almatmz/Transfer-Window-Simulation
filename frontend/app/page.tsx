'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Shield, Search, ArrowRight, BarChart3, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';

const features = [
  {
    icon: <Search className="w-5 h-5" />,
    title: 'Club & Player Search',
    desc: 'Find any club from the API-Football database. Browse squads, view salaries and player stats.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'FFP Dashboard',
    desc: 'Real-time Financial Fair Play compliance. Squad cost ratios, break-even analysis, 3-year projections.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Transfer Simulations',
    desc: 'Simulate buys, sells, loans in/out. Instantly see the FFP impact of every transfer decision.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Role-Based Access',
    desc: 'Sport Directors can set real salaries. Admins manage users and force data syncs.',
  },
];

const stats = [
  { label: 'Clubs Available', value: '1000+' },
  { label: 'Transfer Types', value: '4' },
  { label: 'FFP Metrics', value: '12+' },
  { label: 'Projection Years', value: '3' },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pitch-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      {/* Hero */}
      <section className="relative container mx-auto px-4 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-6">
            <TrendingUp className="w-3.5 h-3.5" />
            Transfer Window Financial Simulator v2.0
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight mb-6 leading-none">
            Build your{' '}
            <span className="text-gradient">dream squad</span>
            <br />
            within FFP rules
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Simulate the entire transfer window — buys, sells, loans — and see the exact Financial Fair Play
            impact before committing a single euro. Real data, real consequences.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/clubs/search">
              <Button size="lg" className="font-semibold">
                <Search className="w-4 h-4" />
                Search Clubs
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            {!isAuthenticated && (
              <Link href="/register">
                <Button size="lg" variant="outline" className="font-semibold">
                  Create free account
                </Button>
              </Link>
            )}
            {isAuthenticated && (
              <Link href="/simulations">
                <Button size="lg" variant="outline" className="font-semibold">
                  My Simulations
                </Button>
              </Link>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-2xl mx-auto"
        >
          {stats.map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <p className="text-2xl font-display font-black text-gradient">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-display font-black text-center mb-3">Everything you need</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            From searching clubs to running complex multi-transfer simulations with live FFP tracking.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="font-display font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-24">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-10 text-center">
          <Trophy className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-display font-black mb-3">Ready to simulate?</h2>
          <p className="text-muted-foreground mb-6">Start with any club and build your ideal transfer window.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/clubs/search">
              <Button size="lg">
                <Search className="w-4 h-4" /> Find a Club
              </Button>
            </Link>
            {!isAuthenticated && (
              <Link href="/register">
                <Button size="lg" variant="outline">Sign up free</Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
