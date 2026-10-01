# Resonance

Interactive 3D musical instruments: piano, acoustic and electric guitar, bass, drums, violin, alto saxophone and trumpet. Click actual moving model parts, use computer keys or a MIDI keyboard. Each key plays one note; simultaneous keys are polyphonic.

## Run

Node.js 22.13 or newer.

```sh
npm install
npm run dev
node scripts/test-instrument-engine.mjs
npx tsc --noEmit
npm run build
```

Sound controls include volume, tone warmth, A4 reference and transposition. Guitars, bass and violin offer tuning presets and individual string tuning, saved per instrument in browser storage. Trumpet notes use 1–9, 0, minus and equals, plus letter aliases. Piano letters and digits each trigger one note; Shift-click latches a piano key and Escape releases held notes.

Four original compositions have instrument-specific arrangements in Watch mode.

## Assets

See [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md) and public/audio/licenses for model and recording credits. Editable scenes and export validation are in artifacts/prepared. Reproduce models with Blender 5.2: first scripts/audit-models.py, then scripts/prepare-instruments.py. Sample download scripts are in scripts/.
