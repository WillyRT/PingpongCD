import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          {/* Logo/Title */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary mb-6">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
              Tourney<span className="text-[var(--primary)]">Master</span>
              <span className="text-[var(--accent)] text-lg md:text-xl ml-2 font-semibold align-super">AI</span>
            </h1>
            <p className="text-lg md:text-xl text-[var(--muted-foreground)] max-w-md mx-auto">
              Intelligent table tennis tournament management.
              Real-time scoring. Fair competition.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl gradient-primary text-white font-semibold text-lg transition-transform hover:scale-105 active:scale-95"
            >
              🏓 Create Tournament
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-semibold text-lg border border-[var(--border)] transition-transform hover:scale-105 active:scale-95"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-4 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon="📱"
            title="Mobile-First"
            description="Report scores directly from your phone. QR code registration."
          />
          <FeatureCard
            icon="⚡"
            title="Real-Time"
            description="Live updates. Instant score confirmation. Cross-validation."
          />
          <FeatureCard
            icon="🏆"
            title="Smart Brackets"
            description="Automatic seeding, groups, and bracket generation."
          />
          <FeatureCard
            icon="🔒"
            title="Mystery Mode"
            description="Hidden standings until all group matches are confirmed."
          />
          <FeatureCard
            icon="📊"
            title="Rating System"
            description="Glicko-2 based player ratings that improve over time."
          />
          <FeatureCard
            icon="🎯"
            title="Fair Play"
            description="Cross-validation, dispute resolution, and audit logging."
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-[var(--border)] text-center text-[var(--muted-foreground)] text-sm">
        TourneyMaster AI — Table Tennis Tournament Management
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}
