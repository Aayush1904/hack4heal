'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { STORAGE_ERROR, downloadBackup, requestPersistentStorage, restoreMissingPatients } from '@/lib/patient-store';

/**
 * Runs once when the app opens: asks the browser to keep this storage, and brings back any patient
 * that is missing from the main store. Shows a warning whenever a save does not go through.
 */
export const StorageGuard: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void requestPersistentStorage();
    void restoreMissingPatients();

    const onError = (event: Event) => {
      setMessage((event as CustomEvent<{ message: string }>).detail.message);
    };
    window.addEventListener(STORAGE_ERROR, onError);
    return () => window.removeEventListener(STORAGE_ERROR, onError);
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '440px',
        zIndex: 300,
        padding: '12px 14px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        backgroundColor: '#fde8ec',
        borderBottom: '2px solid #b83355',
        color: '#7c1d2e',
        fontFamily: 'var(--font-display)',
        fontSize: '12px',
        lineHeight: 1.45,
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{message}</div>
        <button
          id="storage-warning-backup-btn"
          onClick={downloadBackup}
          style={{
            marginTop: '8px',
            padding: '6px 12px',
            borderRadius: '999px',
            border: '1px solid #b83355',
            backgroundColor: '#fffffe',
            color: '#7c1d2e',
            fontSize: '12px',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            cursor: 'pointer',
          }}
        >
          Download backup
        </button>
      </div>
      <button
        aria-label="Dismiss"
        onClick={() => setMessage(null)}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
