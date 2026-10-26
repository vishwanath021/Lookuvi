# Face fixtures

Lookuvi does not keep photographs of real people in fixtures, tests, screenshots, docs, or assets. A face here is either a geometric drawing or an original synthetic portrait of a person who does not exist.

## Licence

The nine files in `tests/fixtures/portraits/` and the camera clip `tests/fixtures/face-live.y4m` are original synthetic images created for this repository on 2026-10-26.

- They depict fictional people. They are not photographs, tracings, or edits of a real person, a celebrity, or a public figure.
- No third-party photograph licence applies, because they were not downloaded.
- Licence: Lookuvi synthetic fixture. They may be copied inside this repository for tests, docs, and screenshots.

Landmark JSON beside each portrait is measurement data from MediaPipe Face Landmarker (Python `mediapipe` 1.1, model `assets/vision/face_landmarker.task`, 478 points). The model file itself stays under the Apache License 2.0 noted in `assets/vision/NOTICE.md`.

## Portraits replaced in this change

These files used to be CC0 photographs from Wikimedia Commons, including Unsplash uploads. Those photographs have been deleted from the tree and replaced with the synthetic files above.

| File | Previous source |
|---|---|
| `tests/fixtures/portraits/malayali-beard.jpg` | https://commons.wikimedia.org/wiki/File:Outdoors-man-portrait.jpg |
| `tests/fixtures/portraits/glasses-beard.jpg` | https://commons.wikimedia.org/wiki/File:Man_with_a_white_beard_and_glasses,_by_Angelina_Litvin,_2015-10-05_(Unsplash).jpg |
| `tests/fixtures/portraits/glasses-outdoor.jpg` | https://commons.wikimedia.org/wiki/File:Man_vanguard_glasses_outdoors_(Unsplash).jpg |
| `tests/fixtures/portraits/curly-freckles.jpg` | https://commons.wikimedia.org/wiki/File:Curly_hair_and_freckles_man_(Unsplash).jpg |
| `tests/fixtures/portraits/face-portrait.jpg` | https://commons.wikimedia.org/wiki/File:Face_portrait_(Unsplash).jpg |
| `tests/fixtures/portraits/woman-pink.jpg` | https://commons.wikimedia.org/wiki/File:Smiling_woman_pink_shirt.jpg |
| `tests/fixtures/portraits/phone-smile.jpg` | https://commons.wikimedia.org/wiki/File:Smiling_woman_with_a_phone_(Unsplash).jpg |
| `tests/fixtures/portraits/turned-beanie.jpg` | https://commons.wikimedia.org/wiki/File:Beard_and_Beanie_(Unsplash).jpg |
| `tests/fixtures/portraits/bindi-smile.jpg` | https://commons.wikimedia.org/wiki/File:Woman_with_bindi_smiles_(Unsplash).jpg |

`bindi-smile.jpg` had been that Commons photograph rotated about 20 degrees. The replacement is a new synthetic portrait, not a rotation of the old file.

The makeup studio end-to-end test uses `woman-pink.jpg`. The align-slider and studio specs use `glasses-beard.jpg`.

## Camera clip replaced in this change

| File | Previous source | Replacement |
|---|---|---|
| `tests/fixtures/face-live.y4m` | A 480×640, 8 fps, 1 second photographic clip added in commit `72142ca` (`Add bridal looks with a live mirror and metallic controls`). The repository had no licence or attribution file for it. A decoded frame was a frontal photograph of a real person. | Still frame of the synthetic `woman-pink.jpg`, scaled and cropped to 480×640 and repeated for 1 second at 8 fps. |

Playwright points the fake camera at this file (`playwright.config.ts`). `docs/screenshots/03-camera.png`, `04-preview.png`, `15-demo-result.png`, and `17-after-photo.png` are recaptured from that clip.

## Already synthetic, not replaced

| Path | What it is |
|---|---|
| `tests/fixtures/faces/*.jpg` | Geometric drawings from `src/lib/face/synthetic.ts`, written by `writeMaskFixtures`. Flat shapes, not people. `no-face.jpg` is a blank field. |
| `tests/fixtures/hand.jpg` | The same geometric hand drawing. |
| `tests/fixtures/selfie.y4m` | A 240×320 clip of that geometric face. |
| `public/samples/portrait.jpg` | Flat illustration from `scripts/generate-placeholders.ts`. The guest samples and several docs screenshots use this file. |
| `public/samples/demo-before.jpg`, `demo-after.jpg` | Labelled sample cards from `scripts/write-demo-samples.ts`. |
| `public/styles/*.jpg`, `public/brows/`, `public/beards/` | Catalogue images documented as generated fictional portraits in `docs/REFERENCE-MODE-REVIEW.md`. They were not downloaded from Wikimedia. |
| `tests/fixtures/live/*.jpg` | Crops of those catalogue files, built by `scripts/build-live-fixtures.mjs`. See `tests/fixtures/live/SOURCES.txt`. |
| `tests/fixtures/replay/long-layers-before.jpg`, `long-layers-raw.jpg` | Saved provider frames for the face-guard regression. They are not the Wikimedia portraits. |
| `docs/mask-overlays/` | Debug overlays of the geometric fixtures plus three catalogue crops (`real-soft-bob`, `real-soft-arch`, `real-short-boxed`). |

`tests/fixtures/faces/no-face.jpg` is the makeup studio check for a picture with no face.
