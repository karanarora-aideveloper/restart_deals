'use client';

import React, { useState } from 'react';
import { clearClientPersonalization } from '@/lib/personalization';

export default function ResetPreferencesButton() {
  const [cleared, setCleared] = useState(false);

  const handleClear = () => {
    clearClientPersonalization();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <button
      onClick={handleClear}
      type="button"
      className="text-left text-[#cbd5e1] hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5"
      title="Clears your local browsing cookie and restores default virgin feed"
    >
      <span>{cleared ? '✓ Preferences Reset' : 'Reset Feed Preferences'}</span>
    </button>
  );
}
