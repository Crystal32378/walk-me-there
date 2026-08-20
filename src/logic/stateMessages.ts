import type { NavState } from '../types/navigation';

export interface StateMessage {
  main: string;
  sub: string;
  moodColor: string;
  glowClass: string;
}

export const STATE_MESSAGES: Record<NavState, StateMessage> = {
  UNCERTAIN_GPS: {
    main: '先別走，我還在確認你的位置。',
    sub: '站在空曠一點的地方，我很快就看清楚了。',
    moodColor: '#F59E0B',
    glowClass: 'glow-uncertain'
  },
  STATIONARY: {
    main: '好，我們先站在這裡。',
    sub: '準備好了嗎？我們隨時可以出發。',
    moodColor: '#94A3B8',
    glowClass: 'glow-stationary'
  },
  ON_ROUTE: {
    main: '你還靠近目前這段路線。',
    sub: '先慢慢走幾步，我會繼續確認你的移動方向。',
    moodColor: '#10B981',
    glowClass: 'glow-on-route'
  },
  WRONG_DIRECTION: {
    main: '等等，裝置目前顯示的移動方向和這段路相反。',
    sub: '先停一下；如果安全，轉身走幾步，我再幫你確認。',
    moodColor: '#F97316',
    glowClass: 'glow-wrong-direction'
  },
  OFF_ROUTE: {
    main: '先停一下，你離目前這段路線有點遠了。',
    sub: '我能確認你偏離了這段路線，但現在還不會重新規劃路線。',
    moodColor: '#EF4444',
    glowClass: 'glow-off-route'
  }
};

export function getHumanErrorMessage(errorCode: number | null): { main: string; sub: string } {
  if (errorCode === 3) {
    return {
      main: '我還在找準你的位置，再給我一下。',
      sub: '訊號有點弱，我們正在重新抓取。'
    };
  }
  if (errorCode === 1) {
    return {
      main: '我需要定位權限才能帶路。',
      sub: '請在瀏覽器設定中開啟位置存取權限。'
    };
  }
  return {
    main: '我暫時看不清楚你的位置，再等我一下。',
    sub: '我會試著重新抓到訊號。'
  };
}
