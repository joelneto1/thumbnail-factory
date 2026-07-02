# Thumbnail Assistant — Reproduce the Same Thumbnail Result

A zero-cost, zero-code workflow for generating YouTube thumbnails that match the "face on the right, bold text on the left, red arrows pointing at the hero object, blue gradient background" formula — the high-CTR template that works across most thumbnail-driven YouTube niches.

You will generate these in about 90 seconds per thumbnail using **Nano Banana Pro** on [arena.ai](https://arena.ai/image/direct). No API key, no billing, no scripts.

> **Bring your own persona.** This guide does not ship with a face or a voice. You supply your own face reference (the person who will appear in every thumbnail) and fill in your own headline and concept for each video. The workflow is persona-agnostic — it works equally well for a fitness coach, a tech reviewer, a finance explainer, or a cooking channel. Nothing about the prompt hard-codes a specific person, niche, or topic.

---

## Why arena.ai

| Option | Cost | Face matching | Automatable |
|---|---|---|---|
| Gemini API (`nano-banana-pro-preview`) | ~$0.04/image, needs billing | ✅ | ✅ |
| **Arena.ai direct chat** | **Free** | ✅ | ❌ (manual) |
| Pollinations (`flux`) | Free | ❌ (text only) | ✅ |

Arena.ai runs the exact same Nano Banana Pro model as the paid Gemini API, but hosted in a free chat UI. The catch is that every request needs a fresh reCAPTCHA v3 token, so it cannot be called from a server. What you can do is prep everything so the human step is just *paste → attach → enter*.

---

## What you need (one-time)

1. A **browser** (Chrome, Edge, Safari all work). No account required on arena.ai.
2. A **clean face reference** — 1 photo of the person who should appear in every thumbnail. Clean background, neutral-to-warm expression, 3/4 angle or front-facing both work. PNG or JPG, any resolution ≥ 512×512. Save it somewhere you'll remember — e.g. `references/face.png`.
3. A **competitor thumbnail** — for every new video, download the thumbnail of the reference YouTube video (the one whose style you're copying). This gives Nano Banana a layout anchor so the face position, text placement, and accent colors match what already works on the platform.

> Competitor thumbnail trick: `https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg` — paste the 11-character video ID and save the result.

---

## The 5-step workflow (per video)

### 1. Gather the 2 reference images

```
references/face.png        ← your persona (same file every time)
references/competitor.jpg  ← the YouTube thumbnail of the reference video
```

### 2. Pick your headline + main concept

Two pieces of text, two variables:

- **Headline** — 2–6 words, ALL CAPS, the thing the viewer will actually read. E.g. `WHAT YOUR FEET KNOW!` / `9 SIGNS OF DIABETES!`
- **Concept** — one sentence describing the visual object at the center. E.g. `photorealistic close-up of a bare foot with red circles on toes + glucometer nearby`.

The concept should be a single object the viewer can identify at thumbnail size (320×180 on a phone). A foot. A scoop of powder. A liver illustration. A coffee mug. Never a complex scene.

### 3. Open arena.ai

Navigate to https://arena.ai/image/direct in a new tab. In the model picker, select **Nano Banana Pro** (or Nano Banana if Pro is gated). The text box at the bottom accepts both pasted text and uploaded images.

### 4. Paste the prompt + attach both images

Use the reusable template below. Fill in the three bracketed slots:

```
YouTube thumbnail, 16:9, 1920x1080, HIGH CONTRAST CLICK-BAIT STYLE.

Background: smooth vertical blue gradient (light sky blue at top,
slightly darker saturated blue at bottom). Clean, no noise.

RIGHT SIDE: photorealistic portrait of the man/woman in the attached
face reference — match his/her face, hair, outfit, and warm confident
expression EXACTLY. 3/4 angle, clean cutout with subtle drop shadow.
Do not invent a different person.

LEFT SIDE: huge bold sans-serif text. Primary words in white, KEY
WORDS in bright yellow. Heavy black outline (~6px), soft drop shadow.
ALL CAPS, extreme weight (900).
- Top-left in a RED BANNER: "[HEADLINE_TOP]"
- Main headline stacked underneath: "[HEADLINE_MAIN_WHITE]" (white)
  then "[HEADLINE_MAIN_YELLOW]" (bright yellow)

CENTER: [CONCEPT_DESCRIPTION].

Accents: red curved arrow pointing at the main object, small yellow
warning triangle in the upper area, highlight circles. High
saturation, tight negative space.

Must read clearly at 320x180 on a phone.

NO watermarks, NO logos, NO brand names, NO faces other than the
attached reference. Use the layout and style of the second reference
image (blue gradient, bold text left, face right, red arrows, yellow
warning triangle) but DO NOT copy its text — use the new headline
above, and replace its center concept with the one described.
```

Example filled in:

- `[HEADLINE_TOP]` → `WHAT YOUR FEET KNOW!`
- `[HEADLINE_MAIN_WHITE]` → `9 SIGNS`
- `[HEADLINE_MAIN_YELLOW]` → `OF DIABETES!`
- `[CONCEPT_DESCRIPTION]` → `photorealistic close-up of a bare senior adult foot, clean and well-lit, with small red circles highlighting subtle problem areas on the toes and heel, a glucometer and test strip placed near the foot`

Then click the 📎 attach button twice:

1. `references/face.png` — your persona
2. `references/competitor.jpg` — the YouTube reference thumbnail

Press **Enter**.

### 5. Save the output

Nano Banana Pro takes 10–25 seconds. When it finishes, right-click the generated image and **Save As** → `thumbnail_vN.png` in your project folder.

If you don't love the first output, hit **Regenerate**. It's free. Try 2–3 variants and pick the best one.

---

## Tips that make a huge difference

**The face reference controls everything.** If Nano Banana keeps generating a different person, your face ref is too small, too dark, or at a weird angle. Re-shoot with good natural light, face camera, warm neutral expression. One good face ref = infinite consistent thumbnails.

**Keep the concept to one hero object.** "A foot + glucometer" works. "A kitchen scene with multiple ingredients on a counter with morning light streaming through a window" does not. The thumbnail is 320 pixels wide on a phone. Silhouette first, details second.

**Red + yellow are non-negotiable.** Blue background, red arrows, yellow warning triangle, yellow key-word text. This color combo has been A/B tested into the ground by every large thumbnail-driven channel across niches. Don't get creative.

**Never more than 4 words on the main headline.** Readers scan in a split second. `9 SIGNS OF DIABETES` is the maximum. `9 EARLY WARNING SIGNS YOUR FEET ARE SHOWING YOU ABOUT DIABETES` does not work. Trust the curiosity gap — the full story lives in the video.

**Use "the man in the attached face reference" phrasing.** Do not describe the person's appearance in words ("a 40-year-old man with brown hair in a navy suit"). That invites Nano Banana to invent variations. Point at the photo and say "that guy."

**Attach the competitor thumbnail every time.** It's tempting to skip after you've done a few, but the layout anchor is what keeps the text-on-left/face-on-right ratio consistent across videos. Without it, you'll drift.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Generated face looks like a different person | Face reference too small, too dark, or at extreme angle. Re-shoot at 1024×1024+, good lighting, 3/4 or front-facing. |
| Text has typos (common with Nano Banana) | Regenerate. If still broken, split headline into shorter words. `DIABETES` renders more reliably than `NEUROPATHY`. |
| Arena says "verify you're human" | Solve the reCAPTCHA and re-submit. Normal. |
| Image is 1024×1024 instead of 1920×1080 | State `16:9, 1920x1080` in the prompt AND use the aspect-ratio toggle in the UI if Arena shows one. |
| Colors look muted / washed out | Add "HIGH SATURATION" to the prompt. Add "vivid, punchy colors" at the end. |
| Face is tiny / far away | Say "CLOSE-UP portrait, head and shoulders fills the right third of the frame" in the right-side instruction. |
| Nano Banana Pro is not visible in model picker | Fall back to plain Nano Banana. It's 90% as good for this use case. |

---

## When to use Gemini API instead

Switch to the paid API (`nano-banana-pro-preview` at ~$0.04/image) when:

- You are generating more than 10 thumbnails per day
- You want the thumbnail generation fully automated inside your pipeline
- You need multiple variants per video for A/B testing

The API takes the same inputs — face PNG + competitor JPG + prompt — and returns a PNG. The script lives next to this file: [`generate_thumbnail_v15.js`](generate_thumbnail_v15.js) is a working reference.

Billing setup: https://console.cloud.google.com/billing → link a billing account → done. Google gives new accounts $300 of free credits.

---

## File structure

```
your-project/
├── references/
│   ├── face.png              one-time asset, reused for every video
│   └── competitor.jpg        per-video, swap for each new one
├── arena_prompt_vN.txt       the filled-in prompt for video N (optional)
├── thumbnail_vN.png          the final saved output
└── generate_thumbnail_vN.js  optional paid-API version (API key + billing)
```

---

## Reproducibility checklist

Before declaring a thumbnail done, check:

- [ ] Face matches your persona (compare side-by-side with the reference)
- [ ] Headline spelled correctly (Nano Banana sometimes invents letters)
- [ ] Face is on the right third, not centered or left
- [ ] Main concept object is clearly visible and centered
- [ ] Red arrow and yellow warning triangle are present
- [ ] Text is readable when the image is scaled down to 320×180 (actually do this — shrink it in an image viewer)
- [ ] No watermarks, brand names, or ghost faces in the background

If all seven check out, upload it.
