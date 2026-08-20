# Walk Me There

> **Maps know the route. Walk Me There helps the human actually follow it.**

Walk Me There is a mobile walking companion for people who can know the address, have directions in front of them, and still wonder:

- Which way am I actually facing?
- Which left turn do you mean?
- Is this the intersection?
- Have I been walking the wrong way for the last 30 seconds?

Instead of dumping a route and expecting the human to interpret it, Walk Me There is built around a tighter loop:

**Observe → Decide → Guide → Verify → Recover**

The companion is a small owl with one product rule:

> **牠知道路，但不嫌你不知道。**  
> It knows the way without making you feel bad for not knowing it.

## Live demo

**https://walk-me-there-v01-134673885671.asia-east1.run.app**

Best experienced on a phone with location permission enabled.

## What exists today

The current `v0.1.5` baseline is deliberately small:

- React + TypeScript + Vite mobile UI
- Browser `navigator.geolocation.watchPosition`
- Deterministic distance, bearing, bearing-delta, and cross-track calculations
- Five navigation states:
  - `UNCERTAIN_GPS`
  - `STATIONARY`
  - `ON_ROUTE`
  - `WRONG_DIRECTION`
  - `OFF_ROUTE`
- Owl companion UI that translates machine state into a single human instruction
- Collapsible developer diagnostics for field calibration
- 9 deterministic geometry/navigation tests
- Cloud Run deployment

The current test route is a hardcoded ~200 m polyline around the Taipei 101 area. It exists only to calibrate the navigation engine before real route APIs are introduced.

## Architecture

```text
Browser Geolocation
        ↓
Deterministic geometry
(distance / bearing / cross-track)
        ↓
Navigation state
        ↓
Presentation mapping
        ↓
Owl companion instruction
```

The important architectural rule is:

> **Geographic truth must be deterministic. Language is presentation.**

An LLM should never invent a route, guess whether the user is off-route, hallucinate a landmark, or independently change navigation state.

## Current technical caveat

`WRONG_DIRECTION` currently relies on the browser/device `GeolocationCoordinates.heading` value when it is available.

That is intentionally not being treated as solved. The next field tests are designed to answer whether real phones provide a stable enough heading signal during walking and turn-around behavior. If not, the next engine change will derive movement bearing from sequential GPS samples with minimum-displacement and rolling-window stabilization while preserving the same state contract.

## Field-test status

The app has completed an initial outdoor phone smoke test: it loads, receives location, and is usable outside.

The core navigation thesis is **not yet validated**. The next tests are:

1. **T1 — Stationary:** stand still → expect `STATIONARY`
2. **T2 — Correct direction:** walk along the route → expect stable `ON_ROUTE`
3. **T3 — Turn around:** walk correctly, then reverse direction → expect `WRONG_DIRECTION`
4. **T4 — Deviate:** move clearly away from the route → expect `OFF_ROUTE`

The most important gate is T3:

> **Can the system detect that a real person has turned around, within a useful number of seconds, without the person first pressing “I’m lost”?**

## What is deliberately not built yet

No Google Routes, Places, Gemini, ADK, TTS, Vision, account system, destination search, or travel-planning layer is integrated in this baseline.

That is intentional. The project is validating the physical navigation loop before adding platform complexity.

## Planned progression

```text
Field calibration
    ↓
Robust movement-bearing estimation (if required)
    ↓
Google Routes — route truth
    ↓
Google Places — landmark context
    ↓
Gemini — clear micro-instructions and recovery wording
    ↓
TTS
    ↓
Optional Vision
```

## Run locally

```bash
npm install
npm test
npm run dev
```

Production build:

```bash
npm run build
```

## Baseline

The pre-field-test source baseline is tagged:

`v0.1.5-pre-field-test`

It represents the frozen Owl companion UI + deterministic navigation baseline before real-world calibration changes begin.
