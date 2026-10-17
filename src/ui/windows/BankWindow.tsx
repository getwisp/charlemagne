import { useState } from 'react';
import { actions, annuity, assetValue, creditLimit, EARLY_REPAYMENT_FEE, LOAN_TERMS, loanRate, savingsRate, totalDebt } from '../../engine';
import { GroupBox, n, NumberField } from '../components/controls';
import { useGame } from '../context';

export function BankWindow() {
  const { state, me, act, canAct } = useGame();
  const [amount, setAmount] = useState(1000);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [term, setTerm] = useState(5);
  const rate = loanRate(me, state.market, assetValue(me, state.market));
  const limit = creditLimit(me, state.market);

  return (
    <div>
      <div className="sunken field" style={{ padding: 6, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span>
          Leitzins: <b>{state.market.baseRate} %</b>
        </span>
        <span>
          Sparzins: <b>{savingsRate(state.market)} %</b>
        </span>
        <span>
          Kreditzins für Euch: <b>{rate} %</b>
        </span>
      </div>

      <GroupBox label={`Sparkonto: ${n(me.savings)} Taler`}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <NumberField value={amount} onChange={setAmount} step={500} label="Betrag" /> Taler
          <button className="btn" disabled={!canAct} onClick={() => act((s) => actions.deposit(s, me.id, amount))}>
            Einzahlen
          </button>
          <button className="btn" disabled={!canAct} onClick={() => act((s) => actions.withdraw(s, me.id, amount))}>
            Abheben
          </button>
        </div>
        <div className="hint">Guthaben bei der Bank wirft Zinsen ab und ist zu 100 % vor Dieben sicher. Im Bankrott wird es allerdings zuerst gepfändet.</div>
      </GroupBox>

      <GroupBox label={`Kredite (Schulden: ${n(totalDebt(me))} Taler)`}>
        {me.loans.length > 0 ? (
          <div className="table-wrap sunken">
            <table className="grid">
              <thead>
                <tr>
                  <th className="num">Restschuld</th>
                  <th className="num">Zins</th>
                  <th className="num">Rate/Jahr</th>
                  <th className="num">Restlaufzeit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {me.loans.map((l) => (
                  <tr key={l.id}>
                    <td className="num">
                      {n(l.remaining)}
                      {l.forced && <span className="neg"> (Zwang)</span>}
                    </td>
                    <td className="num">{l.rate} %</td>
                    <td className="num">{n(l.annuity)}</td>
                    <td className="num">{l.yearsLeft} J.</td>
                    <td>
                      <button className="btn small" disabled={!canAct} onClick={() => act((s) => actions.repayLoan(s, me.id, l.id))} title={`Sondertilgung mit ${EARLY_REPAYMENT_FEE * 100} % Gebühr`}>
                        Tilgen ({n(l.remaining * (1 + EARLY_REPAYMENT_FEE))})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">Keine offenen Kredite.</div>
        )}
        <hr className="etched" />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          Neuer Kredit: <NumberField value={loanAmount} onChange={setLoanAmount} step={1000} label="Kreditsumme" />
          <select className="input" value={term} onChange={(e) => setTerm(Number(e.target.value))} aria-label="Laufzeit">
            {LOAN_TERMS.map((t) => (
              <option key={t} value={t}>
                {t} Jahre
              </option>
            ))}
          </select>
          <button className="btn" disabled={!canAct || loanAmount <= 0} onClick={() => act((s) => actions.takeLoan(s, me.id, loanAmount, term))}>
            Aufnehmen
          </button>
        </div>
        <div className="hint">
          Kreditrahmen: <b>{n(limit)}</b> Taler. Jährliche Rate: {n(annuity(loanAmount, rate, term))} Taler über {term} Jahre (fester Zins {rate} %).
        </div>
      </GroupBox>

      <GroupBox label="Insolvenzordnung">
        <ol className="hint" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Pfändung des Sparkontos</li>
          <li>Zwangsversteigerung von Land und Gebäuden zum halben Preis</li>
          <li>Schuldturm: ein Jahr aussetzen – keine Kornausgabe, keine Befehle, wehrlos – und Rückstufung</li>
        </ol>
      </GroupBox>
    </div>
  );
}
