'use client';

import { useState } from 'react';
import { getTargetPointsForStage, type MatchStage } from '@/lib/engine/constants';
import { validateScoreForStage } from '@/lib/engine/scoring';

interface ScoreInputProps {
  player1Name: string;
  player2Name: string;
  stage: MatchStage;
  isPlayer1: boolean;
  onSubmit: (score1: number, score2: number) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export function ScoreInput({
  player1Name,
  player2Name,
  stage,
  isPlayer1,
  onSubmit,
  onCancel,
  loading = false,
}: ScoreInputProps) {
  const target = getTargetPointsForStage(stage);
  const [score1, setScore1] = useState<number>(target);
  const [score2, setScore2] = useState<number>(0);
  const [confirmStep, setConfirmStep] = useState(false);

  const validation = validateScoreForStage(score1, score2, stage);

  const adjustScore1 = (delta: number) => {
    setScore1((prev) => Math.max(0, prev + delta));
  };

  const adjustScore2 = (delta: number) => {
    setScore2((prev) => Math.max(0, prev + delta));
  };

  const handleSubmit = async () => {
    if (!validation.valid) return;
    await onSubmit(score1, score2);
  };

  const myScore = isPlayer1 ? score1 : score2;
  const oppScore = isPlayer1 ? score2 : score1;
  const oppName = isPlayer1 ? player2Name : player1Name;

  return (
    <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] max-w-md mx-auto animate-slide-up">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--secondary)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-2">
          {stage.replace('_', ' ')} • First to {target} (win by 2)
        </div>
        <h2 className="text-xl font-bold">Enter Final Score</h2>
      </div>

      {!confirmStep ? (
        <div className="space-y-6">
          {/* My Score */}
          <div className="p-4 rounded-xl bg-[var(--secondary)] border border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
              YOU ({isPlayer1 ? player1Name : player2Name})
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => (isPlayer1 ? adjustScore1(-1) : adjustScore2(-1))}
                className="w-12 h-12 rounded-xl bg-[var(--muted)] hover:bg-[var(--border)] text-2xl font-bold flex items-center justify-center transition active:scale-95"
              >
                −
              </button>
              <span className="text-5xl font-extrabold text-[var(--primary)] tracking-tight">
                {myScore}
              </span>
              <button
                type="button"
                onClick={() => (isPlayer1 ? adjustScore1(1) : adjustScore2(1))}
                className="w-12 h-12 rounded-xl bg-[var(--muted)] hover:bg-[var(--border)] text-2xl font-bold flex items-center justify-center transition active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Opponent Score */}
          <div className="p-4 rounded-xl bg-[var(--secondary)] border border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
              OPPONENT ({oppName})
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => (isPlayer1 ? adjustScore2(-1) : adjustScore1(-1))}
                className="w-12 h-12 rounded-xl bg-[var(--muted)] hover:bg-[var(--border)] text-2xl font-bold flex items-center justify-center transition active:scale-95"
              >
                −
              </button>
              <span className="text-5xl font-extrabold text-[var(--foreground)] tracking-tight">
                {oppScore}
              </span>
              <button
                type="button"
                onClick={() => (isPlayer1 ? adjustScore2(1) : adjustScore1(1))}
                className="w-12 h-12 rounded-xl bg-[var(--muted)] hover:bg-[var(--border)] text-2xl font-bold flex items-center justify-center transition active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Validation Feedback */}
          {!validation.valid && (
            <div className="p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)] text-sm text-center">
              {validation.reason || `Target is ${target} points with at least 2 points lead`}
            </div>
          )}

          {/* Quick preset buttons */}
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => {
                if (isPlayer1) { setScore1(target); setScore2(target - 2); }
                else { setScore2(target); setScore1(target - 2); }
              }}
              className="px-3 py-1 rounded-lg bg-[var(--muted)] text-xs text-[var(--muted-foreground)] hover:text-white"
            >
              Win ({target}–{target - 2})
            </button>
            <button
              type="button"
              onClick={() => {
                if (isPlayer1) { setScore1(target - 2); setScore2(target); }
                else { setScore2(target - 2); setScore1(target); }
              }}
              className="px-3 py-1 rounded-lg bg-[var(--muted)] text-xs text-[var(--muted-foreground)] hover:text-white"
            >
              Loss ({target - 2}–{target})
            </button>
          </div>

          {/* Next Button */}
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3.5 rounded-xl bg-[var(--muted)] font-semibold text-sm hover:bg-[var(--border)] transition"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={!validation.valid}
              onClick={() => setConfirmStep(true)}
              className="flex-1 py-3.5 rounded-xl gradient-primary text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Review Score →
            </button>
          </div>
        </div>
      ) : (
        /* Confirmation Step */
        <div className="space-y-6 text-center animate-slide-up">
          <div className="p-6 rounded-2xl bg-[var(--secondary)] border border-[var(--border)]">
            <div className="text-sm text-[var(--muted-foreground)] mb-3">
              Confirm match outcome:
            </div>
            <div className="text-4xl font-extrabold tracking-wider mb-2">
              <span className={score1 > score2 ? 'text-[var(--primary)]' : ''}>{score1}</span>
              <span className="text-[var(--muted-foreground)] mx-3">—</span>
              <span className={score2 > score1 ? 'text-[var(--primary)]' : ''}>{score2}</span>
            </div>
            <div className="text-sm font-medium text-[var(--muted-foreground)]">
              {score1 > score2 ? `${player1Name} won` : `${player2Name} won`}
            </div>
          </div>

          <div className="text-xs text-[var(--muted-foreground)]">
            The opponent will receive a notification to cross-validate this result.
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmStep(false)}
              className="flex-1 py-3.5 rounded-xl bg-[var(--muted)] font-semibold text-sm hover:bg-[var(--border)] transition"
            >
              ← Edit
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="flex-1 py-3.5 rounded-xl gradient-accent text-white font-semibold text-sm disabled:opacity-50 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? 'Submitting...' : 'Submit Score'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
