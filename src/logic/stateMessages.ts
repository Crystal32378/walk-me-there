import type { NavState } from '../types/navigation';

export type Lang = 'zh' | 'en';

export interface StateMessage {
  main: string;
  sub: string;
  moodColor: string;
  glowClass: string;
}

const MOOD: Record<NavState, { moodColor: string; glowClass: string }> = {
  UNCERTAIN_GPS: { moodColor: '#F59E0B', glowClass: 'glow-uncertain' },
  STATIONARY: { moodColor: '#94A3B8', glowClass: 'glow-stationary' },
  ON_ROUTE: { moodColor: '#10B981', glowClass: 'glow-on-route' },
  WRONG_DIRECTION: { moodColor: '#F97316', glowClass: 'glow-wrong-direction' },
  OFF_ROUTE: { moodColor: '#EF4444', glowClass: 'glow-off-route' }
};

const TEXT: Record<Lang, Record<NavState, { main: string; sub: string }>> = {
  zh: {
    UNCERTAIN_GPS: {
      main: '先別走，我還在確認你的位置。',
      sub: '站在空曠一點的地方，我很快就看清楚了。'
    },
    STATIONARY: {
      main: '好，我們先站在這裡。',
      sub: '準備好了嗎？我們隨時可以出發。'
    },
    ON_ROUTE: {
      main: '對，就是這個方向。',
      sub: '跟著我，我們正走在對的路上。'
    },
    WRONG_DIRECTION: {
      main: '等等，你走反了。',
      sub: '先轉身，我會重新帶你。'
    },
    OFF_ROUTE: {
      main: '先停一下，我們走偏了。',
      sub: '沒關係，我知道你在哪。'
    }
  },
  en: {
    UNCERTAIN_GPS: {
      main: "Hold on — I'm still finding you.",
      sub: "Step somewhere more open and I'll see you clearly."
    },
    STATIONARY: {
      main: "Okay, let's stand here for now.",
      sub: "Ready when you are — we can set off anytime."
    },
    ON_ROUTE: {
      main: 'Yes — this is the way.',
      sub: "Stay with me, we're on the right path."
    },
    WRONG_DIRECTION: {
      main: "Wait — you're heading the wrong way.",
      sub: "Turn around first; I'll guide you back."
    },
    OFF_ROUTE: {
      main: "Let's stop a moment — we've drifted.",
      sub: "It's okay. I know exactly where you are."
    }
  }
};

export function getStateMessage(state: NavState, lang: Lang): StateMessage {
  return { ...TEXT[lang][state], ...MOOD[state] };
}

const ERROR_TEXT: Record<Lang, { timeout: { main: string; sub: string }; permission: { main: string; sub: string }; default: { main: string; sub: string } }> = {
  zh: {
    timeout: {
      main: '我還在找準你的位置，再給我一下。',
      sub: '訊號有點弱，我們正在重新抓取。'
    },
    permission: {
      main: '我需要定位權限才能帶路。',
      sub: '請在瀏覽器設定中開啟位置存取權限。'
    },
    default: {
      main: '我暫時看不清楚你的位置，再等我一下。',
      sub: '我會試著重新抓到訊號。'
    }
  },
  en: {
    timeout: {
      main: "I'm still pinning down your location — one moment.",
      sub: "The signal is a little weak; I'm reacquiring it."
    },
    permission: {
      main: 'I need location access to walk you there.',
      sub: 'Please enable location access in your browser settings.'
    },
    default: {
      main: "I can't quite see where you are — give me a second.",
      sub: "I'll keep trying to find the signal."
    }
  }
};

export function getHumanErrorMessage(rawError: string, lang: Lang): { main: string; sub: string } {
  if (rawError.includes('Timeout') || rawError.includes('timeout')) {
    return ERROR_TEXT[lang].timeout;
  }
  if (rawError.includes('Permission') || rawError.includes('denied')) {
    return ERROR_TEXT[lang].permission;
  }
  return ERROR_TEXT[lang].default;
}

// Non-state UI strings that the owl surface needs in both languages.
export const UI_TEXT: Record<Lang, {
  acquiringMain: string;
  acquiringSub: string;
  weakSignalMain: string;
  weakSignalSub: string;
  thinking: string;
  memoryBadge: string;
  sheetTitle: string;
  freeTextPlaceholder: string;
  sendButton: string;
  confusedPrompts: string[];
}> = {
  zh: {
    acquiringMain: '正在尋找你的位置...',
    acquiringSub: '小貓頭鷹正在睜開眼睛看路。',
    weakSignalMain: '我暫時看不清楚你的位置，再等我一下。',
    weakSignalSub: '訊號有點弱，我們正在重新抓取。',
    thinking: '小貓頭鷹想了一下⋯',
    memoryBadge: '小貓頭鷹記住了你理解方向的方式',
    sheetTitle: '小貓頭鷹聽你說',
    freeTextPlaceholder: '或者，直接跟牠說⋯',
    sendButton: '說',
    confusedPrompts: [
      '我現在到底面向哪裡？',
      '你說的是哪一個左轉？',
      '是這個路口嗎？',
      '我分不清東西南北。'
    ]
  },
  en: {
    acquiringMain: 'Finding your position...',
    acquiringSub: 'The little owl is opening its eyes.',
    weakSignalMain: "I can't quite see where you are — hold on.",
    weakSignalSub: "The signal is a little weak; I'm reacquiring it.",
    thinking: 'The owl is thinking…',
    memoryBadge: 'The owl remembered how you understand direction',
    sheetTitle: 'Tell the owl',
    freeTextPlaceholder: 'Or just tell it…',
    sendButton: 'Say',
    confusedPrompts: [
      'Which way am I actually facing?',
      'Which left turn do you mean?',
      'Is this the intersection?',
      "I can't tell east from west."
    ]
  }
};
