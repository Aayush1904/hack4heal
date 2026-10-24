import { NextResponse } from 'next/server';
import { estimateResuscitationMl } from '@/lib/burn-fluids';
import {
  REGION_IDS,
  buildRegionPromptCatalog,
  computeTbsa,
  type BurnDepth,
  type BurnPatch,
  type BurnRegionResult,
} from '@/lib/rule-of-nines';

const VISION_MODEL = 'gemini-3.8-flash';
const MAX_IMAGES = 6;

function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = err.cause as { code?: string } | undefined;
  return (
    err.message.includes('fetch failed') ||
    cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    cause?.code === 'ETIMEDOUT' ||
    cause?.code === 'ECONNRESET'
  );
}

const VALID_DEPTHS: BurnDepth[] = ['superficial', 'partial', 'full', 'mixed', 'unknown'];
const VALID_VIEWS = ['anterior', 'posterior', 'left_lateral', 'right_lateral', 'close_up', 'unclear'];

interface RawRegion {
  id?: string;
  unknown?: boolean;
  visiblePct?: number;
  coveragePct?: number;
  depth?: string;
  tbsaContributionPct?: number;
  patches?: RawPatch[];
}

interface RawPatch {
  coveragePct?: number;
  center?: { u?: number; v?: number };
  spread?: { u?: number; v?: number };
}

interface RawImage {
  index?: number;
  view?: string;
  isFullBody?: boolean;
  cues?: string;
  regionsVisible?: string[];
}

interface RawAssessment {
  images?: RawImage[];
  regions?: RawRegion[];
  confidence?: number;
  notes?: string;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}

function normalizeRegions(raw: RawAssessment): BurnRegionResult[] {
  const byId = new Map<string, BurnRegionResult>();

  for (const item of raw.regions ?? []) {
    if (!item.id || !(REGION_IDS as readonly string[]).includes(item.id)) continue;
    const visiblePct = clamp(Number(item.visiblePct ?? 100), 0, 100);
    const unknown = visiblePct < 5;
    const depthRaw = String(item.depth ?? 'unknown').toLowerCase();
    const depth = VALID_DEPTHS.includes(depthRaw as BurnDepth) ? (depthRaw as BurnDepth) : 'unknown';
    const declaredCoverage = unknown ? 0 : clamp(Number(item.coveragePct ?? 0), 0, 100);
    let patches: BurnPatch[] = unknown
      ? []
      : (item.patches ?? []).map((p) => ({
          coveragePct: clamp(Number(p.coveragePct ?? 0), 0, 100),
          center: { u: clamp(Number(p.center?.u ?? 0.5), 0, 1), v: clamp(Number(p.center?.v ?? 0.5), 0, 1) },
          spread: { u: clamp(Number(p.spread?.u ?? 0.5), 0.05, 0.5), v: clamp(Number(p.spread?.v ?? 0.5), 0.05, 0.5) },
        })).filter((p) => p.coveragePct > 0);
    // The patches must add up to the region coverage: scale them if the model's numbers disagree.
    const patchSum = patches.reduce((a, p) => a + p.coveragePct, 0);
    if (patches.length > 0 && patchSum > 0 && Math.abs(patchSum - declaredCoverage) > 0.5) {
      const k = declaredCoverage / patchSum;
      patches = patches.map((p) => ({ ...p, coveragePct: clamp(p.coveragePct * k, 0, 100) }));
    }
    if (patches.length === 0 && declaredCoverage > 0) {
      patches = [{ coveragePct: declaredCoverage, center: { u: 0.5, v: 0.5 }, spread: { u: 0.5, v: 0.5 } }];
    }
    const dominant = patches.slice().sort((a, b) => b.coveragePct - a.coveragePct)[0];
    byId.set(item.id, {
      id: item.id,
      coveragePct: declaredCoverage,
      depth,
      center: dominant?.center ?? { u: 0.5, v: 0.5 },
      spread: dominant?.spread ?? { u: 0.5, v: 0.5 },
      patches,
      tbsaContributionPct: unknown ? 0 : clamp(Number(item.tbsaContributionPct ?? 0), 0, 100),
      visiblePct,
      unknown,
    });
  }

  return REGION_IDS.map(
    (id) =>
      byId.get(id) ?? {
        id,
        coveragePct: 0,
        depth: 'unknown' as BurnDepth,
        center: { u: 0.5, v: 0.5 },
        visiblePct: 0,
        unknown: true,
      },
  );
}

function buildPrompt(age: number, gender: string, imageCount: number): string {
  const catalog = buildRegionPromptCatalog(age);
  const ageNote =
    age <= 4
      ? 'Young child: paediatric Rule-of-Nines weights (head 18%, each leg 13.5%).'
      : age < 15
        ? 'Child: paediatric Rule-of-Nines weights (head 14%, each leg 15.5%).'
        : 'Adult Rule-of-Nines weights.';

  return `You are the burn-surface-area vision engine of a clinical burn triage tool. Your numbers drive a Rule-of-Nines TBSA calculation and a 3D body map, so correct orientation and honesty about unseen skin matter more than sounding confident.

PATIENT: ${age} y, ${gender}. ${ageNote}
INPUT: ${imageCount} photo(s) of ONE patient (image index 0..${imageCount - 1}): full body, a limb, a torso or a close-up. Do not assume the whole body is visible. Merge all photos into ONE assessment and never double count an area seen in several photos.

1. ORIENT each photo: anterior, posterior, left_lateral, right_lateral, close_up or unclear. Use cues (face, nipples, umbilicus, kneecaps = anterior; spine, scapulae, gluteal cleft, back of head, heels = posterior) and put them in "cues".
LEFT/RIGHT always mean the PATIENT's. Anterior photo: patient's left is on the image's RIGHT. Posterior photo: patient's left is on the image's LEFT. Lateral photos show only that side's limbs (left_lateral -> left_*, right_lateral -> right_*). If unsure of the side, lower confidence and say so in notes; never guess.

2. INSPECT carefully before measuring. Scan all visible skin and trace where burned tissue meets normal skin by colour, texture and moisture. Count ONLY partial-thickness (blisters, weeping, mottled red-white) and full-thickness (leathery, waxy white, brown, charred) burns. Exclude plain erythema/sunburn, soot on intact skin, clothing, dressings, shadows, glare and tattoos. Size each burn against the anatomy (limb length, joint lines, trunk width) and the palm-with-fingers (~1% TBSA). Use finer values than 25/50/75 when the image supports it, do not under-call visible burn, and note ambiguity in "notes".

3. REGIONS (ids and Rule-of-Nines weights):
${catalog}
Head and neck down to the shoulders; arms shoulder to fingertips; trunk shoulders to top of thighs split into upper/lower halves; legs gluteal fold or groin to toes. Front and back of a limb are its two faces. PALM and palmar wrist = *_arm_front; dorsum of hand and knuckles = *_arm_back (even on a close_up). Never put a dorsal hand burn on the palm side or the opposite arm.

Hands close-up: set visiblePct to how much of that whole arm region (shoulder to fingertips) appears in the photo — a hand-only shot is often under 20%. coveragePct is still the % of the whole arm region that is burned (a small dorsal hand burn is usually only a few % of the arm region).

4. OUTPUT only regions that are at least 5% visible in some photo. Omit the rest (omitted = not assessed, excluded from the total). For each returned region:
- visiblePct: % of the region visible across all photos.
- coveragePct: % of the WHOLE region that is burned (0 if visible but unburned).
- depth: partial, full or mixed; unknown if coveragePct is 0.
- tbsaContributionPct: coveragePct/100 x the region's weight above (work it out; it is cross-checked).
- patches: one entry per separate burned area (empty if none); their coveragePct values add up to the region's coveragePct. Each has center and spread in REGION-LOCAL 0-1 on that surface as the viewer sees it: u 0 = viewer's left edge, 1 = viewer's right; on arms v 0 = shoulder, v 1 = fingertips. spread = half-width/half-height (0.05-0.5). Place the center on the burn centroid, not the whole limb.

5. CHECK before answering: every left_*/right_* id matches step 1 (swap test); coverage matches the area you traced; nothing double counted.

JSON only, matching the schema. "confidence" 0-1 (lower for poor light, partial views, ambiguity). "notes": max 300 characters, clinically useful (uncertain or unphotographed regions).`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Burn vision analysis is not configured on the server.' }, { status: 503 });
  }

  let body: { images?: string[]; imageDataUrl?: string; age?: number; gender?: string; weightKg?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const imageUrls = (body.images ?? (body.imageDataUrl ? [body.imageDataUrl] : [])).slice(0, MAX_IMAGES);
  const age = Number(body.age);
  const weightKg = Number(body.weightKg);
  const gender = typeof body.gender === 'string' ? body.gender : 'Unknown';

  if (imageUrls.length === 0 || !Number.isFinite(age) || !Number.isFinite(weightKg)) {
    return NextResponse.json({ error: 'At least one image, plus age and weightKg, are required.' }, { status: 400 });
  }

  const parsedImages = imageUrls.map(parseDataUrl);
  if (parsedImages.some((p) => !p)) {
    return NextResponse.json({ error: 'Images must be base64 data URLs.' }, { status: 400 });
  }

  const prompt = buildPrompt(age, gender, parsedImages.length);

  const regionSchema = {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING', enum: [...REGION_IDS] },
      visiblePct: { type: 'NUMBER' },
      coveragePct: { type: 'NUMBER' },
      depth: { type: 'STRING', enum: ['partial', 'full', 'mixed', 'unknown'] },
      tbsaContributionPct: { type: 'NUMBER' },
      patches: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            coveragePct: { type: 'NUMBER' },
            center: {
              type: 'OBJECT',
              properties: { u: { type: 'NUMBER' }, v: { type: 'NUMBER' } },
              required: ['u', 'v'],
            },
            spread: {
              type: 'OBJECT',
              properties: { u: { type: 'NUMBER' }, v: { type: 'NUMBER' } },
              required: ['u', 'v'],
            },
          },
          required: ['coveragePct', 'center', 'spread'],
        },
      },
    },
    required: ['id', 'visiblePct', 'coveragePct', 'tbsaContributionPct', 'depth', 'patches'],
  };

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      images: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            index: { type: 'INTEGER' },
            view: { type: 'STRING', enum: VALID_VIEWS },
            isFullBody: { type: 'BOOLEAN' },
            cues: { type: 'STRING' },
                },
          required: ['index', 'view', 'isFullBody', 'cues'],
        },
      },
      regions: { type: 'ARRAY', items: regionSchema },
      confidence: { type: 'NUMBER' },
      notes: { type: 'STRING' },
    },
    required: ['images', 'regions', 'confidence', 'notes'],
  };

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  parsedImages.forEach((img, i) => {
    parts.push({ text: `Image index ${i}:` });
    parts.push({ inline_data: { mime_type: img!.mimeType, data: img!.data } });
  });

  try {
    const t0 = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Vision API error', res.status, errText);
      const overloaded = res.status === 503 || res.status === 429;
      return NextResponse.json(
        {
          error: overloaded
            ? 'The vision service is busy right now. Wait a few seconds and try again.'
            : 'Burn image analysis request failed.',
          debug: { status: res.status, body: errText },
        },
        { status: 502 },
      );
    }

    const json = await res.json();
    const rawText: string | undefined = json?.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join('');
    if (!rawText) {
      return NextResponse.json({ error: 'Empty response from burn analysis.', debug: { response: json } }, { status: 502 });
    }

    let assessment: RawAssessment;
    try {
      assessment = JSON.parse(rawText.replace(/^```(?:json)?\s*|\s*```$/g, '')) as RawAssessment;
    } catch {
      return NextResponse.json({ error: 'Could not parse burn analysis response.', debug: { rawText } }, { status: 502 });
    }

    const regions = normalizeRegions(assessment);
    const tbsa = computeTbsa(regions, age);
    const modelTbsaSum = Math.round(regions.reduce((a, r) => a + (r.tbsaContributionPct ?? 0), 0) * 10) / 10;

    return NextResponse.json({
      regions,
      tbsa,
      modelTbsaSum,
      fluidMl: estimateResuscitationMl(age, weightKg, tbsa),
      confidence: clamp(Number(assessment.confidence ?? 0.5), 0, 1),
      notes: assessment.notes ?? '',
      images: assessment.images ?? [],
      debug: {
        model: VISION_MODEL,
        imageCount: parsedImages.length,
        latencyMs: Date.now() - t0,
        rawText,
        usage: json?.usageMetadata ?? null,
      },
    });
  } catch (err) {
    console.error('analyze-burn error', err);
    const network = isTransientFetchError(err);
    return NextResponse.json(
      {
        error: network
          ? 'Could not reach the vision service (connection timed out). Check your internet or VPN, then try again.'
          : 'Burn analysis failed.',
        debug: network ? { cause: String((err as Error).cause ?? err) } : undefined,
      },
      { status: network ? 502 : 500 },
    );
  }
}
