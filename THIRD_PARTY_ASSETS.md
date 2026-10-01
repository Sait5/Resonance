# Resonance asset register

Checked 2026-09-30 against publisher pages and upstream license files. Playable GLBs are derivatives prepared locally in Blender 5.2.2. No external asset with an unknown license was added.

## Active models

| File under public/models/playable/ | Author / source | License | Changes |
| --- | --- | --- | --- |
| piano.glb | [jeremy — Piano](https://poly.pizza/m/7U-93vxPOER) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Source keys separated and corrected to 52 white + 36 black; normalized; named pivots and press clips |
| acoustic.glb | [3D Assets — Acoustic Guitar](https://3dassets.dev/assets/music-recording-studio-and-instruments-acoustic-guitar-e49f4cfb) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Storage stand removed; soundbox reconstructed with smooth outline and real sound hole; existing strings separated, subdivided and aligned |
| drums.glb | [Zsky — Drum Set](https://poly.pizza/m/qWU9Q4flfQ) | CC BY 3.0 | Existing head faces extracted; cymbals separated; complete ride assembly derived from original cymbal and stand |
| electric.glb | [Poly by Google — Electric guitar](https://poly.pizza/m/eoSib2-NN9Y) | CC BY 3.0 | Body and texture retained; six original strings separated and subdivided |
| bass.glb | [Zsky — Bass Guitar](https://poly.pizza/m/ByBoHTCdYZ) | CC BY 3.0 | Body retained; four original strings separated and subdivided |
| violin.glb | [3D Assets — Violin](https://3dassets.dev/assets/orchestra-and-band-instruments-violin-60c523d2) | CC0 1.0 | Body rebuilt with carved f-holes; four original strings separated and subdivided; original bow added |
| saxophone.glb | Resonance, procedural Blender model | Original project asset | Hollow curved bore, bell, neck, mouthpiece and ten animated key assemblies |
| trumpet.glb | [3D Assets — Trumpet](https://3dassets.dev/assets/orchestra-and-band-instruments-trumpet-6f16ccbe) | CC0 1.0 | Three original valve/stem assemblies separated; horizontal orientation; materials and press clips |

CC BY requires attribution, a license reference and identification of modifications. Visible scene credits link each source; this register documents modifications. CC0 permits commercial use, modification and redistribution. The 3D Assets publisher identifies its models as AI-assisted. Rebuilt geometry is described in the Changes column.

Preparation: scripts/audit-models.py and scripts/prepare-instruments.py. Editable Blender scenes and export/re-import reports: artifacts/prepared/. No Draco or Meshopt compression is enabled.

## Audio

| Instruments | Original recording sources | Distribution license |
| --- | --- | --- |
| Piano, violin, trumpet | Versilian Studios / VSCO, through Nathan Brosowsky's tonejs-instruments | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| Acoustic guitar | University of Iowa, through tonejs-instruments | CC BY 3.0 |
| Electric guitar, bass | Karoryfer, through tonejs-instruments | CC BY 3.0 |
| Saxophone | Michael Giles / Lawrence Fritts, University of Iowa MIS | [Iowa MIS permission for any projects](https://theremin.music.uiowa.edu/mis.html) |
| Drums | Zajo and menegass on Freesound, through Sonic Pi / Sam Blenny | CC0 1.0 |

Pitched files: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments), [license](https://github.com/nbrosowsky/tonejs-instruments/blob/master/LICENSE.md), [original sources](https://github.com/nbrosowsky/tonejs-instruments/blob/master/sample-source-info.txt). Credit: Nathan Brosowsky, contributors and recording authors above. Tonejs files copied unchanged; playback applies envelopes and nearest-sample transposition. Saxophone uses eight Iowa alto-sax recordings converted from AIFF to mono WAV, trimmed and faded; normal tuning uses each exact recorded pitch. Notice: public/audio/licenses/iowa-sax.txt.

Drums: [web-midi-drumkit](https://github.com/samblenny/web-midi-drumkit), [license](https://github.com/samblenny/web-midi-drumkit/blob/main/LICENSES/LICENSE_SAMPLES.md), [per-file sources](https://github.com/samblenny/web-midi-drumkit/blob/main/samples/README.md). Kick: Zajo/4832; snare: menegass/100058; closed/open hat: menegass/100053 and 100055; toms: menegass/100062, 100064, 100066; splash/crash: menegass/100060; cymbal/ride: menegass/100057. The source calls the last a soft cymbal; its suitability as a ride requires listening review.

Upstream notices and a public credit page: public/audio/licenses/. lib/sample-manifest.json records file paths, root MIDI notes and byte counts. scripts/fetch-instrument-samples.mjs reproduces downloads. Only the selected instrument's sounds load. Piano uses 29 spaced samples; maximum nearest-sample transposition is three semitones (A0 from C1), and C8 uses B7 shifted one semitone. Listening review is still required. Violin samples are bowed, not claimed to be recorded pizzicato.

## Replacement search and remaining acceptance

- [Bey — Violin, CC0](https://www.blendswap.com/blend/22252): signed-in download required; not imported.
- [Marcin Solarz / Virtual Museums of Małopolska — scanned violin, CC0](https://sketchfab.com/3d-models/violin-a784af0713a643b19ffcf65194bc0fbf): candidate only; no downloaded file or rig validation.
- [Sam Meese — Simple Instruments, CC0](https://sammeese.itch.io/simple-instruments-assets): candidate only; low-poly, not a verified quality upgrade.
- Commercial rigged grand-piano results were not purchased or incorporated.

The violin and trumpet are revised derivatives of existing sources, not independently sourced replacements. Their requested replacement quality remains part of acceptance. Historical unused GLBs at public/models/ are retained unchanged from the initial checkout; this register describes the active playable derivatives.

