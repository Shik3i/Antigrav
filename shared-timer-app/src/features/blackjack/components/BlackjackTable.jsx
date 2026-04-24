import { Crown, ShieldAlert } from 'lucide-react';
import EVENTS from '../../../../socketEvents.json';
import BlackjackDealer from './BlackjackDealer';
import BlackjackSeat from './BlackjackSeat';
const STATUS_LABELS = {
  waiting: 'Wartet auf Spieler',
  betting: 'Einsätze werden platziert',
  dealing: 'Karten werden ausgeteilt',
  player_turns: 'Spieler am Zug',
  dealer_turn: 'Dealer spielt',
  settlement: 'Abrechnung läuft'
};

function FeltPile({ label, count, side = 'left', accent = '#f8fafc' }) {
  return (
    <div className={`blackjack-felt-pile ${side}`}>
      <div className="blackjack-felt-pile-cards">
        <div className="blackjack-felt-pile-card shadow" />
        <div className="blackjack-felt-pile-card top" />
      </div>
      <div className="blackjack-felt-pile-meta">
        <div className="blackjack-felt-pile-label">{label}</div>
        <div className="blackjack-felt-pile-count" style={{ color: accent }}>{count}</div>
      </div>
    </div>
  );
}

function sortPlayerSettlements(a, b) {
  const aIsSideBet = a.settlementType === 'sideBet';
  const bIsSideBet = b.settlementType === 'sideBet';
  if (aIsSideBet !== bIsSideBet) return aIsSideBet ? 1 : -1;
  if (aIsSideBet && bIsSideBet) return String(a.sideBetKey || '').localeCompare(String(b.sideBetKey || ''));
  return Number(a.handIndex || 0) - Number(b.handIndex || 0);
}

export default function BlackjackTable({
  actionBusy,
  autoBetEnabled,
  config,
  error,
  handleBetSubmit,
  handleLeaveTable,
  handleSmartJoin,
  handleSideBetSubmit,
  handleTurnAction,
  isGuest,
  mySeat,
  pendingBet,
  roomState,
  selectedTable,
  setAutoBetEnabled,
  setPendingBet,
  tableSeats,
  tableStatusMeta,
  user
}) {
  return (
    <section className="blackjack-table-shell">
      <div className="blackjack-table-shell-frame" />

      <div className="blackjack-table-topbar">
        <div>
          <div className="blackjack-title-row">
            <div className="blackjack-title-badge">
              <Crown size={20} />
            </div>
            <div>
              <h1 className="blackjack-page-title">Blackjack Table</h1>
              <div className="blackjack-title-copy">Live-Raum mit 6-Deck-Shoe, Burn Card und Settlement erst am Ende.</div>
            </div>
          </div>
          <div className="blackjack-status-pills">
            <div className="blackjack-status-pill">Status: {STATUS_LABELS[roomState?.status] || 'Unbekannt'}</div>
            <div className="blackjack-status-pill">Shoe: {roomState?.shoeRemaining ?? 0} Karten</div>
            <div className={`blackjack-status-pill${roomState?.needsShuffle ? ' is-alert' : ''}`}>
              {roomState?.needsShuffle ? 'Reshuffle vor nächster Hand' : `Reshuffle bei ${config?.reshuffleRemainingPercent || 25}%`}
            </div>
          </div>
        </div>

        <div className="blackjack-header-status">
          <div className="blackjack-status-label">
            {tableStatusMeta.label}
          </div>
          <div className="blackjack-status-summary">
            <div className="blackjack-countdown-clock" style={{ color: tableStatusMeta.color }}>
              {String(tableStatusMeta.seconds).padStart(2, '0')}s
            </div>
            <div className="blackjack-status-copy">
              {tableStatusMeta.copy}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="blackjack-error-banner">
          <ShieldAlert size={16} />
          {error}
        </div>
      )}

      <div className="blackjack-table-stack">
        <div className="blackjack-stage">
          <div className="blackjack-table-center blackjack-table-copy">
            <div className="blackjack-table-copy-inner">
              <div>Blackjack pays 3 to 2</div>
              <div className="blackjack-table-copy-subline">Dealer hits soft 17</div>
            </div>
          </div>

          <FeltPile label="Shoe" count={roomState?.shoeRemaining ?? 0} side="right" accent="#fbbf24" />
          <FeltPile label="Discard" count={roomState?.discardCount ?? 0} side="left" accent="#93c5fd" />

          <BlackjackDealer roomState={roomState} />

          {tableSeats.map((player) => {
            const isCurrentTurn = String(roomState?.currentPlayerTurn) === String(player.userId);
            const settlements = (roomState?.lastSettlement || []).filter((entry) => String(entry.userId) === String(player.userId)).sort(sortPlayerSettlements);
            return (
              <BlackjackSeat
                key={player.userId || `seat-${player.seat}`}
                player={player}
                selectedTable={selectedTable}
                roomState={roomState}
                settlements={settlements}
                isCurrentTurn={isCurrentTurn}
                isLocalPlayer={String(player.userId) === String(user?.id)}
                canSelectEmptySeat={!actionBusy && (!mySeat || roomState?.status === 'waiting' || roomState?.status === 'betting')}
                onSelectEmptySeat={handleSmartJoin}
                onSideBetSubmit={handleSideBetSubmit}
                onHit={() => handleTurnAction(EVENTS.BLACKJACK_HIT)}
                onStand={() => handleTurnAction(EVENTS.BLACKJACK_STAND)}
                onDouble={() => handleTurnAction(EVENTS.BLACKJACK_DOUBLE)}
                onSplit={() => handleTurnAction(EVENTS.BLACKJACK_SPLIT)}
                onChipAdd={(amt) => setPendingBet((prev) => prev + amt)}
                onChipSub={() => setPendingBet(0)}
                onBetSubmit={handleBetSubmit}
                onLeaveSeat={handleLeaveTable}
                pendingBet={pendingBet}
                autoBetEnabled={autoBetEnabled}
                onToggleAutoBet={() => setAutoBetEnabled((prev) => !prev)}
                balance={user?.koala_balance || 0}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
