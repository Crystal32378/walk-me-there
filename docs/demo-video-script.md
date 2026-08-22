# Walk Me There — 4-Minute Demo Video Script

> Target: All Things Agentic Hackathon (Collaborative Partner track).
> Rules that shape this script: max 4 minutes judged; English or English subtitles;
> must show the problem, the value proposition, a live demo, and **visual proof the
> backend runs on Google Cloud**. Judging: Innovation & Operational Utility 40% ·
> Architectural Discipline 30% · Demo & Production Readiness 30%.
> Judges may score from the video alone — the video IS the submission.

**Format:** narration in English (or Chinese with English subtitles — pick one and
keep it consistent). All UI text is Chinese; every UI line that matters gets an
English subtitle. Record the live demo segment in ONE UNEDITED TAKE (rules ask for
"unedited, live execution"; screen recording of the deployed URL + Firestore console
side by side).

---

## 0:00–0:25 — The problem (voice over street footage or phone-in-hand shot)

> Some people can read the address, hold the map, and still get lost.
> Not because the map is wrong — because "turn left" assumes you know
> which way you're facing. Google Maps knows the route.
> Nobody helps the human actually follow it.

Beat: show a Maps screenshot with the blue dot drifting the wrong way,
silently. Caption: **"Maps know the route. Walk Me There helps the human
actually follow it."**

## 0:25–0:50 — Meet the owl (app on screen, thesis)

> Walk Me There is a walking companion with two strict roles.
> A deterministic navigation engine tells the truth: where you are,
> whether you've turned around, how far off the route you've drifted.
> And Gemini translates that truth into words THIS person understands —
> and remembers, forever, how this person understands direction.

Show the owl UI briefly: 「對，就是這個方向。」 (subtitle: "Yes — this is the way.")

## 0:50–2:30 — LIVE DEMO, one unedited take (screen recording)

Layout: browser with the deployed app (`?sim=1`) on the left,
**Firestore console open on the right** (users/{device} document visible).

1. **(0:50)** App walking on-route. Diagnostics panel open so judges see the
   engine's telemetry (state badge, bearing delta, cross-track).
   > The engine watches. No AI involved yet.

2. **(1:05)** Simulated walker turns around. Engine flips to `WRONG_DIRECTION`.
   > The engine — pure geometry — catches the turn-around in seconds.
   > The user never had to press "I'm lost."

   Owl speaks (Gemini): 「我們走反囉，請停下腳步，轉個身往回走吧。」
   (subtitle: "We're heading the wrong way — stop, and turn around with me.")

3. **(1:20)** Tap **I'm confused** → tap 「我分不清東西南北。」
   (subtitle: "I can't tell east from west.")
   > Here's the agentic moment. The user teaches the owl how their
   > sense of direction actually works.

4. **(1:35)** **CAMERA ON FIRESTORE CONSOLE**: the user document updates live —
   `avoidCardinal: true`, `orientationVocab: "bodyRelative"`, and the evidence
   field quoting the user's own words.
   > Gemini decided — through a function call — what to remember.
   > That's a database update you're watching, not a chat reply.

   Owl replies + feather badge: 「小貓頭鷹記住了你理解方向的方式」
   (subtitle: "The owl has learned how you understand direction.")

5. **(1:50)** Walker drifts off-route. Engine flips to `OFF_ROUTE`.
   Owl speaks — **zero cardinal words**, body-relative:
   「我們稍微走偏囉，現在請往左邊轉。」
   (subtitle: "We've drifted a little — turn to your LEFT now.")
   > Same engine truth. Different human words. The guidance changed
   > because the user changed it. And "left" is computed from the
   > engine's bearings — the model cannot invent geography.

6. **(2:15)** Walker returns; state → `ON_ROUTE`; show the episode document
   flip to `outcome: RECOVERED` in Firestore.
   > Only the deterministic engine certifies success.
   > The model is never allowed to grade itself.

## 2:30–3:10 — Architecture + Google Cloud proof

Show `docs/architecture.svg` full screen, then **cut to the Cloud Run console**
(service `walk-me-there-v01`, revision + region visible) and the Vertex AI page.

> Two planes. The truth plane is deterministic and runs on the device —
> no model is ever consulted about geography. The companion plane runs
> on Cloud Run: Gemini 3.5 Flash on Vertex AI through the Google GenAI SDK,
> with Firestore holding the user model and recovery episodes.
> Between the model and the screen sits a deterministic validator:
> no invented numbers, no unregistered landmarks, and it enforces what
> the user taught us. If Gemini is slow or down, the engine's own
> messages take over — navigation never stops.

## 3:10–3:35 — Honesty beat (optional but recommended: real phone outdoors)

If a real outdoor clip exists: 10 seconds of the app on a phone, on the real
Taipei test route. If not:

> The test route is a real 200-meter walk near Taipei 101. The next gate
> is field calibration — including phones that report no compass heading.
> We ship the loop honestly, not just optimistically.

## 3:35–4:00 — The next body (hardware concept image)

Show `docs/owl-hardware-concept.png`, slow pan.

> This is why the truth layer was kept small and deterministic:
> it's small enough to live inside a plush owl with one motor and one LED.
> Five states become five pulses of light and vibration. Eyes up.
> Gemini's voice joins only when you press its head to talk.

Final card:
**Walk Me There** — 牠知道路，但不嫌你不知道。
*It knows the way without making you feel bad for not knowing it.*
URL + GitHub + "Built on Google Cloud".

---

## Shot checklist (compliance)

- [ ] One unedited live-demo take (0:50–2:30) — logs/DB updates/UI changes on camera
- [ ] Firestore console document update ON SCREEN (Proof of Action)
- [ ] Cloud Run console with service/region ON SCREEN (mandatory GCP proof)
- [ ] Vertex AI visible (model garden page or request logs)
- [ ] English narration or English subtitles on every Chinese UI line
- [ ] Under 4:00 total — judges stop watching at 4:00 sharp
- [ ] Uploaded to YouTube/Vimeo as PUBLIC (not unlisted)

## Recording notes

- Use a fresh `deviceId` before recording (clear localStorage or use a private
  window) so run 1 genuinely has no user model.
- The sim walk takes ~35s per load; the "teach → adapted guidance" arc needs
  either one long run (teach during the recovery phase) or two runs with a
  reload — the reload cut is acceptable OUTSIDE the single unedited demo take,
  but inside 0:50–2:30 prefer one continuous run: teach the owl during the
  first recovery, and the off-route phase ~15s later shows the adapted guidance.
- Gemini guidance takes 4–8s to arrive; the static engine message fills the gap.
  That's a feature — narrate it if it happens on camera.
