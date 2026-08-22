// The companion agent. One rule governs this file:
// Gemini understands the person. It never decides the route.
// Every geographic fact it sees was computed by the deterministic engine.

import { GoogleGenAI } from '@google/genai';
import { LANDMARKS, buildLandmarkFacts } from './landmarks.js';
import { validateGuidance } from './validator.js';
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
const GEMINI_TIMEOUT_MS = 12000;

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

function buildGuidancePrompt(navSnapshot, userModel, landmarkFacts) {
  const facts = {
    state: navSnapshot.state,
    離路線幾公尺: Math.round(navSnapshot.crossTrackDistance ?? 0),
    使用者面向與正確方向的夾角度數: navSnapshot.bearingDelta != null ? Math.round(navSnapshot.bearingDelta) : null,
    使用者目前面向角度: navSnapshot.bearing != null ? Math.round(navSnapshot.bearing) : null,
    正確方向角度: navSnapshot.expectedBearing != null ? Math.round(navSnapshot.expectedBearing) : null,
  };

  const modelDesc = {
    avoidCardinal: userModel.avoidCardinal
      ? '此使用者「分不清東西南北」。絕對禁止使用東、西、南、北等方位字，改用地標（朝著／背對）、身體相對方向（左手邊、右手邊、轉身）或時鐘方向。'
      : '尚無限制，但方位詞請謹慎使用。',
    orientationVocab: userModel.orientationVocab,
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

輸出 JSON：{"main": "一句主要指引，30字內", "sub": "一句安撫或補充，40字內"}`;
}

async function generateGuidance(navSnapshot, userModel, landmarkFacts) {
  const response = await withTimeout(
    ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: buildGuidancePrompt(navSnapshot, userModel, landmarkFacts) }] }],
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

async function handleUserMessage(deviceId, message, userModel) {
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `使用者在導航途中對你說：「${message}」

目前的 USER_MODEL：${JSON.stringify(userModel)}

如果這句話透露了他怎麼理解（或無法理解）方向，先呼叫 update_user_model 記住，再回覆他。
回覆規則：一句話、30字內、溫柔、告訴他你會怎麼配合他。不要數字、不要自創地名。`,
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

export async function handleTurn(body) {
  const { deviceId, event } = body;
  if (!deviceId || typeof deviceId !== 'string') {
    return { error: 'deviceId_required', status: 400 };
  }

  if (event === 'recovery_needed') {
    const nav = body.navSnapshot;
    if (!nav || !['WRONG_DIRECTION', 'OFF_ROUTE'].includes(nav.state)) {
      return { error: 'invalid_nav_state', status: 400 };
    }
    const userModel = await getUserModel(deviceId);
    const landmarkFacts = buildLandmarkFacts(nav.currentCoords, nav.bearing ?? null);

    let speech = null;
    let source = 'fallback';
    let rejectedReason = null;
    try {
      const candidate = await generateGuidance(nav, userModel, landmarkFacts);
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
    try {
      const { replyText, memoryUpdated, appliedPatch } = await handleUserMessage(
        deviceId,
        message,
        userModel
      );
      if (body.episodeId) {
        await appendEpisodeMessage(deviceId, body.episodeId, {
          user: message,
          owl: replyText,
          memoryUpdated,
        });
      }
      return {
        speech: {
          main: replyText || '我聽到了，我會陪著你。',
          sub: memoryUpdated ? '小貓頭鷹記下來了，之後都會這樣帶你。' : '有什麼不清楚都可以問我。',
        },
        memoryUpdated,
        appliedPatch,
        source: 'gemini',
      };
    } catch (err) {
      console.error('user_message failed:', err.message);
      return {
        speech: { main: '我聽到了，先跟著我走。', sub: '訊號有點忙，但我還在。' },
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
