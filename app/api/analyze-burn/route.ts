import { NextResponse } from 'next/server';
import {
  REGION_IDS,
  buildRegionPromptCatalog,
  computeTbsa,
  parklandFluidMl,
  type BurnDepth,
  type BurnRegionResult,
} from '@/lib/rule-of-nines';

const VISION_MODEL = 'gemini-3.6-flash';
const MAX_IMAGES = 6;
const VALID_DEPTHS: BurnDepth[] = ['superficial', 'partial', 'full', 'mixed', 'unknown'];
const VALID_VIEWS = ['anterior', 'posterior', 'left_lateral', 'right_lateral', 'close_up', 'unclear'];

interface RawRegion {
  id?: string;
  unknown?: boolean;
  visiblePct?: number;
  coveragePct?: number;
  depth?: string;
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
    const unknown = Boolean(item.unknown) || visiblePct < 5;
    const depthRaw = String(item.depth ?? 'unknown').toLowerCase();
    const depth = VALID_DEPTHS.includes(depthRaw as BurnDepth) ? (depthRaw as BurnDepth) : 'unknown';
    byId.set(item.id, {
      id: item.id,
      coveragePct: unknown ? 0 : clamp(Number(item.coveragePct ?? 0), 0, 100),
      depth,
      center: { u: clamp(Number(item.center?.u ?? 0.5), 0, 1), v: clamp(Number(item.center?.v ?? 0.5), 0, 1) },
      spread: { u: clamp(Number(item.spread?.u ?? 0.5), 0.05, 0.5), v: clamp(Number(item.spread?.v ?? 0.5), 0.05, 0.5) },
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
      ? 'This is a young child: paediatric Rule-of-Nines weights are used (head 18%, each leg 13.5%).'
      : age < 15
        ? 'This is a child: paediatric Rule-of-Nines weights are used (head 14%, each leg 15.5%).'
        : 'Adult Rule-of-Nines weights are used.';

  return `You are the burn-surface-area vision engine inside a clinical burn triage tool used by emergency clinicians. Your numbers feed a Rule-of-Nines TBSA calculation and a 3D body map, so precision, correct body orientation and honesty about what you cannot see all matter more than sounding confident.

PATIENT: ${age} years old, ${gender}. ${ageNote}
INPUT: ${imageCount} photo(s) of this ONE patient, in order (image index 0 .. ${imageCount - 1}). Photos can be anything: full-body shots, a single limb, a torso, a close-up of one wound, or several angles of the same area. Do NOT assume the whole body is visible. Merge everything into ONE assessment and never double count an area that appears in more than one photo.

STEP 1 — ORIENT EVERY PHOTO (this is where most errors come from)
For each image decide which surface of the patient's body it shows: anterior (front), posterior (back), left_lateral, right_lateral, close_up (too tight to orient) or unclear.
Use anatomical cues, e.g. face / nipples / umbilicus / genitalia / kneecaps / palms-up = anterior; spine / scapulae / gluteal cleft / back of head / back of hands / heels / popliteal fossa = posterior. Record the cues you used in "cues".
LEFT and RIGHT always mean the PATIENT's left and right, never the viewer's. In an ANTERIOR photo the patient's left side appears on the RIGHT of the image. In a POSTERIOR photo the patient's left side appears on the LEFT of the image. Do not assume a selfie-style mirror flip.

STEP 2 — REGIONS
Use exactly these region ids (return one entry for every id):
${catalog}

Region boundaries: head & neck down to the shoulders; arms from the shoulder to the fingertips; trunk from shoulders to the top of the thighs, split into upper and lower halves; legs from the groin crease / gluteal fold to the toes. Anterior and posterior halves of a limb are the two faces of that limb.

STEP 3 — MEASURE EACH REGION
- visiblePct (0-100): how much of that whole region is actually visible across all photos. If you cannot see it at all (or <5%), set unknown=true; it will be excluded from the total — do NOT guess and do NOT report 0 for unseen skin.
- coveragePct (0-100): the % of the WHOLE region's surface that is burned. Count only visible burn; unseen skin is treated as unburned. A fully burned region is 100. Visible but unburned = 0 with unknown=false.
- Count ONLY partial-thickness (second degree: blisters, wet/weeping, mottled red-white) and full-thickness (third degree: leathery, waxy white, brown, black/charred, no blanching) burns. Exclude simple erythema (superficial first-degree, like sunburn), soot on intact skin, clothing, dressings, shadows and tattoos.
- depth: "partial", "full" or "mixed" (both present) for burned regions; "unknown" if coveragePct is 0.
- Sizing aids: the patient's palm including fingers is roughly 1% of total body surface. Use limb width, anatomical landmarks and the relative size of the wound to the region to estimate the fraction. Be quantitative; use finer values than multiples of 25 when the image supports it.
- Where the burn sits inside the region, use REGION-LOCAL coordinates (each 0-1) as seen when looking at that surface from outside:
  center.u: 0 = left edge of the region, 1 = right edge, as the viewer sees that surface (anterior regions: patient's right to patient's left; posterior regions: patient's left to patient's right)
  center.v: 0 = top of the region, 1 = bottom (head end -> foot end; for arms, shoulder -> fingertips; for legs, groin -> toes)
  spread.u / spread.v: half-width / half-height of the burned patch around the center in the same units (0.05-0.5). A region that is burned all over: center (0.5, 0.5), spread (0.5, 0.5). Several separate patches in one region: give the center and spread of the dominant one; coveragePct still covers all of them.

STEP 4 — SELF-CHECK before answering
Does every burn you placed on a left/right/front/back region match the orientation you decided in step 1? Is anything counted twice across photos? Are unseen regions marked unknown instead of 0? Fix mistakes first.

OUTPUT: JSON only, matching the schema. No prose, no markdown. "confidence" is 0-1 for the overall estimate (lower it for poor lighting, partial views, or heavy ambiguity). "notes" is at most 300 characters of clinically useful remarks (e.g. which regions are uncertain or not photographed).`;
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
      unknown: { type: 'BOOLEAN' },
      visiblePct: { type: 'NUMBER' },
      coveragePct: { type: 'NUMBER' },
      depth: { type: 'STRING', enum: ['partial', 'full', 'mixed', 'unknown'] },
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
    required: ['id', 'unknown', 'visiblePct', 'coveragePct', 'depth', 'center', 'spread'],
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
            regionsVisible: { type: 'ARRAY', items: { type: 'STRING', enum: [...REGION_IDS] } },
          },
          required: ['index', 'view', 'isFullBody', 'cues', 'regionsVisible'],
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
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Vision API error', res.status, errText);
      return NextResponse.json({ error: 'Burn image analysis request failed.', debug: { status: res.status, body: errText } }, { status: 502 });
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

    return NextResponse.json({
      regions,
      tbsa,
      fluidMl: parklandFluidMl(weightKg, tbsa),
      confidence: clamp(Number(assessment.confidence ?? 0.5), 0, 1),
      notes: assessment.notes ?? '',
      images: assessment.images ?? [],
      debug: { model: VISION_MODEL, imageCount: parsedImages.length, rawText, usage: json?.usageMetadata ?? null },
    });
  } catch (err) {
    console.error('analyze-burn error', err);
    return NextResponse.json({ error: 'Burn analysis failed.' }, { status: 500 });
  }
}
