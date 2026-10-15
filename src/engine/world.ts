import {
  BASE_RATE_MAX,
  BASE_RATE_MIN,
  GRAIN_PRICE_MAX,
  GRAIN_PRICE_MIN,
  LAND_PRICE_MAX,
  LAND_PRICE_MIN,
  WEATHER_TABLE,
  WEATHER_WEIGHTS,
} from './constants';
import { randFloat, randInt, weightedIndex, type HasRng } from './rng';
import type { MarketState } from './types';
import { clamp } from './util';

/** Würfelt Wetter, Ernte-Faktor, Markt- und Landpreise sowie den Leitzins für ein neues Jahr. */
export function rollMarket(s: HasRng, previous: MarketState | null): MarketState {
  const w = WEATHER_TABLE[weightedIndex(s, WEATHER_WEIGHTS)];
  const harvestFactor = Math.round(randFloat(s, w.min, w.max) * 100) / 100;
  // 0 = schlechtestes, 1 = bestes Wetter
  const t = (harvestFactor - 0.4) / 1.2;
  const grainPrice = clamp(
    Math.round(GRAIN_PRICE_MAX - (GRAIN_PRICE_MAX - GRAIN_PRICE_MIN) * t + randInt(s, -3, 3)),
    GRAIN_PRICE_MIN,
    GRAIN_PRICE_MAX,
  );
  const landPrice = clamp(
    Math.round(LAND_PRICE_MIN + (LAND_PRICE_MAX - LAND_PRICE_MIN) * t + randInt(s, -3, 3)),
    LAND_PRICE_MIN,
    LAND_PRICE_MAX,
  );
  const prevRate = previous?.baseRate ?? 5;
  const baseRate = clamp(prevRate + randInt(s, -1, 1), BASE_RATE_MIN, BASE_RATE_MAX);
  return { weather: w.weather, harvestFactor, grainPrice, landPrice, baseRate };
}
