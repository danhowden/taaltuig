# Anki Example Decks

This directory contains real Anki deck files used for integration testing and development.

## Files

### dutch-large.apkg (21 MB)
- **Format**: Legacy 1 (`collection.anki2` only)
- **Size**: ~2500 cards with audio
- **Created**: February 2022
- **Purpose**: Tests older Anki format, large deck performance

**Format Details:**
```
dutch-large.apkg
├── collection.anki2      # SQLite database (Legacy 1 format)
├── media files (0-2000+) # Audio files for pronunciation
└── (no media JSON)       # Older format doesn't always include media mapping
```

### spanish-small.apkg (59 KB)
- **Format**: Legacy 2 (`collection.anki21` + `collection.anki2` stub)
- **Size**: Small deck (~10-20 cards)
- **Created**: January 2026
- **Purpose**: Tests modern Anki format with backward compatibility

**Format Details:**
```
spanish-small.apkg
├── collection.anki21     # SQLite database (Legacy 2 format) - PRIMARY
├── collection.anki2      # Compatibility stub (51 KB, minimal data)
├── media                 # JSON mapping file
└── meta                  # Metadata file
```

## Anki Format Versions

Our importer attempts to detect all three Anki formats but can only parse two:

| Version | File | Compression | Support Status |
|---------|------|-------------|----------------|
| **Legacy 1** | `collection.anki2` | deflate | ✅ Full support (tested with dutch-large) |
| **Legacy 2** | `collection.anki21` | deflate | ✅ Full support (tested with spanish-small) |
| **Latest** | `collection.anki21b` | zstd + protobuf | ❌ Not supported (anki-reader lacks zstd/protobuf) |

### Version Detection Logic

The import Lambda tries files in priority order:
```typescript
let collectionFile = zip.file('collection.anki21') ||   // Try Legacy 2 first (most common)
                     zip.file('collection.anki2') ||    // Fallback to Legacy 1
                     zip.file('collection.anki21b')     // Detected but will fail parsing
```

**Note**: If a `.anki21b` file is found, the import will fail because `anki-reader@0.3.0` doesn't support zstd compression or protobuf parsing. Users must export with "Support older Anki versions" checked.

## Why Two Different Formats?

**dutch-large.apkg** was exported from an older Anki version (2019-2022 era):
- Uses only `collection.anki2` (Legacy 1 format)
- Common in decks shared before 2021
- AnkiWeb decks from this era use this format

**spanish-small.apkg** was exported from modern Anki (2023+):
- Primary database: `collection.anki21` (Legacy 2)
- Includes `collection.anki2` stub for backward compatibility
- Modern Anki exports both files when "Support older Anki versions" is checked
- AnkiWeb now uses this format for shared decks

## Testing Coverage

These files ensure we handle:
- ✅ Legacy 1 format (older shared decks, 2019-2022 era)
- ✅ Legacy 2 format (modern shared decks, 2023+)
- ✅ Large decks with media files (21 MB with audio)
- ✅ Small decks for quick testing
- ✅ Backward compatibility stubs (spanish-small has both .anki21 and .anki2)
- ❌ Latest format (`.anki21b`) - not supported by anki-reader library

**Limitation**: Users must export decks with "Support older Anki versions" enabled in Anki's export dialog to generate `.anki21` files instead of `.anki21b`.

## Usage in Tests

See integration tests in `/packages/lambdas/import-anki-deck/src/integration.test.ts`:

```typescript
// Test Legacy 1 format (dutch-large)
const deckPath = path.join(__dirname, '../../../../docs/anki-examples/dutch-large.apkg')

// Test Legacy 2 format (spanish-small)
const deckPath = path.join(__dirname, '../../../../docs/anki-examples/spanish-small.apkg')
```

## Adding New Test Decks

To add a new test deck:

1. Export from Anki with "Support older Anki versions" checked
2. Place in this directory
3. Document format version and purpose in this README
4. Add integration test in `import-anki-deck/src/integration.test.ts`

## References

- Full format documentation: `/docs/research/anki-format-research.md`
- Import implementation: `/packages/lambdas/import-anki-deck/src/index.ts`
- Format specs: [AnkiDroid Wiki - Database Structure](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure)
