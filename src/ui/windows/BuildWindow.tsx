import {
  actions,
  BUILDINGS,
  CITY_MARKETS,
  CITY_MILLS,
  CITY_BONUS_FULL_CITIES,
  CITY_TAX_BONUS,
  CITY_TAX_BONUS_LATE,
  cityBonusFactor,
  cityCount,
  freeLand,
  HECTARES_PER_BUILDING,
  titleName,
  type BuildingType,
} from '../../engine';
import { GroupBox, n, Progress } from '../components/controls';
import { useGame } from '../context';

const ORDER: BuildingType[] = ['market', 'mill', 'granary', 'palace', 'cathedral'];

export function BuildWindow() {
  const { me, act, canAct } = useGame();
  const free = freeLand(me);
  const cities = cityCount(me.buildings);
  const nextMarkets = CITY_MARKETS * (cities + 1);
  const nextMills = CITY_MILLS * (cities + 1);

  return (
    <div>
      <div className="hint">
        Jedes Gebäude benötigt {n(HECTARES_PER_BUILDING)} ha freies Land. Freies Ackerland: <b>{n(free)} ha</b> (reicht für {Math.floor(free / HECTARES_PER_BUILDING)} Gebäude). Bebautes Land fehlt bei der Ernte!
      </div>
      <div className="table-wrap sunken">
        <table className="grid">
          <thead>
            <tr>
              <th>Gebäude</th>
              <th className="num">Bestand</th>
              <th className="num">Kosten</th>
              <th className="num">Unterhalt</th>
              <th>Wirkung</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ORDER.map((t) => {
              const def = BUILDINGS[t];
              const locked = me.title < def.minTitle;
              return (
                <tr key={t}>
                  <td>
                    <b>{def.name}</b>
                    {locked && <div className="muted">ab {titleName(def.minTitle, me.female)}</div>}
                  </td>
                  <td className="num">{me.buildings[t]}</td>
                  <td className="num">{n(def.cost)}</td>
                  <td className="num">{def.upkeep ? n(def.upkeep) : '–'}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 160 }} className="hint">
                    {def.description}
                  </td>
                  <td>
                    <button
                      className="btn small"
                      disabled={!canAct || locked || free < HECTARES_PER_BUILDING || me.gold < def.cost}
                      onClick={() => act((s) => actions.build(s, me.id, t, 1))}
                    >
                      Bauen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <GroupBox label={`Städte: ${cities} (+${Math.round(cityBonusFactor(me.buildings) * 100)} % Steuern)`}>
        <div className="hint" style={{ marginTop: 0 }}>
          {CITY_MARKETS} Märkte + {CITY_MILLS} Mühlen verschmelzen automatisch zu einer Stadt. Die ersten {CITY_BONUS_FULL_CITIES} Städte bringen je +{CITY_TAX_BONUS * 100} % auf alle Steuern, jede weitere +{CITY_TAX_BONUS_LATE * 100} %.
        </div>
        <div className="two-col">
          <div>
            Märkte {me.buildings.market} / {nextMarkets}
            <Progress value={me.buildings.market / nextMarkets} done={me.buildings.market >= nextMarkets} />
          </div>
          <div>
            Mühlen {me.buildings.mill} / {nextMills}
            <Progress value={me.buildings.mill / nextMills} done={me.buildings.mill >= nextMills} />
          </div>
        </div>
      </GroupBox>
    </div>
  );
}
