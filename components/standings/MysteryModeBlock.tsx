'use client';

interface MysteryModeBlockProps {
  groupCode?: string;
  confirmedMatches: number;
  expectedMatches: number;
}

export function MysteryModeBlock({
  groupCode,
  confirmedMatches,
  expectedMatches,
}: MysteryModeBlockProps) {
  const percentage = expectedMatches > 0
    ? Math.round((confirmedMatches / expectedMatches) * 100)
    : 0;

  return (
    <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-4 animate-slide-up">
      {/* Icon */}
      <div className="text-5xl animate-pulse">🔒</div>

      {/* Title */}
      <div>
        <h3 className="text-lg font-bold">
          {groupCode ? `Group ${groupCode} — ` : ''}Standings Hidden
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
          Mystery Mode active: standings remain hidden until all matches in the group are confirmed.
        </p>
      </div>

      {/* Progress */}
      <div className="max-w-xs mx-auto space-y-2">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-[var(--muted-foreground)]">GROUP PROGRESS</span>
          <span className="text-[var(--primary)] font-mono">
            {confirmedMatches} / {expectedMatches} matches ({percentage}%)
          </span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-[var(--secondary)] overflow-hidden">
          <div
            className="h-full rounded-full gradient-primary transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
