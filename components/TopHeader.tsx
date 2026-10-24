'use client';

import React from 'react';
import { User } from 'lucide-react';

interface TopHeaderProps {
  onOpenAuditLog: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenAuditLog,
}) => {
  return (
    <header style={{ marginBottom: '16px' }}>
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          padding: '0 2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/assets/logo.png"
            alt="Burn OS"
            style={{ height: '64px', width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </div>

        <button
          onClick={onOpenAuditLog}
          title="Activity log"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            boxShadow: '0 2px 5px rgba(51, 39, 42, 0.04)',
            transition: 'background-color 0.15s ease',
          }}
        >
          <User size={17} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
};
