import Link from 'next/link';
import { Trophy, BarChart3, Zap, Shield, Search, ArrowRight, TrendingUp } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center text-center px-4 pitch-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-8">
            <Zap className="w-3 h-3" />FFP-compliant transfer simulation
          </div>
          <h1 className="font-display font-black text-5xl sm:text-6xl md:text-7xl mb-6 leading-[1.05]">
            Build your{' '}
            <span className="text-gradient">dream squad</span>
            <br />within FFP rules
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Simulate transfers, loans, and contract extensions for any football club.
            Get instant Financial Fair Play impact analysis.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/clubs/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
              <Search className="w-4 h-4" />Search Clubs
            </Link>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-foreground rounded-xl font-semibold text-sm hover:bg-secondary/80 transition-all">
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-3xl text-center mb-12">Everything you need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Search, title: 'Club Search', desc: 'Find any club from thousands of leagues worldwide.' },
              { icon: TrendingUp, title: 'FFP Analysis', desc: 'Real-time squad cost ratios, break-even projections, and compliance status.' },
              { icon: BarChart3, title: 'Simulations', desc: 'Create multiple transfer scenarios and compare their FFP impact.' },
              { icon: Shield, title: 'Role-Based Access', desc: 'Sport Directors set private salaries. Admins manage data globally.' },
              { icon: Zap, title: 'Live Data', desc: 'Synced with API-Football for up-to-date squad and contract data.' },
              { icon: Trophy, title: 'Multi-Season', desc: 'Project FFP compliance years into the future.' },
            ].map(f => (
              <div key={f.title} className="p-5 bg-card border border-border rounded-2xl hover:border-primary/30 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-all">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold mb-1 text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-display font-bold text-3xl mb-4">Ready to simulate?</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Start with any club and build your ideal transfer window.
          </p>
          <Link href="/clubs/search"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            <Search className="w-4 h-4" />Explore Clubs
          </Link>
        </div>
      </section>
    </div>
  );
}
