import { UserRound } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import BlackjackCelebration from './BlackjackCelebration';
import ChipStack from './ChipStack';
import PlayingCard from './PlayingCard';
import SettlementToast from './SettlementToast';
import { formatKC } from '../utils/formatters';
import { useChipSkin } from '../../casino/ChipSkinContext';
import { getChipColor, getChipTextColor } from '../../casino/chipConfig';

function getSeatClass(maxPlayers, seat) {
  return `blackjack-seat blackjack-seat-${maxPlayers}-${seat}`;
}

function getCommittedBetMotionClass(roomState, settlements) {
  if (roomState?.status !== 'settlement') return 'is-on-table';
  const mainSettlements = (settlements || []).filter((settlement) => settlement.settlementType !== 'sideBet');
  if (!mainSettlements.length) return 'is-on-table';

  const netProfit = mainSettlements.reduce((sum, settlement) => sum + (Number(settlement.netProfit) || 0), 0);
  if (netProfit > 0) return 'is-won';
  if (netProfit < 0) return 'is-lost';
  return 'is-push';
}

const SIDE_BET_COPY = {
  twins: {
    label: 'Twins',
    payout: '10:1',
    description: 'Erste 2 Karten gleich'
  },
  bust: {
    label: 'Bust',
    payout: '5:2',
    description: 'Dealer bustet'
  }
};

function SeatControls({
  isLocalPlayer,
  roomState,
  isCurrentTurn,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onChipAdd,
  onBetSubmit,
  pendingBet,
  canDouble,
  canSplit,
  balance
}) {
  const { skin, getSkinImage } = useChipSkin();

  if (!isLocalPlayer) return null;

  const isBetting = roomState?.status === 'betting' || roomState?.status === 'waiting';
  const hasEnoughForSplit = balance >= (roomState?.players?.find((player) => player.userId === roomState?.currentPlayerTurn)?.hands[0]?.bet || 0);

  return (
    <div className="blackjack-seat-controls-wrapper">
      <div className={`blackjack-chip-tray vertical-side${!isBetting ? ' is-planning' : ''}`}>
        {[1, 5, 25, 100, 500].map((value) => {
          const img = getSkinImage(value, skin);
          return (
            <button
              key={value}
              className={`blackjack-casino-chip${img ? ' blackjack-casino-chip--image' : ''}`}
              onClick={() => onChipAdd(value * 100)}
              title={!isBetting ? 'Auto-Bet fuer die naechste Runde anpassen' : undefined}
              style={img ? undefined : {
                '--chip-color': getChipColor(value),
                color: getChipTextColor(value),
              }}
            >
              {img ? <img src={img} alt={`${value} KC`} className="chip-skin-img" /> : value}
            </button>
          );
        })}
      </div>

      {isCurrentTurn && roomState?.status === 'player_turns' && (
        <div className="blackjack-action-column">
          <button className="blackjack-action-btn-long hit" onClick={onHit}>Hit</button>
          <button className="blackjack-action-btn-long stand" onClick={onStand}>Stand</button>
          {canDouble && (
            <button className="blackjack-action-btn-long double" onClick={onDouble}>Double</button>
          )}
          {canSplit && (
            <div style={{ position: 'relative' }}>
              <button
                className="blackjack-action-btn-long split"
                onClick={onSplit}
                disabled={!hasEnoughForSplit}
              >
                Split
              </button>
              {!hasEnoughForSplit && (
                <div style={{ position: 'absolute', top: '100%', right: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', color: '#f87171', marginTop: '4px', fontWeight: 700 }}>
                  Low Balance
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BlackjackSeat({
  autoBetEnabled,
  onToggleAutoBet,
  player,
  selectedTable,
  roomState,
  playerSkins,
  settlements,
  isCurrentTurn,
  isLocalPlayer,
  canSelectEmptySeat,
  onSelectEmptySeat,
  onSideBetSubmit,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onChipAdd,
  onChipSub,
  onBetSubmit,
  onLeaveSeat,
  pendingBet,
  balance
}) {
  const isWinningSeat = (settlements || []).some((settlement) => Number(settlement.netProfit || 0) > 0);
  const seatClassName = `${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)}${isCurrentTurn ? ' current-turn' : ''}${isWinningSeat ? ' winner-seat' : ''}${isLocalPlayer ? ' local-seat' : ''}`;
  const playerSkin = playerSkins?.[String(player.userId)];

  if (!player.userId) {
    return (
      <div className={`${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)} blackjack-seat-empty`}>
        <button
          type="button"
          className={`blackjack-seat-empty-shell${canSelectEmptySeat ? ' is-clickable' : ''}`}
          onClick={() => canSelectEmptySeat && onSelectEmptySeat?.(player)}
          disabled={!canSelectEmptySeat}
        >
          <UserRound size={18} />
          <div className="blackjack-seat-empty-title">Open seat</div>
          <div className="blackjack-seat-empty-copy">Seat {player.visualSeat}</div>
        </button>
      </div>
    );
  }

  const activeHand = player.hands?.[player.activeHandIndex] || null;
  const canSplit = player.hands?.length === 1 && player.hands[0].cards?.length === 2 && player.hands[0].cards[0].rank === player.hands[0].cards[1].rank;
  const isBettingPhase = roomState?.status === 'betting' || roomState?.status === 'waiting';
  const hasCommittedBet = Number(player.currentBet || 0) > 0;
  const committedBetMotionClass = getCommittedBetMotionClass(roomState, settlements);
  const canEditSideBets = isLocalPlayer && isBettingPhase;
  const pendingSideBets = player.pendingSideBets || {};
  const activeSideBets = player.activeSideBets || {};
  const actionLabel = hasCommittedBet ? 'Einsatz aktualisieren' : 'Einsatz setzen';
  const seatSubline = player.waitingForNextRound
    ? 'Nächste Runde'
    : isLocalPlayer ? 'You' : player.isBot ? 'Bot' : 'Player';
  const compactControls = roomState?.tableUiMode === 'compact' || roomState?.tableUiMode === 'stacked';

  return (
    <div className={seatClassName}>
      <div className={`blackjack-seat-layout-horizontal${compactControls ? ' compact-controls' : ''}`}>
        <SeatControls
          isLocalPlayer={isLocalPlayer}
          roomState={roomState}
          isCurrentTurn={isCurrentTurn}
          onHit={onHit}
          onStand={onStand}
          onDouble={onDouble}
          onSplit={onSplit}
          onChipAdd={onChipAdd}
          onBetSubmit={onBetSubmit}
          pendingBet={pendingBet}
          canDouble={activeHand?.cards?.length === 2}
          canSplit={canSplit}
          balance={balance}
        />

        <div className="blackjack-seat-content">
          {hasCommittedBet && (
            <div className={`blackjack-committed-bet-zone ${committedBetMotionClass}`}>
              <ChipStack amount={player.currentBet} title="Gesetzter Einsatz" skin={playerSkin} />
            </div>
          )}

          {isLocalPlayer && (
            <div className="blackjack-side-bet-row">
              {['twins', 'bust'].map((sideBetKey) => {
                const pendingAmount = Number(pendingSideBets[sideBetKey] || 0);
                const activeAmount = Number(activeSideBets[sideBetKey] || 0);
                const amount = pendingAmount || activeAmount;
                const copy = SIDE_BET_COPY[sideBetKey];
                const label = copy.label;
                const isLocked = activeAmount > 0 && !isBettingPhase;
                const canToggleSideBet = canEditSideBets && (pendingAmount > 0 || pendingBet > 0);
                return (
                  <button
                    key={sideBetKey}
                    type="button"
                    className={`blackjack-side-bet-zone ${amount > 0 ? 'active' : ''}${isLocked ? ' is-locked' : ''}`}
                    data-bj-anchor={`player-${player.userId}-sidebet-${sideBetKey}`}
                    disabled={!canToggleSideBet}
                    onClick={() => onSideBetSubmit?.(sideBetKey, pendingAmount > 0 ? 0 : pendingBet)}
                    title={`${label}: ${copy.description}. Auszahlung ${copy.payout}${isLocked ? `. Aktiv: ${formatKC(activeAmount)}` : ''}`}
                  >
                    {amount > 0 && (
                      <div className="blackjack-side-bet-chip">
                        <ChipStack amount={amount} title={`${label} Side-Bet`} skin={playerSkin} />
                      </div>
                    )}
                    {amount > 0 && <span className="blackjack-side-bet-dot" />}
                    <span>{label}</span>
                    <em>{copy.description}</em>
                    <strong>{copy.payout}</strong>
                    {amount > 0 && <small>{formatKC(amount)}</small>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="blackjack-seat-box-actual">
            <BlackjackCelebration active={(player.hands || []).some((hand) => hand.blackjack)} />
            {isCurrentTurn && <div className="blackjack-turn-arrow">{isLocalPlayer ? 'YOUR TURN' : 'TURN'}</div>}
            {isLocalPlayer && (
              <button
                type="button"
                className="blackjack-seat-close-btn"
                onClick={onLeaveSeat}
                aria-label="Sitzplatz verlassen"
              >
                ×
              </button>
            )}

            <div className="blackjack-seat-hands">
              {(player.hands || []).map((hand, handIndex) => {
                const isActive = isCurrentTurn && player.activeHandIndex === handIndex;
                const handAnchorId = `player-${player.userId}-hand-${handIndex}`;
                return (
                  <div
                    key={`hand-${handIndex}`}
                    className={`blackjack-hand-card-slot ${isActive ? 'active' : ''}`}
                    data-bj-anchor={handAnchorId}
                  >
                    <div className="blackjack-hand-header">
                      <div className="blackjack-value-badge blackjack-hand-value-badge">
                        {hand.blackjack ? 'BJ' : hand.value}
                      </div>
                    </div>

                    <div className="blackjack-hand-wrap blackjack-hand-cards">
                      {(hand.cards || []).map((card, index) => (
                        <PlayingCard
                          key={`${handIndex}-${card.code}-${index}`}
                          card={card}
                          index={index}
                          compact
                          motionAnchorId={`${handAnchorId}-card-${index}`}
                        />
                      ))}
                    </div>

                    <div
                      className={`blackjack-hand-state${hand.busted ? ' is-busted' : hand.stood ? ' is-stood' : ''}`}
                    >
                      {hand.busted ? 'BUST' : hand.blackjack ? 'BLACKJACK' : hand.stood ? 'STAND' : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {roomState?.status === 'settlement' && <SettlementToast settlements={settlements} />}

            <div className="blackjack-seat-footer">
              <div className="blackjack-seat-footer-main">
                <div className="blackjack-seat-user-row">
                  <Avatar user={player} size={38} />
                  <div className="blackjack-seat-user-copy">
                    <div className="blackjack-seat-name seat-identity-name">
                      {player.displayName || player.username}
                    </div>
                    <div className="blackjack-seat-subline seat-identity-subline">
                      {seatSubline}
                    </div>
                  </div>
                </div>

                {isLocalPlayer && (
                  <div className="blackjack-seat-auto-bet">
                    <div className="blackjack-auto-bet-meta">
                      <div className="blackjack-auto-bet-label">Auto-Bet</div>
                      <div className="blackjack-auto-bet-value">{formatKC(pendingBet)}</div>
                    </div>
                    <button
                      type="button"
                      className={`blackjack-toggle${autoBetEnabled ? ' active' : ''}`}
                      onClick={onToggleAutoBet}
                    />
                  </div>
                )}
              </div>

              {isLocalPlayer && isBettingPhase && (
                <div className="blackjack-seat-bet-status">
                  {hasCommittedBet ? `Gesetzt: ${formatKC(player.currentBet)}` : 'Noch kein Einsatz'}
                </div>
              )}
            </div>
          </div>

          <div className="blackjack-footer-chips">
            <div className="blackjack-seat-bet-zone" data-bj-anchor={isLocalPlayer ? 'pending-bet' : undefined}>
              {isLocalPlayer && pendingBet > 0 && (
                <ChipStack
                  amount={pendingBet}
                  isPending
                  onClick={() => onChipSub(pendingBet)}
                  title="Geplanten Einsatz reduzieren"
                />
              )}
            </div>

            {isBettingPhase && isLocalPlayer && pendingBet > 0 && (
              <button className="blackjack-bet-submit-btn" onClick={() => onBetSubmit(pendingBet)}>
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
