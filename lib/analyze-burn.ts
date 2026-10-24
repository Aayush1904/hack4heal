import type { BurnRegionResult } from '@/lib/rule-of-nines';

export interface AnalyzeBurnRequest {
  images: string[];
  age: number;
  gender: string;
  weightKg: number;
}

export interface AnalyzedImageInfo {
  index: number;
  view: string;
  isFullBody: boolean;
  cues: string;
  regionsVisible: string[];
}

export interface BurnDebugInfo {
  model?: string;
  imageCount?: number;
  rawText?: string;
  usage?: unknown;
  [key: string]: unknown;
}

export interface AnalyzeBurnResponse {
  regions: BurnRegionResult[];
  tbsa: number;
  fluidMl: number;
  confidence: number;
  notes: string;
  images: AnalyzedImageInfo[];
  debug?: BurnDebugInfo;
}

export class AnalyzeBurnError extends Error {
  constructor(
    message: string,
    public status?: number,
    public debug?: BurnDebugInfo,
  ) {
    super(message);
    this.name = 'AnalyzeBurnError';
  }
}

export async function analyzeBurnImages(req: AnalyzeBurnRequest): Promise<AnalyzeBurnResponse> {
  const res = await fetch('/api/analyze-burn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  const data = (await res.json().catch(() => ({}))) as AnalyzeBurnResponse & { error?: string };

  if (!res.ok) {
    throw new AnalyzeBurnError(data.error ?? `Analysis failed (${res.status})`, res.status, data.debug);
  }

  return data;
}
