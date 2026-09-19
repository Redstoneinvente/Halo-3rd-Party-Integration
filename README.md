# Halo 3rd Party Integration

Static protocol-v2 manifest builder and implementation reference for macOS apps integrating with Halo.

## What it generates

The builder emits the current Halo `HaloIntegration.json` shape:

- `protocolVersion: 2`
- `app.name` + exact `app.bundleIdentifier`
- optional partner-card presentation metadata under `presentation.card`
- typed `actions`
- explicit action `input` (`none` or `files`)
- file extensions and single/multiple-file behavior
- typed action options with optional defaults
- `fileDrag`, `keyboardShortcut`, `manual`, and schema-valid `partnerEvent` triggers
- action mappings per trigger
- `delivery.type: "openRequest"`

It also validates the important limits currently enforced by Halo: 256 KB manifest size, 64 actions, 32 options per action, 32 triggers, identifier syntax, extension syntax, trigger/action references, file-drag compatibility, and option-default types.

## Partner CI card artwork

Partners can provide artwork so their integration can be presented using the same visual card treatment as Halo's built-in Context Interfaces.

Recommended banner specification:

- **1200 × 540 px**
- **2.22:1 aspect ratio**
- **PNG preferred**
- keep important content inside a centered **1040 × 420 px safe area**
- avoid tiny text and placing logos against the outer edges

The builder writes optional presentation metadata like:

```json
"presentation": {
  "card": {
    "bannerImage": "HaloCardBanner.png",
    "category": "File Tools",
    "description": "Convert and process files directly from Halo.",
    "accentColor": "#1E7BFF"
  }
}
```

`bannerImage` is a **bundle resource filename**, not an absolute path or URL. Add the image to the macOS app target alongside `HaloIntegration.json`.

The presentation block is additive. Current Halo protocol decoding safely ignores unknown fields, so a manifest containing this metadata remains compatible even before a Halo build consumes partner-card artwork.

See `docs/CardArtwork.md` for the full asset guidance.

## Bundle location

Place the generated file at:

```text
YourApp.app/Contents/Resources/HaloIntegration.json
```

In Xcode, add `HaloIntegration.json` to the app target and confirm it appears in **Build Phases → Copy Bundle Resources**.

## Receiving actions

Discovery is only half of the integration. `openRequest` delivery opens a temporary `.halorequest` file together with the authorized input files using your app. Your app should:

1. register the `.halorequest` document type;
2. implement `NSApplicationDelegate.application(_:open:)` (or an equivalent URL-open path);
3. decode the request envelope;
4. resolve `actionID` (falling back to `action` for v1 compatibility if desired);
5. execute the declared action with the other opened file URLs and typed `options`.

See `examples/PartnerReceiver.swift` and the implementation guide on the site.

## Current support note

`partnerEvent` is accepted by the current Halo manifest codec, but external partner-event ingress is not enabled yet. The builder flags this as a warning instead of presenting it as an end-to-end trigger.


## Included examples

- `examples/HaloIntegration.example.json` — complete protocol-v2 manifest.
- `examples/PartnerReceiver.swift` — macOS `NSApplicationDelegate` receiver that batches Launch Services URL callbacks and decodes Halo requests.
- `examples/InfoPlist.halorequest.xml` — document-type and UTI registration snippet for `.halorequest`.
- `docs/CardArtwork.md` — partner CI banner/card artwork specification.

The live builder itself is served by `index.html`, `styles.css`, and `app.js`.
