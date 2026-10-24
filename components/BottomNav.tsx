'use client';

import React from 'react';

export type TabType = 'triage' | 'wound-ai' | 'lund-browder' | 'aba-audit';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  abaAlertCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  abaAlertCount = 0,
}) => {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '440px',
        height: '74px',
        backgroundColor: 'rgba(250, 238, 231, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-medium)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 12px 10px 12px',
        zIndex: 50,
      }}
    >
      {/* 1. DATA / TRIAGE (Solid Square) */}
      <button
        onClick={() => onChangeTab('triage')}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          padding: '8px 12px',
          opacity: activeTab === 'triage' ? 1 : 0.45,
          transition: 'all 0.15s ease',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'triage' ? '#33272a' : 'none'} stroke="#33272a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#33272a',
          }}
        >
          TRIAGE
        </span>
      </button>

      {/* 2. FOUNDRY / WOUND AI (Circle) */}
      <button
        onClick={() => onChangeTab('wound-ai')}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          padding: '8px 12px',
          opacity: activeTab === 'wound-ai' ? 1 : 0.45,
          transition: 'all 0.15s ease',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'wound-ai' ? '#33272a' : 'none'} stroke="#33272a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
        </svg>
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#33272a',
          }}
        >
          WOUND AI
        </span>
      </button>

      {/* 3. ORDERS / LUND-BROWDER (Diamond / Rhombus) */}
      <button
        onClick={() => onChangeTab('lund-browder')}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          padding: '8px 12px',
          opacity: activeTab === 'lund-browder' ? 1 : 0.45,
          transition: 'all 0.15s ease',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'lund-browder' ? '#33272a' : 'none'} stroke="#33272a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="14" height="14" rx="2" transform="rotate(45 12 12)" />
        </svg>
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#33272a',
          }}
        >
          BODY MAP
        </span>
      </button>

      {/* 4. SYSTEM / ABA & AUDIT (Book / System) */}
      <button
        onClick={() => onChangeTab('aba-audit')}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          padding: '8px 12px',
          opacity: activeTab === 'aba-audit' ? 1 : 0.45,
          position: 'relative',
          transition: 'all 0.15s ease',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'aba-audit' ? '#33272a' : 'none'} stroke="#33272a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
        {abaAlertCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '12px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ff8ba7',
              border: '1px solid #33272a',
            }}
          />
        )}
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#33272a',
          }}
        >
          ABA / AUDIT
        </span>
      </button>
    </nav>
  );
};
