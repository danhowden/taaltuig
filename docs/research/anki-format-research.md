# Anki deck format: Complete technical guide for building an importer

The **.apkg file is simply a renamed ZIP archive** containing a SQLite database and media files—making it fully parseable without any Anki installation. This report provides everything needed to build a robust Anki import feature for a language learning application, including database schemas, code examples, library recommendations, and security considerations.

## The internal architecture of .apkg files

An Anki deck package (`.apkg`) is a standard ZIP archive that can be extracted with any ZIP library. Inside, you'll find this structure:

```
example.apkg (ZIP archive)
├── collection.anki21     # SQLite database (Legacy 2 format - most common)
├── collection.anki2      # SQLite database (Legacy 1 format or compatibility stub)
├── collection.anki21b    # SQLite database (Latest format - zstd compressed)
├── media                 # JSON file mapping numbered files to original names
├── 0                     # Media file (renamed to sequential integer)
├── 1                     # Media file
└── ...
```

The **media mapping file** is crucial—it's a JSON dictionary that maps the numbered filenames back to their originals: `{"0": "pronunciation.mp3", "1": "cat.jpg"}`. Media references in card content use the original filenames, not the numbers.

**Three format versions exist**, which importers must handle:

| Version | Database File | Compression | Config Storage | Detection |
|---------|--------------|-------------|----------------|-----------|
| Legacy 1 | `collection.anki2` | deflate | JSON in TEXT | Only .anki2 exists |
| **Legacy 2** | `collection.anki21` | deflate | JSON in TEXT | Most common for shared decks |
| Latest | `collection.anki21b` | zstd | Protobuf in BLOB | Requires additional libraries |

For maximum compatibility, prioritize **Legacy 2 format** support—it's what AnkiWeb uses for shared decks and what Anki exports when "Support older Anki versions" is enabled.

**Our test coverage**: See `/docs/anki-examples/` for real deck files testing both Legacy 1 (dutch-large.apkg) and Legacy 2 (spanish-small.apkg) formats.

## Database schema and core tables

The SQLite database contains five main tables. Understanding `notes` and `col` is essential for extracting flashcard content.

### The notes table stores actual content

```sql
CREATE TABLE notes (
    id      integer PRIMARY KEY,  -- epoch milliseconds
    guid    text NOT NULL,        -- globally unique ID for syncing
    mid     integer NOT NULL,     -- model/note type ID
    mod     integer NOT NULL,     -- modification timestamp (seconds)
    usn     integer NOT NULL,     -- update sequence number
    tags    text NOT NULL,        -- space-separated with padding: " tag1 tag2 "
    flds    text NOT NULL,        -- fields separated by 0x1f (unit separator)
    sfld    integer NOT NULL,     -- sort field value
    csum    integer NOT NULL,     -- checksum for duplicate detection
    flags   integer NOT NULL,
    data    text NOT NULL
);
```

**Critical implementation detail**: The `flds` column stores all field values separated by the **Unit Separator character (ASCII 31, 0x1F)**—not tabs or newlines. Parsing example:

```python
FIELD_SEPARATOR = chr(0x1f)  # ASCII 31
fields = note['flds'].split(FIELD_SEPARATOR)
# For a language deck: ['cat', '猫', 'ねこ', '[sound:cat.mp3]']
```

### The col table contains models and deck definitions

This single-row table holds JSON-encoded configuration in TEXT columns:

| Column | Content |
|--------|---------|
| `models` | Note type definitions with field names and card templates |
| `decks` | Deck hierarchy and metadata |
| `dconf` | Deck options (new cards/day, intervals, etc.) |
| `conf` | Global collection settings |

**Note types (models)** define which fields exist and how cards are generated:

```json
{
  "1674448040667": {
    "name": "Dutch Vocabulary",
    "flds": [
      {"name": "Word", "ord": 0},
      {"name": "Translation", "ord": 1},
      {"name": "Pronunciation", "ord": 2},
      {"name": "Audio", "ord": 3},
      {"name": "Example", "ord": 4}
    ],
    "tmpls": [{
      "name": "Card 1",
      "qfmt": "{{Word}}<br>{{Audio}}",
      "afmt": "{{FrontSide}}<hr>{{Translation}}<br>{{Pronunciation}}"
    }]
  }
}
```

The `flds` array defines field order—this maps directly to the values in `notes.flds` split by the unit separator.

## Field structures for language learning decks

Language learning decks typically follow these patterns:

**Basic vocabulary structure**: Word → Translation → Audio → Example sentence

**Enhanced structure for Dutch** (and similar languages):
- **Word**: Target language term
- **Translation**: English equivalent  
- **Gender/Article**: de/het (crucial for Dutch—often color-coded)
- **IPA**: International Phonetic Alphabet pronunciation
- **Audio**: `[sound:word.mp3]` reference
- **Example sentence**: Contextual usage
- **Image**: `<img src="visual.jpg">` reference

**Media reference syntax** in field content:
```html
Audio: [sound:pronunciation.mp3]
Images: <img src="vocab_image.jpg">
Multiple audio: [sound:word.mp3][sound:sentence.mp3]
```

## Recommended libraries for implementation

### Python: Use genanki for creation, ankisync2 for reading

**For reading/parsing .apkg files** — `ankisync2`:
```bash
pip install ankisync2
```

```python
from ankisync2 import Apkg

with Apkg("dutch_vocab.apkg") as apkg:
    # Access via peewee ORM
    for note in apkg.db.Notes.filter():
        fields = note.flds.split('\x1f')
        print(f"Word: {fields[0]}, Translation: {fields[1]}")
    
    # Or raw SQL
    apkg.db.database.execute_sql("SELECT flds FROM notes LIMIT 10")
```

**For creating .apkg files** — `genanki` (2.5k GitHub stars, actively maintained):
```bash
pip install genanki
```

```python
import genanki

model = genanki.Model(
    1607392319,
    'Dutch Vocab',
    fields=[{'name': 'Word'}, {'name': 'Translation'}, {'name': 'Audio'}],
    templates=[{
        'name': 'Card 1',
        'qfmt': '{{Word}}<br>{{Audio}}',
        'afmt': '{{FrontSide}}<hr>{{Translation}}',
    }]
)

deck = genanki.Deck(2059400110, 'Dutch::Vocabulary')
note = genanki.Note(model=model, fields=['kat', 'cat', '[sound:kat.mp3]'])
deck.add_note(note)

package = genanki.Package(deck)
package.media_files = ['kat.mp3']
package.write_to_file('output.apkg')
```

### JavaScript/TypeScript: Use anki-reader for browser and Node

```bash
npm install anki-reader
```

```javascript
import { readAnkiPackage } from 'anki-reader';

const collection = await readAnkiPackage(ankiFileBuffer);
const decks = collection.getDecks();

for (const [deckId, deck] of Object.entries(decks)) {
    const cards = deck.getCards();
    cards.forEach(card => {
        const fields = card.note.fields; // Already parsed
        console.log(fields);
    });
}
```

**Alternative for Node.js**: `anki-apkg-parser` provides lower-level SQLite access.

### Key GitHub repositories

| Repository | Purpose |
|------------|---------|
| `ankitects/anki` | Official Anki source (Rust/Python) |
| `kerrickstaley/genanki` | Most popular Python creation library |
| `patarapolw/ankisync2` | Python read/write with ORM |
| `ewei068/anki-reader` | JavaScript parsing library |
| `ankidroid/Anki-Android/wiki` | Best database schema documentation |

## Security considerations for user-uploaded decks

Processing user-uploaded files requires careful security measures. These are the critical vulnerabilities to address:

### ZIP path traversal (Zip Slip) — Critical

Malicious ZIP entries can write files outside your extraction directory:

```python
import os
import zipfile

def safe_extract(zip_path, extract_dir):
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.namelist():
            # Resolve the full path
            target_path = os.path.join(extract_dir, member)
            canonical_path = os.path.realpath(target_path)
            
            # Verify it stays within extraction directory
            if not canonical_path.startswith(os.path.realpath(extract_dir) + os.sep):
                raise SecurityError(f"Path traversal detected: {member}")
        
        zf.extractall(extract_dir)
```

### SQL injection — Use parameterized queries only

Never concatenate deck content into SQL strings:

```python
# DANGEROUS - Never do this
cursor.execute(f"SELECT * FROM notes WHERE id = '{user_input}'")

# SAFE - Always use parameterized queries
cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
```

### Media file validation

A **known Anki vulnerability (CVE-2024-26020)** allows code execution through malicious media files. Validate by magic bytes, not extensions:

```python
ALLOWED_TYPES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG': 'image/png',
    b'GIF8': 'image/gif',
    b'ID3': 'audio/mp3',
    b'\xff\xfb': 'audio/mp3',
    b'OggS': 'audio/ogg',
}

def validate_media_file(file_path):
    with open(file_path, 'rb') as f:
        header = f.read(8)
    
    for magic, mime_type in ALLOWED_TYPES.items():
        if header.startswith(magic):
            return mime_type
    raise SecurityError(f"Unrecognized file type: {file_path}")
```

### File size limits

Implement these limits (aligned with AnkiWeb):
- **Maximum compressed size**: 100MB
- **Maximum uncompressed size**: 250MB  
- **Maximum single media file**: 100MB
- **Maximum file count**: 10,000 files

## Popular Dutch decks and their structure

For testing and understanding real-world deck formats:

**Free decks on AnkiWeb**:
- "Most used Dutch words with English translation + audio" — 1000+ words with native audio
- "LearnDutch.org - 1000 Most Common Words" — Basic vocabulary deck

**Typical Dutch deck fields**: Word, Translation, Gender (de/het), Audio, Example sentence, IPA pronunciation

**Dutch-specific considerations**:
- **Article system**: Dutch nouns use either "de" (common gender) or "het" (neuter)—quality decks include this with each noun, often using color coding
- **Verb conjugations**: Dedicated decks exist for the ~179 irregular Dutch verbs
- **Compound words**: Dutch heavily uses compound words that benefit from sentence context

## Implementation architecture recommendation

```
┌─────────────────────────────────────────────────────────┐
│                    Import Pipeline                       │
├─────────────────────────────────────────────────────────┤
│  1. VALIDATION LAYER                                    │
│     ├── Check file size limits                          │
│     ├── Verify ZIP magic bytes                          │
│     └── Check uncompressed size before extraction       │
├─────────────────────────────────────────────────────────┤
│  2. EXTRACTION LAYER                                    │
│     ├── Safe ZIP extraction (path traversal check)      │
│     ├── Identify database version (.anki2/.anki21)      │
│     └── Parse media JSON mapping                        │
├─────────────────────────────────────────────────────────┤
│  3. PARSING LAYER                                       │
│     ├── Open SQLite read-only                           │
│     ├── Parse col.models JSON for field definitions     │
│     ├── Query notes table with parameterized queries    │
│     └── Split flds by 0x1f, map to field names          │
├─────────────────────────────────────────────────────────┤
│  4. MEDIA PROCESSING LAYER                              │
│     ├── Validate media files by magic bytes             │
│     ├── Rename from integers to original filenames      │
│     └── Extract media references from field HTML        │
├─────────────────────────────────────────────────────────┤
│  5. TRANSFORMATION LAYER                                │
│     ├── Map Anki fields to your app's data model        │
│     ├── Sanitize HTML content                           │
│     └── Handle language-specific fields (gender, etc.)  │
└─────────────────────────────────────────────────────────┘
```

## Common pitfalls to avoid

- **Timestamp confusion**: IDs use epoch milliseconds, but `mod` fields use epoch seconds
- **Foreign keys disabled**: SQLite FK constraints are off in Anki databases—don't rely on referential integrity
- **HTML in fields**: All field content is HTML-encoded; decode properly for display and re-encode when storing
- **Multiple cards per note**: A single note can generate multiple cards via templates—decide how to handle this
- **Scheduling data**: Shared decks may accidentally include review history; consider stripping it on import
- **Encoding**: Always use UTF-8; watch for hidden Unicode characters (bidirectional markers)

## Conclusion

Building an Anki importer is **moderate complexity**—the easy parts (ZIP extraction, SQLite reading, JSON parsing) are well-supported by standard libraries, while the challenges lie in handling multiple format versions, understanding the model/template system, and implementing proper security measures.

For a language learning app, focus on **Legacy 2 format** (.anki21) which covers 90%+ of shared decks. Use `ankisync2` (Python) or `anki-reader` (JavaScript) as your foundation rather than writing parsing from scratch. Prioritize security—especially path traversal protection and parameterized queries—since you're processing user-uploaded files.

The Anki database schema is well-documented in the AnkiDroid wiki, and the format has remained stable for years, making it a reliable import target for language learning applications.