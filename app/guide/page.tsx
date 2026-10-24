import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowDown, ChevronLeft, Droplets } from 'lucide-react';
import styles from './guide.module.css';

export const metadata: Metadata = {
  title: 'Burn care guide | Burn Snap',
  description: 'Step-by-step burn management using the ATLS ABCDE approach: airway, breathing, circulation and fluid formulas.',
};

const AIRWAY_SIGNS = [
  'Singed nasal hair',
  'Hoarse voice',
  'Soot (carbon) in sputum',
  'Burn in a closed room',
  'Burns of the head, face or neck',
  'Altered sensorium (confused or drowsy)',
];

const HYPOXIA_CAUSES = [
  { title: 'Smoke inhalation', text: 'Breathing in smoke damages the lungs.' },
  { title: 'Airway collapse', text: 'Swelling can close the airway quickly.' },
  {
    title: 'Carbon monoxide (CO) poisoning',
    text: 'CO sticks to haemoglobin more strongly than oxygen does, so less oxygen reaches the body.',
  },
  {
    title: 'Eschar around the chest',
    text: 'Tight, burnt skin stops the chest from expanding.',
    tag: 'Escharotomy needed',
  },
];

const RATES = [
  {
    title: 'Thermal burns',
    age: 'Adults and children 13 years and older',
    math: '[2 × weight (kg) × %TBSA] ÷ 16',
    urine: '0.5 mL/kg/hour (30 to 50 mL/hour)',
  },
  {
    title: 'Thermal burns',
    age: 'Children under 13 years',
    math: '[3 × weight (kg) × %TBSA] ÷ 16',
    urine: '1 mL/kg/hour',
  },
  {
    title: 'Thermal burns',
    age: 'Age 1 year or less, or weight 30 kg or less',
    math: '[3 × weight (kg) × %TBSA] ÷ 16',
    extra: 'Add Ringer’s lactate with 5% dextrose, given at the maintenance rate.',
    urine: '1 mL/kg/hour',
  },
  {
    title: 'Electrical burns',
    age: 'All ages',
    math: '[4 × weight (kg) × %TBSA] ÷ 16',
    extra: 'Children under 13 years also need Ringer’s lactate with 5% dextrose at the maintenance rate.',
    urine: '1 to 1.5 mL/kg/hour (until the urine clears)',
  },
];

export default function GuidePage() {
  return (
    <main className="app-viewport">
      <div className={styles.topbar}>
        <Link href="/" className={styles.back} aria-label="Back to home">
          <ChevronLeft size={16} strokeWidth={2.6} />
        </Link>
        <span className={styles.eyebrow}>Burn care guide</span>
      </div>

      <section className={styles.hero}>
        <h1>Burn care, step by step</h1>
        <p>The ATLS ABCDE approach in plain words, with the fluid formulas you need at the bedside.</p>
      </section>

      <nav className={styles.jump} aria-label="Sections">
        <a className={styles.pill} href="#airway"><b>A</b>Airway</a>
        <a className={styles.pill} href="#breathing"><b>B</b>Breathing</a>
        <a className={styles.pill} href="#circulation"><b>C</b>Circulation</a>
        <a className={styles.pill} href="#fluids"><b><Droplets size={11} strokeWidth={2.6} /></b>Fluid rates</a>
      </nav>

      {/* ABCDE overview */}
      <section className={styles.card} id="abcde">
        <div className={styles.sectionHead}>
          <div className={styles.letter}>5</div>
          <div>
            <h2>The 5 steps</h2>
            <span>Work through them in this order</span>
          </div>
        </div>
        <div className={styles.steps}>
          <a className={styles.step} href="#airway">
            <div className={styles.letterSm}>A</div>
            <strong>Airway</strong>
          </a>
          <a className={styles.step} href="#breathing">
            <div className={styles.letterSm}>B</div>
            <strong>Breathing</strong>
          </a>
          <a className={styles.step} href="#circulation">
            <div className={styles.letterSm}>C</div>
            <strong>Circulation</strong>
          </a>
          <div className={styles.step}>
            <div className={styles.letterSm}>D</div>
            <strong>Disability</strong>
          </div>
          <div className={styles.step}>
            <div className={styles.letterSm}>E</div>
            <strong>Exposure</strong>
            <div className={styles.stepNote}>
              <span className={styles.chipSm}>Cause of burn</span>
              <span className={styles.chipSm}>Extent of burn</span>
            </div>
          </div>
        </div>
      </section>

      {/* A: Airway */}
      <section className={styles.card} id="airway">
        <div className={styles.sectionHead}>
          <div className={styles.letter}>A</div>
          <div>
            <h2>Airway</h2>
            <span>Check for a burnt airway first</span>
          </div>
        </div>

        <div className={styles.label}>Signs of an airway burn</div>
        <div className={styles.chips}>
          {AIRWAY_SIGNS.map((s) => (
            <span key={s} className={styles.chip}>{s}</span>
          ))}
        </div>

        <div className={styles.callout}>
          <AlertTriangle size={20} />
          <div>
            <strong>Intubate early</strong>
            <p>Airway burns need prophylactic intubation, because the airway can collapse quickly.</p>
          </div>
        </div>

        <div className={styles.label} style={{ marginTop: 24 }}>How an airway burn develops</div>
        <div className={styles.timeline}>
          <div className={styles.tStep}>
            <div className={styles.dot}>1</div>
            <div>
              <h3>Acute pulmonary insufficiency</h3>
              <p>Low oxygen in the blood (hypoxia).</p>
            </div>
          </div>
          <div className={styles.tStep}>
            <div className={styles.dot}>2</div>
            <div>
              <h3>
                ARDS-like picture <span className={styles.when}>24 to 48 hrs</span>
              </h3>
              <ul>
                <li>Infiltrates in both lungs, with hypoxia.</li>
                <li>Needs intubation and bronchodilators.</li>
              </ul>
            </div>
          </div>
          <div className={styles.tStep}>
            <div className={styles.dot}>3</div>
            <div>
              <h3>Bronchopneumonia</h3>
              <p>Burn injures the lining of the airway, which weakens the immune response.</p>
            </div>
          </div>
        </div>

        <table className={styles.miniTable}>
          <thead>
            <tr>
              <th>Phase</th>
              <th>When</th>
              <th>Usual germ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Early</td>
              <td>1 to 3 days</td>
              <td>S. aureus</td>
            </tr>
            <tr>
              <td>Late</td>
              <td>After 3 days</td>
              <td>Gram-negative bacteria</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* B: Breathing */}
      <section className={styles.card} id="breathing">
        <div className={styles.sectionHead}>
          <div className={styles.letter}>B</div>
          <div>
            <h2>Breathing</h2>
            <span>Why the patient may have low oxygen</span>
          </div>
        </div>
        <div className={styles.causes}>
          {HYPOXIA_CAUSES.map((c, i) => (
            <div key={c.title} className={styles.cause}>
              <div className={styles.n}>{i + 1}</div>
              <div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                {c.tag && <span className={styles.tag}>{c.tag}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* C: Circulation */}
      <section className={styles.card} id="circulation">
        <div className={styles.sectionHead}>
          <div className={styles.letter}>C</div>
          <div>
            <h2>Circulation</h2>
            <span>Why burn patients lose so much fluid</span>
          </div>
        </div>

        <div className={styles.flow}>
          <div className={`${styles.node} ${styles.nodeAccent}`}>Burn injury</div>
          <div className={styles.arrow}><ArrowDown size={16} /></div>
          <div className={styles.node}>Inflammatory chemicals are released</div>
          <div className={styles.arrow}><ArrowDown size={16} /></div>
          <div className={styles.branch}>
            <div className={styles.node}>
              Burn under 10% TBSA
              <small>Local immune response</small>
            </div>
            <div className={styles.node}>
              Burn over 10% TBSA
              <small>Whole-body immune response</small>
            </div>
          </div>
          <div className={styles.arrow}><ArrowDown size={16} /></div>
          <div className={styles.node}>Blood vessels widen (vasodilation)</div>
          <div className={styles.arrow}><ArrowDown size={16} /></div>
          <div className={styles.branch}>
            <div className={styles.node}>
              More evaporation
              <small>Leads to dehydration</small>
            </div>
            <div className={styles.node}>
              Leaky vessels <small>(12 to 24 hrs)</small>
              <small>Albumin escapes into the tissues, causing swelling (third-space loss)</small>
            </div>
          </div>
        </div>

        <div className={styles.label} style={{ marginTop: 24 }}>Which fluid to give</div>
        <div className={styles.twoCol}>
          <div className={styles.pick}>
            <h3>Crystalloids</h3>
            <p>Use the Parkland formula. Ringer’s lactate is the most common choice.</p>
          </div>
          <div className={`${styles.pick} ${styles.alt}`}>
            <h3>Colloids</h3>
            <p>After 12 hours, use the Muir and Barclay formula.</p>
          </div>
        </div>

        <div className={styles.label} style={{ marginTop: 24 }}>Parkland formula</div>
        <div className={styles.formula}>
          <div className={styles.name}>Fluid needed in 24 hours</div>
          <div className={styles.math}>
            <em>4</em> × body weight (kg) × %TBSA
          </div>
          <div className={styles.note}>Do not count first-degree burns in the %TBSA.</div>
          <div className={styles.split}>
            <div className={styles.splitBox}>
              <b>½</b>
              <span>in the first 8 hours</span>
            </div>
            <div className={styles.splitBox}>
              <b>½</b>
              <span>in the next 16 hours</span>
            </div>
          </div>
        </div>

        <div className={styles.formulaLight}>
          <div className={styles.name}>Modified Parkland (Brooke)</div>
          <div className={styles.math}>2 × body weight (kg) × %TBSA</div>
        </div>
      </section>

      {/* ATLS 11th edition rates */}
      <section className={styles.card} id="fluids">
        <div className={styles.sectionHead}>
          <div className={styles.letter}><Droplets size={22} strokeWidth={2.4} /></div>
          <div>
            <h2>Starting fluid rates</h2>
            <span>ATLS 11th edition, Ringer’s lactate</span>
          </div>
        </div>
        <p className={styles.example} style={{ marginTop: 0, marginBottom: 14 }}>
          Start with these rates, then <strong>adjust to the urine output</strong> and how the patient responds.
        </p>

        <div className={styles.rates}>
          {RATES.map((r) => (
            <div key={r.title + r.age} className={styles.rate}>
              <div className={styles.rateHead}>
                <h3>{r.title}</h3>
                <span className={styles.age}>{r.age}</span>
              </div>
              <div className={styles.rateMath}>
                {r.math} <span>mL/hour</span>
              </div>
              {r.extra && <div className={styles.rateExtra}>{r.extra}</div>}
              <div className={styles.urine}>
                <span>Urine target</span>
                <b>{r.urine}</b>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.label} style={{ marginTop: 26 }}>Dextrose maintenance (per 24 hours)</div>
        <div className={styles.bands}>
          <div className={styles.band}>
            <span>First 10 kg</span>
            <b>100 mL/kg</b>
          </div>
          <div className={styles.band}>
            <span>Next 10 kg</span>
            <b>50 mL/kg</b>
          </div>
          <div className={styles.band}>
            <span>Every kg after 20 kg</span>
            <b>20 mL/kg</b>
          </div>
        </div>
        <p className={styles.example}>
          Example: a 25 kg child needs <strong>1,000 + 500 + 100 = 1,600 mL</strong> in 24 hours.
        </p>
      </section>

      <p className={styles.source}>
        Based on ATLS 11th edition notes and study material. This is a quick reference. Always follow your local burn protocol.
      </p>
    </main>
  );
}
