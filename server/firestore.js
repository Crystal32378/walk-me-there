import { Firestore, FieldValue } from '@google-cloud/firestore';

const db = new Firestore();

const userRef = (deviceId) => db.collection('users').doc(deviceId);

export async function getUserModel(deviceId) {
  const snap = await userRef(deviceId).get();
  if (!snap.exists) {
    return { avoidCardinal: false, orientationVocab: null, notes: [] };
  }
  const d = snap.data();
  return {
    avoidCardinal: d.avoidCardinal === true,
    orientationVocab: d.orientationVocab ?? null,
    notes: Array.isArray(d.notes) ? d.notes : [],
  };
}

export async function patchUserModel(deviceId, patch, evidence) {
  const update = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof patch.avoidCardinal === 'boolean') update.avoidCardinal = patch.avoidCardinal;
  if (typeof patch.orientationVocab === 'string') update.orientationVocab = patch.orientationVocab;
  if (typeof patch.noteAppend === 'string' && patch.noteAppend.trim()) {
    update.notes = FieldValue.arrayUnion(patch.noteAppend.trim());
  }
  if (evidence) update.lastEvidence = evidence;
  await userRef(deviceId).set(update, { merge: true });
  return update;
}

export async function openEpisode(deviceId, data) {
  const ref = await userRef(deviceId).collection('episodes').add({
    ...data,
    startedAt: FieldValue.serverTimestamp(),
    outcome: 'OPEN',
  });
  return ref.id;
}

export async function appendEpisodeMessage(deviceId, episodeId, entry) {
  await userRef(deviceId)
    .collection('episodes')
    .doc(episodeId)
    .set({ messages: FieldValue.arrayUnion(entry) }, { merge: true });
}

export async function closeEpisode(deviceId, episodeId, outcome) {
  await userRef(deviceId).collection('episodes').doc(episodeId).set(
    {
      outcome,
      closedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
