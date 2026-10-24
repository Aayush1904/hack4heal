'use client';

import React, { useState, useMemo } from 'react';
import {
  INITIAL_LUND_BROWDER_SEGMENTS,
  calculateLundBrowderTBSA,
  calculateResuscitation,
  evaluateABATransferCriteria,
} from '@/lib/clinical-engine';
import { PatientRecord, LundBrowderSegment, AuditTrailEvent } from '@/types/burn';
import { TopHeader } from '@/components/TopHeader';
import { HeroTbsaCard } from '@/components/HeroTbsaCard';
import { LundBrowderChart } from '@/components/LundBrowderChart';
import { AbaReferralEngine } from '@/components/AbaReferralEngine';
import { AuditLogView } from '@/components/AuditLogView';
import { PediatricModal } from '@/components/PediatricModal';
import { isPaediatricBurnPatient } from '@/lib/burn-fluids';
import { SbarExportModal } from '@/components/SbarExportModal';
import { EditPatientModal } from '@/components/EditPatientModal';
import { BottomNav, TabType } from '@/components/BottomNav';
import type { StoredPatient } from '@/components/HomeScreen';

// Order in which an estimated burn is spread over the body map (largest, most common areas first).
const SEED_ORDER = ['torso-ant', 'torso-post', 'arm-r-up', 'arm-l-up', 'arm-r-low', 'arm-l-low', 'thigh-r', 'thigh-l', 'leg-r-low', 'leg-l-low', 'head-ant', 'head-post'];

function toPatientRecord(p: StoredPatient): PatientRecord {
  const arrival = new Date(p.createdAt);
  // The form does not ask when the burn happened, so assume 1 hour before arrival. The doctor can edit this.
  const injury = new Date(arrival.getTime() - 60 * 60 * 1000);
  return {
    crid: p.id,
    mrnDeidentified: p.id,
    ageYears: p.age,
    weightKg: p.weightKg,
    gender: p.gender,
    mechanism: 'Flame',
    timeOfInjury: injury.toISOString(),
    timeOfArrival: arrival.toISOString(),
    preHospitalFluidsMl: 0,
    suspectedInhalationInjury: false,
    comorbidities: [],
    concomitantTrauma: false,
  };
}

function seedSegmentsFromBurnPercent(age: number, burnPercent: number): LundBrowderSegment[] {
  const segments = INITIAL_LUND_BROWDER_SEGMENTS.map((orig) => ({ ...orig, partialBurnPercentage: 0, fullBurnPercentage: 0 }));
  let remaining = burnPercent;
  for (const id of SEED_ORDER) {
    if (remaining <= 0) break;
    const seg = segments.find((x) => x.id === id);
    if (!seg) continue;
    const max = seg.getPercentageForAge(age);
    const used = Math.min(remaining, max);
    seg.partialBurnPercentage = Math.round((used / max) * 1000) / 10;
    remaining -= used;
  }
  return segments;
}

interface TriageWorkspaceProps {
  /** The saved patient to triage. */
  patient: StoredPatient;
}

export default function TriageWorkspace({ patient: storedPatient }: TriageWorkspaceProps) {
  // 1. Initial State Setup
  const [currentPatient, setCurrentPatient] = useState<PatientRecord>(() => toPatientRecord(storedPatient));
  const [selectedFormula, setSelectedFormula] = useState<'Parkland' | 'Modified Brooke'>('Modified Brooke');
  const [activeTab, setActiveTab] = useState<TabType>('triage');

  // 2. Anatomical Segments State
  const [segments, setSegments] = useState<LundBrowderSegment[]>(() =>
    seedSegmentsFromBurnPercent(storedPatient.age, storedPatient.burnPercent ?? 0),
  );

  // 3. Modals state
  const [isPediatricModalOpen, setIsPediatricModalOpen] = useState(
    () => isPaediatricBurnPatient(storedPatient.age, storedPatient.weightKg),
  );
  const [isSbarModalOpen, setIsSbarModalOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  // 4. Audit Log Trail
  const [auditLogs, setAuditLogs] = useState<AuditTrailEvent[]>([
    {
      id: 'log-001',
      timestamp: storedPatient.createdAt,
      crid: storedPatient.id,
      clinicianId: 'DR_VASQUEZ_MD_710',
      action: 'TRIAGE_CREATED',
      details: 'Patient added with a burn photo.',
      hashPreview: '8f4a19c2e0b5',
    },
  ]);

  const addAuditLog = (action: any, details: string) => {
    const newLog: AuditTrailEvent = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      crid: currentPatient.crid,
      clinicianId: 'DR_VASQUEZ_MD_710',
      action,
      details,
      hashPreview: '4f9b82c1a0e7',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // 6. Update Segment in Lund-Browder
  const handleUpdateSegment = (segmentId: string, partial: number, full: number) => {
    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.id === segmentId) {
          return { ...seg, partialBurnPercentage: partial, fullBurnPercentage: full };
        }
        return seg;
      })
    );
  };

  // 9. Manual ABA Trigger Toggle
  const [manualTriggerOverrides, setManualTriggerOverrides] = useState<Record<string, boolean>>({});
  const handleToggleManualTrigger = (triggerId: string) => {
    setManualTriggerOverrides((prev) => ({
      ...prev,
      [triggerId]: !prev[triggerId],
    }));
  };

  // 10. Computations & Math Engines (100% Deterministic)
  const tbsaCalc = useMemo(() => {
    return calculateLundBrowderTBSA(segments, currentPatient.ageYears);
  }, [segments, currentPatient.ageYears]);

  const resusCalc = useMemo(() => {
    return calculateResuscitation(currentPatient, tbsaCalc.totalTbsaPercent, selectedFormula);
  }, [currentPatient, tbsaCalc.totalTbsaPercent, selectedFormula]);

  const abaCalc = useMemo(() => {
    const base = evaluateABATransferCriteria(
      currentPatient,
      tbsaCalc.totalTbsaPercent,
      tbsaCalc.partialTbsaPercent,
      tbsaCalc.fullTbsaPercent,
      tbsaCalc.specialSitesInvolved
    );
    const updatedTriggers = base.triggers.map((t) => {
      if (manualTriggerOverrides[t.id] !== undefined) {
        return { ...t, triggered: manualTriggerOverrides[t.id] };
      }
      return t;
    });
    const active = updatedTriggers.filter((t) => t.triggered);
    return {
      transferRecommended: active.length > 0,
      triggers: updatedTriggers,
      criticalReasons: active.map((t) => `${t.label}: ${t.description}`),
    };
  }, [currentPatient, tbsaCalc, manualTriggerOverrides]);

  return (
    <>
      {/* 1. Foundry.OS Style Header */}
      <TopHeader
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
      />

      {/* 2. Audit Trail Drawer Modal if open */}
      {isAuditLogOpen && (
        <AuditLogView
          logs={auditLogs}
          crid={currentPatient.crid}
          onClose={() => setIsAuditLogOpen(false)}
        />
      )}

      {/* 3. Conditional Tab Content Rendering */}
      {activeTab === 'triage' && (
        <>
          <HeroTbsaCard
            tbsaPercent={tbsaCalc.totalTbsaPercent}
            partialTbsaPercent={tbsaCalc.partialTbsaPercent}
            fullTbsaPercent={tbsaCalc.fullTbsaPercent}
            resus={resusCalc}
            selectedFormula={selectedFormula}
            onFormulaChange={(f) => {
              setSelectedFormula(f);
              addAuditLog('FORMULA_CHANGED', `Fluid formula changed to ${f}`);
            }}
            weightKg={currentPatient.weightKg}
            onEditPatient={() => setIsEditPatientOpen(true)}
          />

        <div style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--item-radius)',
            padding: '14px 16px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-card)',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {storedPatient.name}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-editorial)', marginTop: '2px' }}>
              {storedPatient.age} yrs &bull; {storedPatient.gender} &bull; {storedPatient.weightKg} kg
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', marginTop: '10px', lineHeight: 1.5 }}>
              Burn size comes from the photo scan. Check the Body map tab and adjust it if needed. Use Edit above to set when the burn happened.
            </div>
          </div>
        </>
      )}

      {activeTab === 'lund-browder' && (
        <LundBrowderChart
          segments={segments}
          patientAge={currentPatient.ageYears}
          onUpdateSegment={handleUpdateSegment}
          onAddAuditLog={addAuditLog}
        />
      )}

      {activeTab === 'aba-audit' && (
        <>
          <AbaReferralEngine
            transferRecommended={abaCalc.transferRecommended}
            triggers={abaCalc.triggers}
            criticalReasons={abaCalc.criticalReasons}
            patient={currentPatient}
            tbsaPercent={tbsaCalc.totalTbsaPercent}
            onGenerateSbar={() => setIsSbarModalOpen(true)}
            onToggleManualTrigger={handleToggleManualTrigger}
          />

          <AuditLogView
            logs={auditLogs}
            crid={currentPatient.crid}
            onClose={() => setActiveTab('triage')}
          />
        </>
      )}

      {/* 4. Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        abaAlertCount={abaCalc.criticalReasons.length}
      />

      {/* 5. Modals & Safety Dialogs */}
      <PediatricModal
        patient={currentPatient}
        isOpen={isPediatricModalOpen}
        onClose={() => setIsPediatricModalOpen(false)}
      />

      <SbarExportModal
        patient={currentPatient}
        tbsaPercent={tbsaCalc.totalTbsaPercent}
        resus={resusCalc}
        triggers={abaCalc.triggers}
        isOpen={isSbarModalOpen}
        onClose={() => setIsSbarModalOpen(false)}
      />

      <EditPatientModal
        patient={currentPatient}
        isOpen={isEditPatientOpen}
        onClose={() => setIsEditPatientOpen(false)}
        onSave={(updated) => {
          setCurrentPatient(updated);
          if (isPaediatricBurnPatient(updated.ageYears, updated.weightKg)) {
            setIsPediatricModalOpen(true);
          }
          addAuditLog('TRIAGE_CREATED', `Patient details updated: ${updated.ageYears} yrs, ${updated.weightKg} kg`);
        }}
      />
    </>
  );
}
