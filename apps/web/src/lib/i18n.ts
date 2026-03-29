import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const STORAGE_KEY = "i18nextLng";

// English translations
const enCommon = {
  app: {
    title: 'Sweet & Spicy',
    subtitle: 'A Bluffing Card Game',
  },
  common: {
    online: 'Online',
    offline: 'Offline',
    continue: 'Continue',
    cancel: 'Cancel',
    confirm: 'Confirm',
    loading: 'Loading...',
    unknownPlayer: 'Unknown',
    avatarFallback: '?',
  },
  home: {
    nickname: 'Nickname',
    enterNickname: 'Enter your nickname',
    createRoom: 'Create Room',
    creatingRoom: 'Creating room…',
    joinRoom: 'or join a room',
    join: 'Join',
    enterRoomCode: 'CODE',
    footer: 'A game of wits and deception',
  },
};

const enGame = {
  lobby: {
    title: 'Waiting for Players',
    roomCode: 'Room Code',
    shareCode: 'Share this code with friends!',
    addBot: 'Add Bot',
    startGame: 'Start Game',
    minPlayers: 'Need at least 2 players',
    ready: 'Ready',
    cancelReady: 'Not ready',
    waitingAllReady: 'Everyone must tap Ready before the host can start.',
    hostStartsOnly: 'Only the host can start the game.',
    hostAddsBotsOnly: 'Only the host can add bots.',
    botFallbackName: 'Bot {{n}}',
    inviteFriend: 'Invite Friend',
    waiting: 'Waiting...',
    botBadge: 'Bot',
    playerCount: '{{current}} / {{max}} players',
    onlineConnected: 'Connected',
  },
  turn: {
    yourTurn: 'Your turn!',
    waitingTurn: "Waiting for {{player}}",
    isTurn: "'s turn",
  },
  table: {
    playHere: 'Place card here',
    dropSlotHint: 'Drag a card',
    lobbyHint: 'Once the game starts, the current claim and face-down card show here in the center.',
    currentClaim: 'Current claim',
    claimIs: 'Declared as',
    claimedBy: 'Card from {{player}}',
    lastResolvedLabel: 'Last resolved',
    mustDeclareHigherThan: 'You must declare a rank strictly higher than {{number}}.',
    firstRoundHint:
      'New round: play a card and declare a spice and rank (1–3), or draw 1 from the pile and pass your turn.',
    drawPassOptionSuffix: 'You may draw 1 from the pile and pass your turn instead.',
    drawPileDropHint: 'Drag this stack onto your hand to draw 1 card and pass your turn.',
    drawPileDropAria: 'Draw pile — source stack; drop onto your hand to draw one card and skip declaring.',
    drawPileDragAria: 'Draw pile — drag onto your hand to draw one card and pass your turn.',
    drawPileHandDropZoneAria: 'Your hand — drop the draw pile here to draw one card and pass your turn.',
    rankCycleReset:
      'Rank 10 was the last resolved play — the chain resets. Declare the same locked suit with ranks 1, 2, or 3 only.',
    trophiesLeft: 'Trophies',
    trophyDuelRailAria: 'Trophy pool — {{remaining}} of {{total}} still on the table.',
    trophySlotClaimed: 'Trophy slot — already claimed',
    trophyDuelRailSr: '{{remaining}} of {{total}} trophies still in the pool.',
    roundPile: 'Round pile',
    contestedPile: 'Contest pile',
    lockedSuit: 'Locked suit',
    followLockedSuit: 'Play the same locked suit with a higher rank than the last claim.',
    drawPile: 'Draw',
    supremeReserve: 'TW pool',
    a11y: {
      playSlot: 'Play zone — pick a card from your hand to place here.',
      firstRoundDeclareContext: 'First round — how you may declare this chain.',
      roundDeclareContextCompact: 'Locked suit {{suit}}, chain rank {{rank}}.',
      roundDeclareContextSuitOnly: 'Locked suit {{suit}} — no rank on the chain yet.',
      currentClaimDetails: 'Details about this claim',
      faceDownPlay: 'Face-down play on the table',
    },
  },
  board: {
    bluff: 'BLUFF!',
    myCards: 'My cards',
    focusHand: 'Scroll to your hand',
  },
  hand: {
    playerHandAria: 'Your hand',
    cardDetailTitle: 'Your card',
    cardDetailHint:
      'Drag to the center play area to declare, or drag the draw pile onto your hand to draw 1 and pass.',
    playThisCard: 'Play this card',
    dropToPlayAria: 'Play area — drop a card from your hand here',
  },
  declare: {
    title: 'Declare Your Card',
    preview: 'You declared:',
    selectedCard: 'Selected Card',
    cardSelected: 'Card selected',
    chooseType: 'Choose spice type:',
    chooseNumber: 'Choose number:',
    cancel: 'Cancel',
    confirm: 'Declare',
    noValid: 'No valid declaration for the current rules.',
    cannotDeclareAboveTen:
      'Last resolved number was 10. The next declaration must be higher, but ranks only go 1–10 — no legal choice.',
    lockedSuitHint: 'Suit is locked for this round.',
  },
  challenge: {
    title: 'declared',
    timeLeft: '{{seconds}}s left',
    playerChallenge: "{{player}}'s turn to challenge",
    eligiblePrompt: 'Challenge or accept before time runs out.',
    waitingDeclarer: 'Waiting for other players…',
    accept: 'Accept',
    challenge: 'Challenge!',
    bluffCaught: 'BLUFF CAUGHT!',
    wrongSuit: 'Wrong suit!',
    wrongNumber: 'Wrong number!',
    raceForClaim: 'Race — tap the bell to claim the challenge',
    claimChallenge: 'Claim challenge',
    claimHint: 'First tap wins the right to choose wrong suit or wrong number.',
    youHoldChallenge: 'You claimed the challenge — pick wrong suit or wrong number.',
    holderMustPick: '{{player}} must choose wrong suit or wrong number.',
    pickWaitShort: 'Waiting for {{player}}',
    declareRole: 'Declarer',
    holderRole: 'Challenger',
    pickHelpAria: 'Full challenge instructions',
    timeRemainingSr: '{{seconds}} seconds remaining',
    contextChipStats: '{{hand}} in hand · {{score}} pts · {{trophies}} trophies',
    regionLabel: 'Challenge phase — timer and actions on the table',
    embeddedCaption: 'Challenge — timer on the table',
    revealAxisSuit: 'Flipping the card — challenge is on SUIT (wrong spice type).',
    revealAxisNumber: 'Flipping the card — challenge is on NUMBER.',
    revealCountdownSr: 'Reveal phase, {{seconds}} seconds left',
    revealLockTitle: 'Choice locked',
    revealLockSubtitle: '{{player}} — {{axis}}',
    revealLockCountdownSr: 'Lock ends in {{seconds}} seconds',
    revealLockCountLabel: 'Unlock in',
    revealPhaseLockLabel: 'Locking the challenge choice',
    revealPhaseFlipLabel: 'Flipping the card — outcome',
    revealLockAria: 'Challenge choice is locked. The real card stays face down until the lock ends.',
    spectatorPickTitle: 'Challenger is choosing',
    spectatorPickSubline:
      '{{player}} will pick whether the claim was wrong on suit or on number.',
    spectatorPickGhostCaption: 'Options they are choosing between',
  },
  result: {
    realCard: 'Real card',
    challenged: 'Challenged: {{type}}',
    suitAttr: 'suit',
    numberAttr: 'number',
    challengeCorrect: 'caught the lie!',
    challengerTakesPile: 'Challenger takes the round pile.',
    declarerTakesPile: 'Declarer takes the round pile.',
    declarerPenaltyBluffCaught:
      '{{player}} draws 2 cards (bluff caught; may take a Total Wild from reserve).',
    challengerPenalty: '{{player}} draws 2 cards (and may take a Total Wild from reserve).',
    wasTruth: 'TRUTH TOLD!',
    wasTruthMessage: 'matched the claim on that attribute.',
    pileCardCount: 'Contested pile: {{count}} cards',
    challengeTimedOut: 'Challenge holder ran out of time — declarer takes the pile.',
  },
  seat: {
    you: 'You',
    wonPile: 'Won',
    wonPileHint: 'Face-down cards won from challenges',
    handCards: 'Hand',
    runningScore: 'Score',
    actionDeclared: 'Declared',
    actionChallenged: 'Challenged',
    activeTurn: 'Active turn',
    upNext: 'Up next',
    ariaSeat: '{{player}} — {{hand}} in hand, {{score}} points, {{trophies}} trophies. {{role}}',
  },
  actionLog: {
    title: 'Game log',
    expand: 'Log',
    collapse: 'Hide',
    empty: 'No events yet.',
  },
  log: {
    declared: '{{player}} declared {{type}} {{number}}',
    challenged: '{{player}} challenged ({{attr}})',
    accepted: 'Declaration accepted — next turn',
    penaltyWin: '{{winner}} takes {{count}} cards',
    penaltyBluffCaught: '{{challenger}} takes {{count}} cards; {{declarer}} draws 2.',
    trophy: '{{player}} earned a Trophy',
  },
  scoreboard: {
    normalCards: 'Normal in pile: {{count}} × {{points}} pts',
    wildCards: 'Wild in pile: {{count}} × {{points}} pts',
    trophyCards: 'Trophies in pile: {{count}} × {{points}} pts',
    pileSubtotal: 'Pile total: {{value}}',
    wildHandPenalty: 'Wild left in hand: {{count}} × −{{penalty}}',
    total: 'Total: {{value}}',
    summaryClient: 'Trophies: {{trophies}} · Won pile cards: {{pile}} (detail hidden until end)',
  },
  spice: {
    chili: 'Chili',
    lemon: 'Lemon',
    avocado: 'Avocado',
  },
  game: {
    winner: {
      title: 'Game Over',
      endHeroTitle: '🏆 Game Over',
      wins: 'wins',
      tie: 'Shared victory',
      trophies: 'Trophies',
      cardsLeft: 'Cards',
      leave: 'Leave',
      playAgain: 'Play Again',
    },
    chat: {
      title: 'Chat',
      welcome: 'Welcome to the game!',
      placeholder: 'Type a message...',
      hide: 'Hide',
      show: 'Show',
      you: 'You',
    },
    video: {
      title: 'Video Call',
      connected: 'Connected',
      connect: 'Connect',
      you: 'You',
      player: 'Player',
      waiting: 'Waiting...',
    },
  },
  room: {
    title: 'Game Room',
    exit: 'Exit',
    exitWithArrow: '← {{label}}',
    opponents: 'Opponents',
    opponentsTurnCarousel: 'Opponents — turn order carousel',
    joinFailedTitle: 'Cannot join room',
    joinFailedDesc: 'Check the code or try again.',
    addBotFailedTitle: 'Could not add bot',
    addBotFailedDesc: 'Only the host can add bots, or the room may be full.',
    creatingRoomBanner: 'Creating your room…',
    help: 'Help',
    settings: 'Settings',
  },
  phase: {
    challengeHelpAria: 'How this phase works',
    challengeOnTableHint:
      'Ring the bell to claim the challenge, or accept / challenge before the timer ends.',
    penalty: 'Resolving round…',
    nextTurn: 'Next turn…',
    trophyAwarded: 'Trophy claimed — refilling hand…',
    penaltyChallengerWins:
      '{{challenger}} takes {{count}} cards into their won pile. {{declarer}} draws 2.',
    penaltyDeclarerWins: '{{declarer}} takes the pile. {{challenger}} draws 2 cards.',
    penaltyFxDrawChip: 'Draw {{count}}',
    penaltyFxRoundChip: 'Round pile · {{count}} cards',
    trophyTitle: 'Trophy earned!',
    trophyBody: '{{player}} claims a Trophy (+10). {{remaining}} left in the pool.',
    trophyRefill: 'Refilling hand to {{count}} cards…',
    revealImpactNeutral: 'Round resolved',
    revealImpactLocalWin: 'You seize the round!',
    revealImpactLocalLose: 'A harsh reveal…',
  },
  /** Short UI labels for each game phase (header chip, a11y). */
  phases: {
    lobby: 'Lobby',
    gameStart: 'Starting',
    playerTurn: 'Play card',
    challengePhase: 'Challenge',
    reveal: 'Reveal',
    penalty: 'Round end',
    trophyAwarded: 'Trophy',
    nextTurn: 'Next turn',
    endGame: 'Game over',
  },
};

// Vietnamese translations
const viCommon = {
  app: {
    title: 'Sweet & Spicy',
    subtitle: 'Game bài lừa đảo',
  },
  common: {
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
    continue: 'Tiếp tục',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    loading: 'Đang tải...',
    unknownPlayer: 'Chưa rõ',
    avatarFallback: '?',
  },
  home: {
    nickname: 'Biệt danh',
    enterNickname: 'Nhập biệt danh của bạn',
    createRoom: 'Tạo Phòng',
    creatingRoom: 'Đang tạo phòng…',
    joinRoom: 'hoặc tham gia phòng',
    join: 'Vào',
    enterRoomCode: 'MÃ',
    footer: 'Một trò chơi của trí tuệ và lừa dối',
  },
};

const viGame = {
  lobby: {
    title: 'Đang chờ người chơi',
    roomCode: 'Mã phòng',
    shareCode: 'Chia sẻ mã này cho bạn bè!',
    addBot: 'Thêm Bot',
    startGame: 'Bắt đầu game',
    minPlayers: 'Cần ít nhất 2 người chơi',
    ready: 'Sẵn sàng',
    cancelReady: 'Chưa sẵn sàng',
    waitingAllReady: 'Mọi người cần bấm Sẵn sàng trước khi host bắt đầu.',
    hostStartsOnly: 'Chỉ host mới có thể bắt đầu game.',
    hostAddsBotsOnly: 'Chỉ host mới thêm được bot.',
    botFallbackName: 'Bot {{n}}',
    inviteFriend: 'Mời bạn',
    waiting: 'Đang chờ...',
    botBadge: 'Bot',
    playerCount: '{{current}} / {{max}} người chơi',
    onlineConnected: 'Đã kết nối',
  },
  turn: {
    yourTurn: 'Lượt của bạn!',
    waitingTurn: 'Đang chờ {{player}}',
    isTurn: "'s turn",
  },
  table: {
    playHere: 'Đặt bài ở đây',
    dropSlotHint: 'Kéo bài vào',
    lobbyHint: 'Khi vào ván, tuyên bố và lá úp sẽ hiện ở giữa bàn.',
    currentClaim: 'Tuyên bố trên bàn',
    claimIs: 'Đang tuyên bố là',
    claimedBy: 'Lá của {{player}}',
    lastResolvedLabel: 'Lần resolve gần nhất',
    mustDeclareHigherThan: 'Bạn phải tuyên bố số lớn hơn {{number}}.',
    firstRoundHint:
      'Vòng mới: đánh bài và tuyên bố vị + số (1–3), hoặc rút 1 lá từ xấp bài và bỏ lượt.',
    drawPassOptionSuffix: 'Bạn cũng có thể rút 1 lá từ xấp bài và bỏ lượt.',
    drawPileDropHint: 'Kéo xấp này thả lên vùng bài trên tay để rút 1 lá và bỏ lượt.',
    drawPileDropAria: 'Xấp bài rút — kéo thả lên tay để rút một lá và bỏ lượt.',
    drawPileDragAria: 'Xấp bài rút — kéo lên tay để rút một lá và bỏ lượt.',
    drawPileHandDropZoneAria: 'Bài trên tay — thả xấp bài rút vào đây để rút một lá và bỏ lượt.',
    rankCycleReset:
      'Vừa resolve ở số 10 — chuỗi reset. Giữ nguyên vị đã khóa, chỉ được tuyên bố 1, 2 hoặc 3.',
    trophiesLeft: 'Chiến tích còn',
    trophyDuelRailAria: 'Xấp chiến tích — còn {{remaining}} trên {{total}} lá trên bàn.',
    trophySlotClaimed: 'Ô chiến tích — đã được nhận',
    trophyDuelRailSr: 'Còn {{remaining}} trên tổng {{total}} chiến tích trên bàn.',
    roundPile: 'Xấp vòng',
    contestedPile: 'Xấp tranh vòng',
    lockedSuit: 'Vị khóa',
    followLockedSuit: 'Đánh cùng vị đã khóa với số cao hơn lần trước.',
    drawPile: 'Bài rút',
    supremeReserve: 'Kho TW',
    a11y: {
      playSlot: 'Ô đánh bài — chọn một lá từ tay để đặt vào đây.',
      firstRoundDeclareContext: 'Vòng mới — cách tuyên bố trong chuỗi này.',
      roundDeclareContextCompact: 'Vị khóa {{suit}}, số trên chuỗi {{rank}}.',
      roundDeclareContextSuitOnly: 'Vị khóa {{suit}} — chưa có số trên chuỗi.',
      currentClaimDetails: 'Chi tiết tuyên bố trên bàn',
      faceDownPlay: 'Lá úp trên bàn',
    },
  },
  board: {
    bluff: 'BLUFF!',
    myCards: 'Bài của tôi',
    focusHand: 'Cuộn tới bài trên tay',
  },
  hand: {
    playerHandAria: 'Bài trên tay',
    cardDetailTitle: 'Chi tiết lá bài',
    cardDetailHint:
      'Kéo vào ô giữa bàn để tuyên bố, hoặc kéo xấp bài rút thả lên tay để rút 1 và bỏ lượt.',
    playThisCard: 'Chơi lá này',
    dropToPlayAria: 'Vùng đánh — thả lá từ tay vào đây',
  },
  declare: {
    title: 'Tuyên bố bài của bạn',
    preview: 'Bạn tuyên bố:',
    selectedCard: 'Bài đã chọn',
    cardSelected: 'Đã chọn bài',
    chooseType: 'Chọn loại gia vị:',
    chooseNumber: 'Chọn số:',
    cancel: 'Hủy',
    confirm: 'Tuyên bố',
    noValid: 'Không có tuyên bố hợp lệ theo luật hiện tại.',
    cannotDeclareAboveTen:
      'Số vừa được công nhận là 10; lượt sau phải khai số lớn hơn nhưng bài chỉ có 1–10 — không còn tuyên bố hợp lệ.',
    lockedSuitHint: 'Vị đã khóa cho vòng này.',
  },
  challenge: {
    title: 'đã tuyên bố',
    timeLeft: '{{seconds}}s còn lại',
    playerChallenge: 'Lượt thách thức của {{player}}',
    eligiblePrompt: 'Thách hoặc chấp nhận trước khi hết giờ.',
    waitingDeclarer: 'Đang chờ người chơi khác…',
    accept: 'Chấp nhận',
    challenge: 'Thách thức!',
    bluffCaught: 'BỊ BẮT QUỴT!',
    wrongSuit: 'Sai vị!',
    wrongNumber: 'Sai số!',
    raceForClaim: 'Giành quyền — bấm chuông để giữ thách',
    claimChallenge: 'Giành quyền thách',
    claimHint: 'Ai bấm trước (theo máy chủ) được chọn sai vị hay sai số.',
    youHoldChallenge: 'Bạn đã giành quyền thách — chọn sai vị hoặc sai số.',
    holderMustPick: '{{player}} phải chọn sai vị hoặc sai số.',
    pickWaitShort: 'Chờ {{player}}',
    declareRole: 'Tuyên',
    holderRole: 'Giữ thách',
    pickHelpAria: 'Hướng dẫn đầy đủ',
    timeRemainingSr: 'Còn {{seconds}} giây',
    contextChipStats: '{{hand}} trên tay · {{score}} điểm · {{trophies}} cúp',
    regionLabel: 'Giai đoạn thách — đồng hồ và thao tác trên bàn',
    embeddedCaption: 'Thách thức — đồng hồ trên bàn',
    revealAxisSuit: 'Đang lật bài — thách trên VỊ (sai loại gia vị).',
    revealAxisNumber: 'Đang lật bài — thách trên SỐ.',
    revealCountdownSr: 'Giai đoạn lật bài, còn {{seconds}} giây',
    revealLockTitle: 'Đã khóa lựa chọn',
    revealLockSubtitle: '{{player}} — {{axis}}',
    revealLockCountdownSr: 'Hết khóa sau {{seconds}} giây',
    revealLockCountLabel: 'Mở khóa sau',
    revealPhaseLockLabel: 'Đang khóa lựa chọn',
    revealPhaseFlipLabel: 'Đang lật bài — kết quả',
    revealLockAria: 'Lựa chọn thách đã khóa. Bài thật vẫn úp cho đến khi hết thời gian khóa.',
    spectatorPickTitle: 'Người giữ thách đang chọn',
    spectatorPickSubline: '{{player}} sẽ chọn sai vị hay sai số so với tuyên bố.',
    spectatorPickGhostCaption: 'Hai lựa chọn họ có thể bấm',
  },
  result: {
    realCard: 'Bài thật',
    challenged: 'Thách: {{type}}',
    suitAttr: 'vị',
    numberAttr: 'số',
    challengeCorrect: 'bắt trúng!',
    challengerTakesPile: 'Người thách lấy xấp vòng.',
    declarerTakesPile: 'Người tuyên lấy xấp vòng.',
    declarerPenaltyBluffCaught:
      '{{player}} rút 2 bài (bị bắt quặt; có thể nhận thêm Tối Thượng từ dự trữ).',
    challengerPenalty: '{{player}} rút 2 bài (có thể nhận thêm Tối Thượng từ dự trữ).',
    wasTruth: 'NÓI THẬT!',
    wasTruthMessage: 'khớp với tuyên bố ở thuộc tính đó.',
    pileCardCount: 'Xấp tranh chấp: {{count}} lá',
    challengeTimedOut: 'Hết giờ chọn thách — người tuyên lấy xấp.',
  },
  seat: {
    you: 'Bạn',
    wonPile: 'Ăn',
    wonPileHint: 'Xấp bài úp ăn được từ thách',
    handCards: 'Tay',
    runningScore: 'Điểm',
    actionDeclared: 'Đã tuyên bố',
    actionChallenged: 'Đã thách',
    activeTurn: 'Đang tới lượt',
    upNext: 'Lượt tiếp',
    ariaSeat: '{{player}} — {{hand}} trên tay, {{score}} điểm, {{trophies}} cúp. {{role}}',
  },
  actionLog: {
    title: 'Nhật ký',
    expand: 'Mở',
    collapse: 'Thu',
    empty: 'Chưa có sự kiện.',
  },
  log: {
    declared: '{{player}} tuyên bố {{type}} {{number}}',
    challenged: '{{player}} thách thức ({{attr}})',
    accepted: 'Chấp nhận — lượt tiếp',
    penaltyWin: '{{winner}} lấy {{count}} lá',
    penaltyBluffCaught: '{{challenger}} lấy {{count}} lá; {{declarer}} rút 2 lá.',
    trophy: '{{player}} nhận Chiến tích',
  },
  scoreboard: {
    normalCards: 'Bài thường trong xấp: {{count}} × {{points}} đ',
    wildCards: 'Bài Wild trong xấp: {{count}} × {{points}} đ',
    trophyCards: 'Chiến tích trong xấp: {{count}} × {{points}} đ',
    pileSubtotal: 'Cộng xấp: {{value}}',
    wildHandPenalty: 'Wild còn trên tay: {{count}} × −{{penalty}}',
    total: 'Tổng: {{value}}',
    summaryClient: 'Chiến tích: {{trophies}} · Lá trong xấp: {{pile}} (chi tiết khi kết thúc)',
  },
  spice: {
    chili: 'Ớt',
    lemon: 'Chanh',
    avocado: 'Bơ',
  },
  game: {
    winner: {
      title: 'Kết thúc game',
      endHeroTitle: '🏆 Kết thúc',
      wins: 'thắng',
      tie: 'Hòa — cùng chiến thắng',
      trophies: 'Chiến tích',
      cardsLeft: 'Bài',
      leave: 'Rời',
      playAgain: 'Chơi lại',
    },
    chat: {
      title: 'Trò chuyện',
      welcome: 'Chào mừng đến với trò chơi!',
      placeholder: 'Nhập tin nhắn...',
      hide: 'Ẩn',
      show: 'Hiện',
      you: 'Bạn',
    },
    video: {
      title: 'Gọi video',
      connected: 'Đã kết nối',
      connect: 'Kết nối',
      you: 'Bạn',
      player: 'Người chơi',
      waiting: 'Đang chờ...',
    },
  },
  room: {
    title: 'Phòng Game',
    exit: 'Thoát',
    exitWithArrow: '← {{label}}',
    opponents: 'Đối thủ',
    opponentsTurnCarousel: 'Đối thủ — carousel lượt chơi',
    joinFailedTitle: 'Không vào được phòng',
    joinFailedDesc: 'Kiểm tra mã phòng hoặc thử lại.',
    addBotFailedTitle: 'Không thêm được bot',
    addBotFailedDesc: 'Chỉ host mới thêm bot, hoặc phòng đã đầy.',
    creatingRoomBanner: 'Đang tạo phòng…',
    help: 'Trợ giúp',
    settings: 'Cài đặt',
  },
  phase: {
    challengeHelpAria: 'Giải thích giai đoạn thách',
    challengeOnTableHint:
      'Bấm chuông để giành quyền thách, hoặc chấp nhận / thách trước khi hết giờ.',
    penalty: 'Kết thúc vòng…',
    nextTurn: 'Lượt tiếp theo…',
    trophyAwarded: 'Nhận Chiến tích — đang chia lại bài…',
    penaltyChallengerWins:
      '{{challenger}} lấy {{count}} lá vào xấp ăn được. {{declarer}} rút 2 lá.',
    penaltyDeclarerWins: '{{declarer}} lấy xấp. {{challenger}} rút 2 lá.',
    penaltyFxDrawChip: 'Rút {{count}} lá',
    penaltyFxRoundChip: 'Xấp vòng · {{count}} lá',
    trophyTitle: 'Nhận Chiến tích!',
    trophyBody: '{{player}} nhận Chiến tích (+10). Còn {{remaining}} trên bàn.',
    trophyRefill: 'Đang chia lại {{count}} lá…',
    revealImpactNeutral: 'Kết quả vòng',
    revealImpactLocalWin: 'Bạn thắng vòng!',
    revealImpactLocalLose: 'Lật bài tàn khốc…',
  },
  phases: {
    lobby: 'Sảnh chờ',
    gameStart: 'Đang bắt đầu',
    playerTurn: 'Đánh bài',
    challengePhase: 'Thách / chấp nhận',
    reveal: 'Lật bài',
    penalty: 'Kết vòng',
    trophyAwarded: 'Chiến tích',
    nextTurn: 'Lượt sau',
    endGame: 'Kết thúc',
  },
};

const resources = {
  en: {
    common: enCommon,
    game: enGame,
  },
  vi: {
    common: viCommon,
    game: viGame,
  },
} as const;

const i18nInitOptions = {
  resources,
  fallbackLng: "en" as const,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
};

let i18nInitialized = false;

function languageMatches(lng: "en" | "vi"): boolean {
  const current = i18n.language ?? "";
  return lng === "vi" ? current.startsWith("vi") : current.startsWith("en");
}

/** Call at the start of `Providers` so SSR and the client's first paint use the same `lng` (cookie + Accept-Language). */
export function initI18nForLocale(lng: "en" | "vi"): void {
  if (!i18nInitialized) {
    i18n.use(initReactI18next).init({
      ...i18nInitOptions,
      lng,
    });
    i18nInitialized = true;
    return;
  }
  if (!languageMatches(lng)) {
    void i18n.changeLanguage(lng);
  }
}

function setLocaleCookie(lng: "en" | "vi"): void {
  if (typeof document === "undefined") return;
  document.cookie = `${STORAGE_KEY}=${lng};path=/;max-age=31536000;SameSite=Lax`;
}

/**
 * After hydration: apply explicit localStorage choice, or browser locale if nothing stored.
 * Server already matched cookie / Accept-Language; this reconciles legacy clients (localStorage only).
 */
export function applyStoredOrBrowserLanguage(): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "vi") {
      initI18nForLocale(stored);
      setLocaleCookie(stored);
      return;
    }
    const nav = navigator.language?.split("-")[0]?.toLowerCase();
    if (nav === "vi" && !languageMatches("vi")) {
      initI18nForLocale("vi");
      setLocaleCookie("vi");
    }
  } catch {
    /* private mode / blocked storage */
  }
}

export default i18n;

export function changeLanguage(lang: string) {
  const lng: "en" | "vi" = lang === "vi" ? "vi" : "en";
  initI18nForLocale(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
    setLocaleCookie(lng);
  } catch {
    /* ignore */
  }
}

export function getCurrentLanguage(): string {
  if (!i18nInitialized) return "en";
  return i18n.language || "en";
}

/** Matches root layout `<html lang>` so the client bundle initializes before React hydrates (no init during render). */
function localeFromDocumentHtml(): "en" | "vi" {
  if (typeof document === "undefined") return "en";
  const lang = document.documentElement.lang?.toLowerCase() ?? "";
  return lang.startsWith("vi") ? "vi" : "en";
}

function bootstrapClientI18nFromHtml(): void {
  if (typeof window === "undefined" || i18nInitialized) return;
  initI18nForLocale(localeFromDocumentHtml());
}

bootstrapClientI18nFromHtml();
