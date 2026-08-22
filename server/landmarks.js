import { getDistance, getBearing, clockFace } from './geo.js';

// Curated registry for the current Taipei 101 test polyline.
// The agent may only reference landmarks listed here; their direction and
// distance are computed deterministically per request, never by the model.
export const LANDMARKS = [
  {
    id: 'taipei101',
    name: '台北101',
    nameEn: 'Taipei 101',
    lat: 25.0339,
    lng: 121.5645,
    note: '這一區最高的大樓，幾乎從任何地方抬頭都看得到 / the tallest tower in the area, visible from almost anywhere',
  },
];

export function buildLandmarkFacts(userCoords, userHeading) {
  return LANDMARKS.map((lm) => {
    const bearing = getBearing(userCoords, { lat: lm.lat, lng: lm.lng });
    return {
      id: lm.id,
      name: lm.name,
      nameEn: lm.nameEn,
      note: lm.note,
      distanceM: Math.round(getDistance(userCoords, { lat: lm.lat, lng: lm.lng })),
      bearingDeg: Math.round(bearing),
      clock: clockFace(bearing, userHeading),
    };
  });
}
