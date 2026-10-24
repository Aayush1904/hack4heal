'use client';

import React, { useState, useMemo } from 'react';
import { PRELOADED_CASES, PreloadedCase } from '@/lib/mock-cases';
import {
  INITIAL_LUND_BROWDER_SEGMENTS,
  calculateLundBrowderTBSA,
  calculateResuscitation,
  evaluateABATransferCriteria,
} from '@/lib/clinical-engine';
import { PatientRecord, LundBrowderSegment, AuditTrailEvent } from '@/types/burn';
import { TopHeader } from '@/components/TopHeader';
import { HeroTbsaCard } from '@/components/HeroTbsaCard';
import { CaseListSelector } from '@/components/CaseListSelector';
import { WoundAiSegmentation } from '@/components/WoundAiSegmentation';
import { LundBrowderChart } from '@/components/LundBrowderChart';
import { AbaReferralEngine } from '@/components/AbaReferralEngine';
import { AuditLogView } from '@/components/AuditLogView';
import { PediatricModal } from '@/components/PediatricModal';
import { SbarExportModal } from '@/components/SbarExportModal';
import { EditPatientModal } from '@/components/EditPatientModal';
import { BottomNav, TabType } from '@/components/BottomNav';

export default function TriageWorkspace() {
  // 1. Initial State Setup
  const [selectedCaseId, setSelectedCaseId] = useState<string>(PRELOADED_CASES[0].id);
  const [currentPatient, setCurrentPatient] = useState<PatientRecord>(PRELOADED_CASES[0].patient);
  const [currentCaseImage, setCurrentCaseImage] = useState<string>(PRELOADED_CASES[0].woundImageUrl);
  const [selectedFormula, setSelectedFormula] = useState<'Parkland' | 'Modified Brooke'>('Parkland');
  const [activeTab, setActiveTab] = useState<TabType>('triage');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 2. Anatomical Segments State
  const [segments, setSegments] = useState<LundBrowderSegment[]>(() => {
    const base = JSON.parse(JSON.stringify(INITIAL_LUND_BROWDER_SEGMENTS));
    const preset = PRELOADED_CASES[0].presetSegments;
    return base.map((s: LundBrowderSegment) => {
      const original = INITIAL_LUND_BROWDER_SEGMENTS.find((o) => o.id === s.id);
      s.getPercentageForAge = original ? original.getPercentageForAge : () => s.baseAdultPercentage;
      if (preset[s.id]) {
        s.partialBurnPercentage = preset[s.id].partial;
        s.fullBurnPercentage = preset[s.id].full;
      }
      return s;
    });
  });

  // 3. Modals state
  const [isPediatricModalOpen, setIsPediatricModalOpen] = useState(false);
  const [isSbarModalOpen, setIsSbarModalOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  // 4. Audit Log Trail
  const [auditLogs, setAuditLogs] = useState<AuditTrailEvent[]>([
    {
      id: 'log-001',
      timestamp: '2026-10-24T09:00:00.000Z',
      crid: PRELOADED_CASES[0].patient.crid,
      clinicianId: 'DR_VASQUEZ_MD_710',
      action: 'TRIAGE_CREATED',
      details: 'Patient admitted to emergency department; initial clinical triage initiated.',
      hashPreview: '8f4a19c2e0b5',
    },
    {
      id: 'log-002',
      timestamp: '2026-10-24T09:20:00.000Z',
      crid: PRELOADED_CASES[0].patient.crid,
      clinicianId: 'DR_VASQUEZ_MD_710',
      action: 'TBSA_UPDATED',
      details: 'Lund-Browder segments mapped from visual exam: 28.5% total TBSA confirmed.',
      hashPreview: '3c8e71b9a2d0',
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

  // 5. Case Selection Handler
  const handleSelectCase = (caseItem: PreloadedCase) => {
    setSelectedCaseId(caseItem.id);
    setCurrentPatient(caseItem.patient);
    setCurrentCaseImage(caseItem.woundImageUrl);

    const newSegments = INITIAL_LUND_BROWDER_SEGMENTS.map((orig) => {
      const copy = { ...orig };
      const preset = caseItem.presetSegments[orig.id];
      if (preset) {
        copy.partialBurnPercentage = preset.partial;
        copy.fullBurnPercentage = preset.full;
      } else {
        copy.partialBurnPercentage = 0;
        copy.fullBurnPercentage = 0;
      }
      return copy;
    });
    setSegments(newSegments);

    if (caseItem.patient.ageYears < 18 || caseItem.patient.weightKg < 30) {
      setIsPediatricModalOpen(true);
    }
    addAuditLog('TRIAGE_CREATED', `Switched active clinical triage to ${caseItem.name}`);
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

  // 7. Wound AI Map to Region Handler
  const handleConfirmMaskToRegion = (targetRegionId: string, fraction: number) => {
    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.id === targetRegionId) {
          return {
            ...seg,
            partialBurnPercentage: Math.min(100, seg.partialBurnPercentage + Math.round(fraction * 100)),
          };
        }
        return seg;
      })
    );
    setActiveTab('lund-browder');
  };

  // 8. Custom Patient Creation
  const handleCustomPatient = () => {
    const customPatient: PatientRecord = {
      crid: `CRID-${Math.floor(1000 + Math.random() * 9000)}-N`,
      mrnDeidentified: `PT-${Math.floor(10000 + Math.random() * 90000)}`,
      ageYears: 40,
      weightKg: 75,
      gender: 'Male',
      mechanism: 'Flame',
      timeOfInjury: '2026-10-24T08:30:00.000Z',
      timeOfArrival: '2026-10-24T10:00:00.000Z',
      preHospitalFluidsMl: 500,
      suspectedInhalationInjury: false,
      comorbidities: [],
      concomitantTrauma: false,
    };
    setSelectedCaseId('custom');
    setCurrentPatient(customPatient);
    setIsEditPatientOpen(true);
    addAuditLog('TRIAGE_CREATED', 'New blank clinical case triage initialized');
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

  // Filter cases for search bar
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return PRELOADED_CASES;
    const q = searchQuery.toLowerCase();
    return PRELOADED_CASES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.patient.crid.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <>
      {/* 1. Foundry.OS Style Header */}
      <TopHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
              addAuditLog('FORMULA_CHANGED', `Resuscitation formula changed to ${f}`);
            }}
            weightKg={currentPatient.weightKg}
            onEditPatient={() => setIsEditPatientOpen(true)}
          />

          <CaseListSelector
            cases={filteredCases}
            selectedCaseId={selectedCaseId}
            onSelectCase={handleSelectCase}
            onCustomPatient={handleCustomPatient}
          />
        </>
      )}

      {activeTab === 'wound-ai' && (
        <WoundAiSegmentation
          currentCaseImage={currentCaseImage}
          onConfirmMaskToRegion={handleConfirmMaskToRegion}
          onAddAuditLog={addAuditLog}
        />
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
          if (updated.ageYears < 18 || updated.weightKg < 30) {
            setIsPediatricModalOpen(true);
          }
          addAuditLog('TRIAGE_CREATED', `Updated triage parameters: ${updated.ageYears}yo, ${updated.weightKg}kg`);
        }}
      />
    </>
  );
}
