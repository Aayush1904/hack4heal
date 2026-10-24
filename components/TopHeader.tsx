'use client';

import React from 'react';
import { User, Search } from 'lucide-react';

interface TopHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenAuditLog: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  onSearchChange,
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
            style={{ height: '32px', width: 'auto', display: 'block', objectFit: 'contain' }}
          />
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              display: 'inline-block',
            }}
            title="Clinician In-The-Loop Active"
          />
        </div>

        <button
          onClick={onOpenAuditLog}
          title="Audit Trail & Clinician Profile"
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

      {/* Clean Pill Search Bar */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--pill-radius)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 2px 8px rgba(51, 39, 42, 0.03)',
          padding: '10px 16px',
          gap: '10px',
        }}
      >
        <Search size={15} color="var(--text-tertiary)" strokeWidth={2} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search patient, CRID, ABA transfer..."
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            fontSize: '13px',
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            ESC
          </button>
        )}
      </div>
    </header>
  );
};
