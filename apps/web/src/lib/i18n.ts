import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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
  },
  home: {
    nickname: 'Nickname',
    enterNickname: 'Enter your nickname',
    createRoom: 'Create Room',
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
  },
  turn: {
    yourTurn: 'Your turn!',
    waitingTurn: "Waiting for {{player}}",
    isTurn: "'s turn",
  },
  table: {
    playHere: 'Place card here',
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
  },
  challenge: {
    title: 'declared',
    timeLeft: '{{seconds}}s left',
    playerChallenge: "{{player}}'s turn to challenge",
    accept: 'Accept',
    challenge: 'Challenge!',
    bluffCaught: 'BLUFF CAUGHT!',
  },
  result: {
    realCard: 'Real card',
    wasBluff: 'was bluffing!',
    challengerWins: 'challenged correctly!',
    wasTruth: 'TRUTH TOLD!',
    wasTruthMessage: 'told the truth!',
    challengerLoses: 'challenged incorrectly!',
    penalty: '{{player}} draws 2 cards',
  },
  spice: {
    chili: 'Chili',
    pepper: 'Pepper',
    lemon: 'Lemon',
  },
  game: {
    winner: {
      title: 'Game Over',
      wins: 'wins',
      bluffs: 'Bluffs',
      catches: 'Catches',
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
  },
  home: {
    nickname: 'Biệt danh',
    enterNickname: 'Nhập biệt danh của bạn',
    createRoom: 'Tạo Phòng',
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
  },
  turn: {
    yourTurn: 'Lượt của bạn!',
    waitingTurn: 'Đang chờ {{player}}',
    isTurn: "'s turn",
  },
  table: {
    playHere: 'Đặt bài ở đây',
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
  },
  challenge: {
    title: 'đã tuyên bố',
    timeLeft: '{{seconds}}s còn lại',
    playerChallenge: 'Lượt thách thức của {{player}}',
    accept: 'Chấp nhận',
    challenge: 'Thách thức!',
    bluffCaught: 'BỊ BẮT QUỴT!',
  },
  result: {
    realCard: 'Bài thật',
    wasBluff: 'đã bluff!',
    challengerWins: 'thách thức đúng!',
    wasTruth: 'NÓI THẬT!',
    wasTruthMessage: 'nói thật!',
    challengerLoses: 'thách thức sai!',
    penalty: '{{player}} rút 2 bài',
  },
  spice: {
    chili: 'Ớt',
    pepper: 'Hạt tiêu',
    lemon: 'Chanh',
  },
  game: {
    winner: {
      title: 'Kết thúc game',
      wins: 'thắng',
      bluffs: 'Bluff',
      catches: 'Bắt',
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
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        game: enGame,
      },
      vi: {
        common: viCommon,
        game: viGame,
      },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

export function changeLanguage(lang: string) {
  i18n.changeLanguage(lang);
}

export function getCurrentLanguage(): string {
  return i18n.language || 'en';
}
