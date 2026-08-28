'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeViewProps {
  url: string;
  tournamentName: string;
}

export function QRCodeView({ url, tournamentName }: QRCodeViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-4 max-w-sm mx-auto">
      <h3 className="font-bold text-base">Tournament Check-In QR</h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        Players can scan this QR code with their mobile cameras to register or check in.
      </p>

      <div className="p-4 bg-white rounded-2xl inline-block shadow-lg">
        <QRCodeSVG
          value={url}
          size={200}
          level="M"
          includeMargin={true}
        />
      </div>

      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-2.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] font-semibold text-xs transition active:scale-95 hover:border-[var(--primary)]"
        >
          {copied ? '✓ Link Copied!' : '📋 Copy Tournament Link'}
        </button>
      </div>
    </div>
  );
}
