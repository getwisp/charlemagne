import { useState } from 'react';
import { actions, freeLand, GRAIN_TRADE_UNIT, grainBuyCost, grainNeed, grainSellValue, landSellPrice } from '../../engine';
import { GroupBox, n, NumberField } from '../components/controls';
import { useGame } from '../context';

export function MarketWindow() {
  const { state, me, act, canAct } = useGame();
  const [grain, setGrain] = useState(1000);
  const [land, setLand] = useState(500);
  const { grainPrice, landPrice, weather, harvestFactor } = state.market;
  const maxBuyGrain = Math.floor(me.gold / grainPrice) * GRAIN_TRADE_UNIT;
  const maxBuyLand = Math.floor(me.gold / landPrice);

  return (
    <div>
      <div className="sunken field" style={{ padding: 6 }}>
        Wetter <b>{weather}</b> (Ernte ×{harvestFactor.toFixed(2)}). Gute Ernten drücken den Kornpreis und treiben den Landpreis – in Dürrejahren ist es umgekehrt.
      </div>

      <GroupBox label={`Korn – ${grainPrice} Taler je 10 Scheffel`}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <NumberField value={grain} onChange={setGrain} step={100} label="Scheffel" /> Scheffel
          <button className="btn small" onClick={() => setGrain(maxBuyGrain)}>
            Max. Kauf
          </button>
          <button className="btn small" onClick={() => setGrain(me.grain)}>
            Alles
          </button>
        </div>
        <div className="hint">
          Euer Vorrat: <b>{n(me.grain)} Scheffel</b> – reicht für {grainNeed(me) > 0 ? Math.floor((me.grain / grainNeed(me)) * 100) : 100} % des Bedarfs (Ration: {me.ration} %).
          <br />
          Kauf kostet {n(grainBuyCost(state, grain))} Taler · Verkauf bringt {n(grainSellValue(state, grain))} Taler (Händlerspanne 10 %).
        </div>
        <div className="btn-row">
          <button className="btn" disabled={!canAct || grain <= 0} onClick={() => act((s) => actions.buyGrain(s, me.id, grain))}>
            Kaufen
          </button>
          <button className="btn" disabled={!canAct || grain <= 0} onClick={() => act((s) => actions.sellGrain(s, me.id, grain))}>
            Verkaufen
          </button>
        </div>
      </GroupBox>

      <GroupBox label={`Land – ${landPrice} Taler je Hektar`}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <NumberField value={land} onChange={setLand} step={100} label="Hektar" /> ha
          <button className="btn small" onClick={() => setLand(maxBuyLand)}>
            Max. Kauf
          </button>
          <button className="btn small" onClick={() => setLand(freeLand(me))}>
            Alles Freie
          </button>
        </div>
        <div className="hint">
          Kauf kostet {n(land * landPrice)} Taler · Verkauf bringt {n(land * landSellPrice(state))} Taler. Verkaufen lässt sich nur freies Ackerland ({n(freeLand(me))} ha).
        </div>
        <div className="btn-row">
          <button className="btn" disabled={!canAct || land <= 0} onClick={() => act((s) => actions.buyLand(s, me.id, land))}>
            Kaufen
          </button>
          <button className="btn" disabled={!canAct || land <= 0} onClick={() => act((s) => actions.sellLand(s, me.id, land))}>
            Verkaufen
          </button>
        </div>
      </GroupBox>
    </div>
  );
}
