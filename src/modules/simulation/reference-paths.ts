// The reference paths (V3 Design E): fixed decision paths a reference firm
// plays, so faculty can see what different strategies lead to. Each path is a
// pure function of the quarter and the module schedule: it uses a module's
// decision only when that module is open, and the locked fallback otherwise.
// Every number comes from CONFIG or the decision schema's own defaults, so a
// config change moves a path with it. Golden tests pin what each path scores.

import { CONFIG } from './simulation.config';
import { DecisionSchema } from '../../entities/index.entity';

export const REFERENCE_PATH_IDS = [
  'model_forecaster',
  'own_estimate_forecaster',
  'price_cutter',
] as const;
export type ReferencePathId = (typeof REFERENCE_PATH_IDS)[number];

/** The own-estimate forecaster adds this to last quarter's actual demand. */
export const OWN_ESTIMATE_UPLIFT = 0.1;
/** The price cutter prices this far below base. */
export const PRICE_CUT = 0.15;
/** The price cutter spends this share of the average marketing. */
export const CUTTER_MARKETING_SHARE = 0.5;

type Regions = { r1: number; r2: number; r3: number };

export interface PathContext {
  quarter: number;
  /** This quarter's seasonal multiplier (the course's own seasonality). */
  seasonalMultiplier: number;
  /** Last quarter's actual demand per region, or null if there is none. */
  lastActualDemand: Regions | null;
  /** The firm's market share going into the quarter. */
  marketShare: number;
  /** Which modules are open this quarter. */
  open: Record<string, boolean>;
}

const schemaDefault = (field: string): number => {
  const d = (DecisionSchema.path(field) as any)?.options?.default;
  return typeof d === 'number' ? d : 0;
};

const M = () => CONFIG.market;
const round = Math.round;

/** What the forecasting model says: expected regional demand, without the noise. */
export function modelForecast(ctx: PathContext): Regions {
  const m = M();
  return {
    r1: round(
      m.TOTAL_MARKET_SIZE * m.REGIONS[1].marketShare * ctx.seasonalMultiplier,
    ),
    r2: round(
      m.TOTAL_MARKET_SIZE * m.REGIONS[2].marketShare * ctx.seasonalMultiplier,
    ),
    r3: round(
      m.TOTAL_MARKET_SIZE * m.REGIONS[3].marketShare * ctx.seasonalMultiplier,
    ),
  };
}

export function ownEstimateForecast(ctx: PathContext): Regions {
  const last = ctx.lastActualDemand ?? modelForecast(ctx);
  const up = 1 + OWN_ESTIMATE_UPLIFT;
  return {
    r1: round(last.r1 * up),
    r2: round(last.r2 * up),
    r3: round(last.r3 * up),
  };
}

const total = (r: Regions) => r.r1 + r.r2 + r.r3;

/** Production for a firm's expected sales, split by the products' shares. */
function produceFor(expectedUnits: number) {
  const p = M().PRODUCTS;
  return {
    productionP1: round(expectedUnits * p.P1.marketShare),
    productionP2: round(expectedUnits * p.P2.marketShare),
  };
}

export interface ReferencePath {
  id: ReferencePathId;
  name: string;
  /** One sentence per quarter for faculty. */
  plan: (ctx: PathContext) => string;
  /** The decision fields this path sets; every other field keeps its default. */
  decide: (ctx: PathContext) => Record<string, unknown>;
}

const base = () => {
  const p = M().PRODUCTS;
  return {
    priceP1: p.P1.basePrice,
    priceP2: p.P2.basePrice,
    marketingBudget: schemaDefault('marketingBudget'),
  };
};

function forecastingPath(
  id: ReferencePathId,
  name: string,
  method: 'MODEL' | 'GUT',
  forecast: (c: PathContext) => Regions,
  how: string,
): ReferencePath {
  return {
    id,
    name,
    plan: (ctx) =>
      ctx.open.ds
        ? `Quarter ${ctx.quarter}: ${how}, produces to it, and keeps base prices and the average marketing.`
        : `Quarter ${ctx.quarter}: Demand Science is not open, so it keeps the starting forecast and production, base prices and the average marketing.`,
    decide: (ctx) => {
      if (!ctx.open.ds) return { ...base() };
      const f = forecast(ctx);
      return {
        ...base(),
        forecastR1: f.r1,
        forecastR2: f.r2,
        forecastR3: f.r3,
        forecastMethod: method,
        ...produceFor(total(f) * ctx.marketShare),
      };
    },
  };
}

export const REFERENCE_PATHS: Record<ReferencePathId, ReferencePath> = {
  model_forecaster: forecastingPath(
    'model_forecaster',
    'Model forecaster',
    'MODEL',
    modelForecast,
    'forecasts each region with the forecasting model',
  ),
  own_estimate_forecaster: forecastingPath(
    'own_estimate_forecaster',
    'Own-estimate forecaster',
    'GUT',
    ownEstimateForecast,
    `forecasts each region as last quarter's actual demand plus ${round(OWN_ESTIMATE_UPLIFT * 100)}%`,
  ),
  price_cutter: {
    id: 'price_cutter',
    name: 'Price cutter',
    plan: (ctx) =>
      `Quarter ${ctx.quarter}: prices ${round(PRICE_CUT * 100)}% below base, produces for the extra demand, and spends half the average marketing.`,
    decide: (ctx) => {
      const b = base();
      const factor = 1 - PRICE_CUT;
      const units = ctx.open.ds
        ? total(modelForecast(ctx)) * ctx.marketShare
        : schemaDefault('productionP1') + schemaDefault('productionP2');
      const out: Record<string, unknown> = {
        priceP1: round(b.priceP1 * factor),
        priceP2: round(b.priceP2 * factor),
        marketingBudget: round(b.marketingBudget * CUTTER_MARKETING_SHARE),
        ...produceFor(units / factor),
      };
      if (ctx.open.ds) {
        const f = modelForecast(ctx);
        Object.assign(out, {
          forecastR1: f.r1,
          forecastR2: f.r2,
          forecastR3: f.r3,
          forecastMethod: 'MODEL',
        });
      }
      return out;
    },
  },
};

export const isReferencePath = (id: unknown): id is ReferencePathId =>
  typeof id === 'string' &&
  (REFERENCE_PATH_IDS as readonly string[]).includes(id);
