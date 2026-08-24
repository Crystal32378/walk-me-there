// The companion agent. One rule governs this file:
// Gemini understands the person. It never decides the route.
// Every geographic fact it sees was computed by the deterministic engine.

import { GoogleGenAI } from '@google/genai';
import { LANDMARKS, buildLandmarkFacts } from './landmarks.js';
import { validateGuidance, sanitizeReply } from './validator.js';
import { assessNavigation } from './engine.js';
import {
  getUserModel,
  patchUserModel,
  openEpisode,
  appendEpisodeMessage,
  closeEpisode,
} from './firestore.js';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'walk-me-there';
const LOCATION = process.env.VERTEX_LOCATION || 'global';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_TIMEOUT_MS = 20000;

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION });

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('gemini_timeout')), ms)),
  ]);
}

const OWL_PERSONA = `你是「小貓頭鷹」，Walk Me There 的路上陪伴者。使用者是容易迷路、容易慌張的人。
你的語氣：溫柔、堅定、絕不責備。短句。像牽著朋友的手。

鐵律（違反任何一條，你的話會被系統丟棄）：
1. 你收到的 FACTS 是導航引擎算出來的地理事實。你只能轉述它，不能自己推測位置、方向、距離。
2. 你只能提到 LANDMARKS 清單裡的地標，絕對不可自創任何地名、店名、路名。
3. 不要輸出任何數字。距離與時間由引擎顯示，不是你的工作。
4. 遵守 USER_MODEL：那是這位使用者告訴我們「他怎麼理解方向」的紀錄。`;

const LANG_RULE = {
  zh: '輸出語言：繁體中文。',
  en: 'Output language: English. Both "main" and "sub" must be written in natural, warm English.',
};

const CARDINAL_RULE = {
  zh: '此使用者「分不清東西南北」。絕對禁止使用東、西、南、北等方位字，改用地標（朝著／背對）、身體相對方向（左手邊、右手邊、轉身）或時鐘方向。',
  en: 'This user cannot tell north/south/east/west apart. NEVER use cardinal direction words (north, south, east, west). Use landmarks (toward / away from), body-relative directions (your left, your right, turn around) or clock directions instead.',
};

function buildGuidancePrompt(navSnapshot, userModel, landmarkFacts, lang) {
  const facts = {
    state: navSnapshot.state,
    離路線幾公尺: Math.round(navSnapshot.crossTrackDistance ?? 0),
    使用者面向與正確方向的夾角度數: navSnapshot.bearingDelta != null ? Math.round(navSnapshot.bearingDelta) : null,
    使用者目前面向角度: navSnapshot.bearing != null ? Math.round(navSnapshot.bearing) : null,
    正確方向角度: navSnapshot.expectedBearing != null ? Math.round(navSnapshot.expectedBearing) : null,
  };

  const modelDesc = {
    avoidCardinal: userModel.avoidCardinal
      ? CARDINAL_RULE[lang]
      : '尚無限制，但方位詞請謹慎使用。/ No restriction yet, but use cardinal words sparingly.',
    orientationVocab:
      userModel.orientationVocab === 'clock'
        ? 'clock — 此使用者最容易理解時鐘方向。優先用「N點鐘方向」(1-12)表達；clock 值已由引擎算好，放在 LANDMARKS 的 clock 欄位，只能用那個值。'
        : userModel.orientationVocab,
    notes: userModel.notes,
  };

  const situation =
    navSnapshot.state === 'WRONG_DIRECTION'
      ? '使用者正朝著與路線相反的方向走（引擎已確認）。'
      : '使用者已偏離路線（引擎已確認）。';

  return `${situation}
請給一句帶他回到正確路線的引導。

FACTS（引擎計算，唯一的地理真話）：
${JSON.stringify(facts, null, 2)}

LANDMARKS（引擎已算好每個地標相對使用者的方向；clock 是時鐘方向，null 表示不知道使用者面向）：
${JSON.stringify(landmarkFacts, null, 2)}

USER_MODEL（這位使用者怎麼理解方向）：
${JSON.stringify(modelDesc, null, 2)}

${LANG_RULE[lang]}
輸出 JSON：{"main": "一句主要指引，30字內/max ~15 words", "sub": "一句安撫或補充，40字內/max ~20 words"}`;
}

async function generateGuidance(navSnapshot, userModel, landmarkFacts, lang) {
  const response = await withTimeout(
    ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: buildGuidancePrompt(navSnapshot, userModel, landmarkFacts, lang) }] }],
      config: {
        systemInstruction: OWL_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            main: { type: 'STRING' },
            sub: { type: 'STRING' },
          },
          required: ['main', 'sub'],
        },
        temperature: 0.6,
      },
    }),
    GEMINI_TIMEOUT_MS
  );
  return JSON.parse(response.text);
}

const UPDATE_USER_MODEL_TOOL = {
  name: 'update_user_model',
  description:
    '當使用者透露了「他怎麼理解（或無法理解）方向」時呼叫，把這件事永久記住，未來所有引導都會改變。只記與方向理解有關的事。',
  parameters: {
    type: 'OBJECT',
    properties: {
      avoidCardinal: {
        type: 'BOOLEAN',
        description: '使用者分不清東西南北時設為 true，之後所有引導禁用方位詞',
      },
      orientationVocab: {
        type: 'STRING',
        enum: ['landmark', 'bodyRelative', 'clock', 'cardinal'],
        description: '這位使用者最容易理解的方向語言',
      },
      noteAppend: {
        type: 'STRING',
        description: '一句話記下這位使用者理解方向的特性，例如「分不清左右，要用地標」',
      },
    },
  },
};

async function handleUserMessage(deviceId, message, userModel, lang, engineFacts) {
  const factsBlock = engineFacts
    ? `
目前引擎事實（deterministic，可用來回答方位問題）：
${JSON.stringify(engineFacts)}
規則：方位答案只能來自上面的事實。若 bearing 是 null，誠實告訴他往前走幾步你才能抓到面向，不要猜。`
    : `
（目前沒有導航事實可用——關於「我面向哪」「該往哪走」這類問題，誠實說你需要他動起來或等訊號，不要編造方位。）`;

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `使用者在導航途中對你說：「${message}」

目前的 USER_MODEL：${JSON.stringify(userModel)}
${factsBlock}

如果這句話透露了他怎麼理解（或無法理解）方向，先呼叫 update_user_model 記住，再回覆他。
回覆規則：一到兩句、40字內（English: max ~20 words）、溫柔。可用時鐘方向（如「9點鐘方向」），除此之外不要數字、不要自創地名。
${LANG_RULE[lang]}`,
        },
      ],
    },
  ];

  const first = await withTimeout(
    ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: OWL_PERSONA,
        tools: [{ functionDeclarations: [UPDATE_USER_MODEL_TOOL] }],
        temperature: 0.4,
      },
    }),
    GEMINI_TIMEOUT_MS
  );

  let memoryUpdated = false;
  let appliedPatch = null;
  let replyText = first.text ?? '';

  const calls = first.functionCalls;
  if (calls && calls.length > 0) {
    const call = calls[0];
    if (call.name === 'update_user_model') {
      appliedPatch = call.args ?? {};
      await patchUserModel(deviceId, appliedPatch, `user said: ${message}`);
      memoryUpdated = true;
    }

    // Reuse the model's own content turn verbatim — Gemini 3.5 requires the
    // thoughtSignature attached to the functionCall part to be sent back.
    const modelTurn = first.candidates?.[0]?.content ?? {
      role: 'model',
      parts: [{ functionCall: call }],
    };

    const followup = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: [
          ...contents,
          modelTurn,
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: call.name,
                  response: { ok: true, saved: appliedPatch },
                },
              },
            ],
          },
        ],
        config: { systemInstruction: OWL_PERSONA, temperature: 0.4 },
      }),
      GEMINI_TIMEOUT_MS
    );
    replyText = followup.text ?? replyText;
  }

  return { replyText: replyText.trim(), memoryUpdated, appliedPatch };
}

const FIXED_TEXT = {
  zh: {
    memorySub: '小貓頭鷹記下來了，之後都會這樣帶你。',
    defaultSub: '有什麼不清楚都可以問我。',
    heardMain: '我聽到了，我會陪著你。',
    fallbackMain: '我聽到了，先跟著我走。',
    fallbackSub: '訊號有點忙，但我還在。',
  },
  en: {
    memorySub: "The owl wrote it down — it'll guide you this way from now on.",
    defaultSub: 'Ask me anything that feels unclear.',
    heardMain: "I hear you — I'm right here with you.",
    fallbackMain: 'I hear you — stay with me for now.',
    fallbackSub: "The signal is busy, but I'm still here.",
  },
};

export async function handleTurn(body) {
  const { deviceId, event } = body;
  const lang = body.lang === 'en' ? 'en' : 'zh';
  if (!deviceId || typeof deviceId !== 'string') {
    return { error: 'deviceId_required', status: 400 };
  }

  if (event === 'recovery_needed') {
    // Never trust the client's claimed state: recompute geographic truth
    // server-side from the raw observations. The agent only wakes when the
    // server's own deterministic engine agrees recovery is needed.
    const engine = assessNavigation(body.navSnapshot);
    if (!engine) {
      return { error: 'invalid_nav_snapshot', status: 400 };
    }
    if (!['WRONG_DIRECTION', 'OFF_ROUTE'].includes(engine.state)) {
      return { error: 'engine_disagrees', status: 409 };
    }
    const nav = { ...engine, currentCoords: body.navSnapshot.currentCoords };
    const userModel = await getUserModel(deviceId);
    const landmarkFacts = buildLandmarkFacts(nav.currentCoords, nav.bearing ?? null);

    let speech = null;
    let source = 'fallback';
    let rejectedReason = null;
    try {
      const candidate = await generateGuidance(nav, userModel, landmarkFacts, lang);
      const verdict = validateGuidance(candidate, userModel, LANDMARKS);
      if (verdict.ok) {
        speech = candidate;
        source = 'gemini';
      } else {
        rejectedReason = verdict.reason;
        console.warn('guidance rejected by validator:', verdict.reason, candidate);
      }
    } catch (err) {
      rejectedReason = err.message;
      console.error('gemini guidance failed:', err.message);
    }

    const episodeId = await openEpisode(deviceId, {
      navState: nav.state,
      crossTrackM: Math.round(nav.crossTrackDistance ?? 0),
      guidance: speech,
      source,
      rejectedReason,
      userModelAtStart: userModel,
    });

    return { speech, source, episodeId, userModel };
  }

  if (event === 'user_message') {
    const message = String(body.message ?? '').slice(0, 200).trim();
    if (!message) return { error: 'message_required', status: 400 };

    const userModel = await getUserModel(deviceId);

    // If the client sent raw observations, recompute engine facts server-side
    // so geographic questions ("which way am I facing?") get truthful answers.
    let engineFacts = null;
    const engine = body.navSnapshot ? assessNavigation(body.navSnapshot) : null;
    if (engine) {
      engineFacts = {
        state: engine.state,
        使用者面向角度: engine.bearing !== null ? Math.round(engine.bearing) : null,
        正確方向角度: Math.round(engine.expectedBearing),
        與正確方向的夾角: engine.bearingDelta !== null ? Math.round(engine.bearingDelta) : null,
        離路線公尺: Math.round(engine.crossTrackDistance),
        landmarks: buildLandmarkFacts(body.navSnapshot.currentCoords, engine.bearing),
      };
    }

    try {
      const { replyText, memoryUpdated, appliedPatch } = await handleUserMessage(
        deviceId,
        message,
        userModel,
        lang,
        engineFacts
      );
      if (body.episodeId) {
        await appendEpisodeMessage(deviceId, body.episodeId, {
          user: message,
          owl: replyText,
          memoryUpdated,
        });
      }
      // Never surface raw JSON on the owl's lips.
      const clean = sanitizeReply(replyText);
      return {
        speech: {
          main: clean?.main || FIXED_TEXT[lang].heardMain,
          sub: memoryUpdated ? FIXED_TEXT[lang].memorySub : FIXED_TEXT[lang].defaultSub,
        },
        memoryUpdated,
        appliedPatch,
        source: 'gemini',
      };
    } catch (err) {
      console.error('user_message failed:', err.message);
      return {
        speech: { main: FIXED_TEXT[lang].fallbackMain, sub: FIXED_TEXT[lang].fallbackSub },
        memoryUpdated: false,
        source: 'fallback',
      };
    }
  }

  if (event === 'recovered') {
    if (body.episodeId) {
      await closeEpisode(deviceId, body.episodeId, 'RECOVERED');
    }
    return { ok: true };
  }

  return { error: 'unknown_event', status: 400 };
}
