# Halo Partner CI Card Artwork

Third-party integrations can provide presentation metadata so Halo can display them using the same card treatment as built-in Context Interfaces.

## Banner image

Use:

- **Recommended size:** 1200 × 540 px
- **Aspect ratio:** 2.22:1
- **Preferred format:** PNG
- **Also accepted by the builder:** JPG, JPEG, WebP
- **Safe content area:** centered 1040 × 420 px

Keep important logos, characters, product UI, and text inside the safe area. Rounded card corners and future layout adjustments may crop the outer edge of the image.

Avoid:

- tiny text;
- important details touching the edges;
- full app screenshots with unreadable UI;
- absolute filesystem paths or remote URLs in the manifest.

A simple focal visual generally works better than dense UI.

## Manifest metadata

Example:

```json
{
  "presentation": {
    "card": {
      "bannerImage": "HaloCardBanner.png",
      "category": "File Tools",
      "description": "Convert and process files directly from Halo.",
      "accentColor": "#1E7BFF"
    }
  }
}
```

### Fields

| Field | Type | Guidance |
| --- | --- | --- |
| `presentation.card.bannerImage` | String | Bundle-resource filename. Recommended: `HaloCardBanner.png`. |
| `presentation.card.category` | String | Short card subtitle/category. Builder limit: 40 characters. |
| `presentation.card.description` | String | Concise card description. Builder limit: 160 characters. |
| `presentation.card.accentColor` | String | Optional RGB hex color in `#RRGGBB` form. |

## Add the image to the app bundle

In Xcode:

1. drag the banner into the project;
2. enable **Copy items if needed**;
3. select the macOS app target;
4. confirm the asset is in **Build Phases → Copy Bundle Resources**.

The manifest should contain only the resource filename:

```json
"bannerImage": "HaloCardBanner.png"
```

Do not use:

```json
"bannerImage": "/Users/example/Desktop/HaloCardBanner.png"
```

or a remote URL.

## Compatibility

The `presentation` object is additive metadata. Halo's current protocol decoder ignores unknown JSON fields, so manifests containing this block remain compatible even before a Halo build consumes the partner-card artwork.

The integration builder includes a local image preview and checks the selected banner's pixel dimensions/aspect ratio. The preview image itself is never embedded into the manifest; the partner still ships the actual image as an app-bundle resource.
