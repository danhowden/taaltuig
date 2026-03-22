/**
 * CEFR Dutch Language Curriculum
 *
 * Static reference data defining the topic tree for A1-C2.
 * This is NOT stored in DynamoDB — it's version-controlled code.
 * User progress per topic IS stored in DynamoDB (see TopicProgress in types.ts).
 *
 * Structure:
 *   Level > Category > Topic (leaf)
 *   - Categories are for UI grouping and aggregation (e.g., "Grammar > Verbs")
 *   - Topics are the trackable units — exercises are tagged with topic_id
 *   - Parent path enables roll-up: "How's my A1 Grammar?" = avg of all A1.grammar.* topics
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { CEFRLevel } from './types'

export interface CurriculumTopic {
  /** Unique, stable identifier. Format: "a1.grammar.verbs.present_regular" */
  id: string
  /** Human-readable name */
  name: string
  /** Short description for the UI */
  description: string
  /** CEFR level this topic belongs to */
  level: CEFRLevel
  /** Parent topic id for aggregation, or null for top-level categories */
  parent_id: string | null
  /** Specific grammar points this topic covers (used in generation prompts) */
  grammar_points: string[]
  /** Example vocabulary themes (informational, not exhaustive) */
  vocabulary_themes: string[]
  /** Exercise types that make sense for this topic */
  suitable_exercise_types: ('translation' | 'fill_blank' | 'word_reorder' | 'guided_write' | 'paragraph_write')[]
  /** Ordering within parent for display */
  sort_order: number
  /** Whether this is a category node (has children) or a leaf (trackable) */
  is_category: boolean
  /** Whether this topic is trackable (grammar topics) or informational-only (vocabulary themes) */
  trackable: boolean
}

export interface CEFRLevelMeta {
  level: CEFRLevel
  name: string
  description: string
  /** Approximate vocabulary size expected at this level */
  vocab_benchmark: { min: number; max: number }
  /** Number of leaf topics at this level */
  topic_count: number
}

// ---------------------------------------------------------------------------
// Level metadata
// ---------------------------------------------------------------------------

export const CEFR_LEVELS: CEFRLevelMeta[] = [
  {
    level: 'A1',
    name: 'Beginner',
    description: 'Can understand and use familiar everyday expressions and very basic phrases.',
    vocab_benchmark: { min: 500, max: 1000 },
    topic_count: 0, // computed below
  },
  {
    level: 'A2',
    name: 'Elementary',
    description: 'Can communicate in simple, routine tasks on familiar topics.',
    vocab_benchmark: { min: 1000, max: 2000 },
    topic_count: 0,
  },
  {
    level: 'B1',
    name: 'Intermediate',
    description: 'Can deal with most situations likely to arise while travelling or at work.',
    vocab_benchmark: { min: 2500, max: 3500 },
    topic_count: 0,
  },
  {
    level: 'B2',
    name: 'Upper Intermediate',
    description: 'Can interact with a degree of fluency and spontaneity with native speakers.',
    vocab_benchmark: { min: 3500, max: 5000 },
    topic_count: 0,
  },
  {
    level: 'C1',
    name: 'Advanced',
    description: 'Can use language flexibly and effectively for social, academic, and professional purposes.',
    vocab_benchmark: { min: 5000, max: 7000 },
    topic_count: 0,
  },
  {
    level: 'C2',
    name: 'Mastery',
    description: 'Can understand with ease virtually everything heard or read.',
    vocab_benchmark: { min: 7000, max: 9000 },
    topic_count: 0,
  },
]

// ---------------------------------------------------------------------------
// Helper to define topics more concisely
// ---------------------------------------------------------------------------

interface TopicDef {
  id: string
  name: string
  description: string
  level: CEFRLevel
  parent_id: string | null
  grammar_points?: string[]
  vocabulary_themes?: string[]
  suitable_exercise_types?: CurriculumTopic['suitable_exercise_types']
  sort_order: number
  is_category?: boolean
}

function topic(def: TopicDef): CurriculumTopic {
  return {
    grammar_points: [],
    vocabulary_themes: [],
    suitable_exercise_types: ['translation', 'fill_blank', 'word_reorder'],
    is_category: false,
    trackable: true,
    ...def,
  }
}

function category(def: Omit<TopicDef, 'grammar_points' | 'vocabulary_themes' | 'suitable_exercise_types'>): CurriculumTopic {
  return {
    ...def,
    grammar_points: [],
    vocabulary_themes: [],
    suitable_exercise_types: [],
    is_category: true,
    trackable: false,
  }
}

/** Vocabulary theme — informational only, not tracked for mastery */
function vocabTheme(def: Omit<TopicDef, 'grammar_points' | 'suitable_exercise_types'>): CurriculumTopic {
  return {
    ...def,
    grammar_points: [],
    vocabulary_themes: def.vocabulary_themes || [],
    suitable_exercise_types: [],
    is_category: false,
    trackable: false,
  }
}

// ---------------------------------------------------------------------------
// A1 — Beginner
// ---------------------------------------------------------------------------

const A1_TOPICS: CurriculumTopic[] = [
  // -- Categories --
  category({ id: 'a1.grammar', name: 'Grammar', description: 'Basic Dutch grammar structures', level: 'A1', parent_id: null, sort_order: 1 }),
  category({ id: 'a1.grammar.pronouns', name: 'Pronouns', description: 'Personal and formal pronouns', level: 'A1', parent_id: 'a1.grammar', sort_order: 1 }),
  category({ id: 'a1.grammar.verbs', name: 'Verbs', description: 'Present tense and modal verbs', level: 'A1', parent_id: 'a1.grammar', sort_order: 2 }),
  category({ id: 'a1.grammar.nouns', name: 'Articles & Nouns', description: 'Articles, plurals, and diminutives', level: 'A1', parent_id: 'a1.grammar', sort_order: 3 }),
  category({ id: 'a1.grammar.sentences', name: 'Sentence Structure', description: 'Basic word order and questions', level: 'A1', parent_id: 'a1.grammar', sort_order: 4 }),
  category({ id: 'a1.vocabulary', name: 'Vocabulary Themes', description: 'Core A1 vocabulary areas', level: 'A1', parent_id: null, sort_order: 2 }),

  // -- Pronouns --
  topic({
    id: 'a1.grammar.pronouns.subject', name: 'Subject Pronouns', level: 'A1', parent_id: 'a1.grammar.pronouns', sort_order: 1,
    description: 'ik, jij/je, hij, zij/ze, het, wij/we, jullie, zij/ze — stressed vs unstressed forms',
    grammar_points: ['subject pronouns', 'stressed vs unstressed (jij/je, zij/ze, wij/we)'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a1.grammar.pronouns.formal', name: 'Formal Address (u)', level: 'A1', parent_id: 'a1.grammar.pronouns', sort_order: 2,
    description: 'Using u vs jij/je in formal situations',
    grammar_points: ['u vs jij', 'formal register basics'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),

  // -- Verbs --
  topic({
    id: 'a1.grammar.verbs.present_regular', name: 'Present Tense — Regular', level: 'A1', parent_id: 'a1.grammar.verbs', sort_order: 1,
    description: 'Regular verb conjugation: stam + -t/-en pattern',
    grammar_points: ['present tense regular conjugation', 'stam + t (jij/hij/zij)', 'stam + en (wij/jullie/zij)'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),
  topic({
    id: 'a1.grammar.verbs.present_irregular', name: 'Present Tense — zijn/hebben', level: 'A1', parent_id: 'a1.grammar.verbs', sort_order: 2,
    description: 'Conjugation of zijn (to be) and hebben (to have)',
    grammar_points: ['zijn conjugation', 'hebben conjugation'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a1.grammar.verbs.common_irregular', name: 'Common Irregular Verbs', level: 'A1', parent_id: 'a1.grammar.verbs', sort_order: 3,
    description: 'gaan, doen, komen, staan, zien — present tense',
    grammar_points: ['irregular present tense', 'gaan, doen, komen, staan, zien conjugation'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a1.grammar.verbs.modals', name: 'Modal Verbs', level: 'A1', parent_id: 'a1.grammar.verbs', sort_order: 4,
    description: 'kunnen, willen, moeten, mogen + infinitive',
    grammar_points: ['modal verb conjugation', 'modal + infinitive at end', 'kunnen/willen/moeten/mogen'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),
  topic({
    id: 'a1.grammar.verbs.v2_rule', name: 'Verb Position 2 Rule', level: 'A1', parent_id: 'a1.grammar.verbs', sort_order: 5,
    description: 'The conjugated verb always goes in position 2 in main clauses',
    grammar_points: ['V2 word order', 'verb in second position'],
    suitable_exercise_types: ['word_reorder', 'translation'],
  }),

  // -- Articles & Nouns --
  topic({
    id: 'a1.grammar.nouns.de_het', name: 'De-woorden vs Het-woorden', level: 'A1', parent_id: 'a1.grammar.nouns', sort_order: 1,
    description: 'Definite articles de (common) and het (neuter)',
    grammar_points: ['de vs het', 'common gender vs neuter'],
    suitable_exercise_types: ['fill_blank'],
  }),
  topic({
    id: 'a1.grammar.nouns.een', name: 'Indefinite Article (een)', level: 'A1', parent_id: 'a1.grammar.nouns', sort_order: 2,
    description: 'Using een and when articles are omitted',
    grammar_points: ['indefinite article een', 'article omission'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a1.grammar.nouns.plurals', name: 'Plural Formation', level: 'A1', parent_id: 'a1.grammar.nouns', sort_order: 3,
    description: 'Plurals with -en and -s, spelling changes',
    grammar_points: ['plural -en', 'plural -s', 'spelling changes in plurals'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a1.grammar.nouns.diminutives', name: 'Diminutives', level: 'A1', parent_id: 'a1.grammar.nouns', sort_order: 4,
    description: 'Diminutive suffixes (-je, -tje, -pje, -etje) — always het-woorden',
    grammar_points: ['diminutive formation', 'diminutives are het-woorden'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Adjectives --
  topic({
    id: 'a1.grammar.adjectives', name: 'Adjective Inflection', level: 'A1', parent_id: 'a1.grammar', sort_order: 5,
    description: 'When to add -e to adjectives (de/het rules)',
    grammar_points: ['adjective -e ending', 'de-woord + adj = -e', 'een + het-woord + adj = no -e'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Sentence Structure --
  topic({
    id: 'a1.grammar.sentences.svo', name: 'Basic SVO Word Order', level: 'A1', parent_id: 'a1.grammar.sentences', sort_order: 1,
    description: 'Subject-Verb-Object as the default Dutch word order',
    grammar_points: ['SVO order', 'basic declarative sentences'],
    suitable_exercise_types: ['word_reorder', 'translation'],
  }),
  topic({
    id: 'a1.grammar.sentences.questions', name: 'Questions', level: 'A1', parent_id: 'a1.grammar.sentences', sort_order: 2,
    description: 'Yes/no questions (verb-first) and question words (wie, wat, waar, wanneer, hoe, waarom)',
    grammar_points: ['yes/no inversion', 'question words', 'wie/wat/waar/wanneer/hoe/waarom'],
    suitable_exercise_types: ['word_reorder', 'translation'],
  }),
  topic({
    id: 'a1.grammar.sentences.inversion', name: 'Inversion', level: 'A1', parent_id: 'a1.grammar.sentences', sort_order: 3,
    description: 'Subject-verb inversion after fronted time/place expressions',
    grammar_points: ['inversion after adverb', 'time expression fronting'],
    suitable_exercise_types: ['word_reorder', 'translation'],
  }),

  // -- Negation --
  topic({
    id: 'a1.grammar.negation', name: 'Negation (niet/geen)', level: 'A1', parent_id: 'a1.grammar', sort_order: 6,
    description: 'Niet for general negation, geen for negating een + noun',
    grammar_points: ['niet placement', 'geen vs niet', 'geen + noun'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),

  // -- Prepositions --
  topic({
    id: 'a1.grammar.prepositions_place', name: 'Place Prepositions', level: 'A1', parent_id: 'a1.grammar', sort_order: 7,
    description: 'in, op, aan, bij, naar, uit, van',
    grammar_points: ['place prepositions', 'in/op/aan/bij/naar/uit/van'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a1.grammar.prepositions_time', name: 'Time Prepositions', level: 'A1', parent_id: 'a1.grammar', sort_order: 8,
    description: 'om, op, in, van...tot for time expressions',
    grammar_points: ['time prepositions', 'om/op/in/van...tot'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Vocabulary Themes (informational only, not tracked for mastery) --
  vocabTheme({
    id: 'a1.vocabulary.greetings', name: 'Greetings & Introductions', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 1,
    description: 'Hello, goodbye, introducing yourself',
    vocabulary_themes: ['greetings', 'introductions', 'pleasantries'],
  }),
  vocabTheme({
    id: 'a1.vocabulary.family', name: 'Family & Relationships', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 2,
    description: 'Family members, basic relationship words',
    vocabulary_themes: ['family members', 'relationships'],
  }),
  vocabTheme({
    id: 'a1.vocabulary.numbers_time', name: 'Numbers & Time', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 3,
    description: 'Cardinal numbers 0-100, telling time, days, months, seasons',
    vocabulary_themes: ['numbers', 'telling time', 'days of week', 'months', 'seasons'],
  }),
  vocabTheme({
    id: 'a1.vocabulary.food_drink', name: 'Food & Drink', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 4,
    description: 'Basic food, drink, and meal vocabulary',
    vocabulary_themes: ['food', 'drink', 'meals'],
  }),
  vocabTheme({
    id: 'a1.vocabulary.home', name: 'Home & Rooms', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 5,
    description: 'Rooms, furniture, basic household items',
    vocabulary_themes: ['rooms', 'furniture', 'household'],
  }),
  vocabTheme({
    id: 'a1.vocabulary.daily_routine', name: 'Daily Routine', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 6,
    description: 'Common daily activities and routines',
    vocabulary_themes: ['daily activities', 'routines', 'morning/evening'],
  }),
  vocabTheme({
    id: 'a1.vocabulary.weather', name: 'Weather', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 7,
    description: 'Basic weather expressions (het regent, de zon schijnt)',
    vocabulary_themes: ['weather', 'seasons'],
  }),
  vocabTheme({
    id: 'a1.vocabulary.directions', name: 'Directions', level: 'A1', parent_id: 'a1.vocabulary', sort_order: 8,
    description: 'links, rechts, rechtdoor — basic navigation',
    vocabulary_themes: ['directions', 'navigation'],
  }),
]

// ---------------------------------------------------------------------------
// A2 — Elementary
// ---------------------------------------------------------------------------

const A2_TOPICS: CurriculumTopic[] = [
  // -- Categories --
  category({ id: 'a2.grammar', name: 'Grammar', description: 'Expanding grammar for daily communication', level: 'A2', parent_id: null, sort_order: 1 }),
  category({ id: 'a2.grammar.verbs', name: 'Verbs', description: 'Past tenses, separable verbs, reflexives', level: 'A2', parent_id: 'a2.grammar', sort_order: 1 }),
  category({ id: 'a2.grammar.pronouns', name: 'Pronouns', description: 'Object, possessive, and demonstrative pronouns', level: 'A2', parent_id: 'a2.grammar', sort_order: 2 }),
  category({ id: 'a2.vocabulary', name: 'Vocabulary Themes', description: 'Expanding everyday vocabulary', level: 'A2', parent_id: null, sort_order: 2 }),

  // -- Verbs --
  topic({
    id: 'a2.grammar.verbs.perfectum_hebben', name: 'Perfectum with hebben', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 1,
    description: 'Present perfect using hebben + past participle',
    grammar_points: ['perfectum', 'hebben + voltooid deelwoord', 'ge- prefix'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),
  topic({
    id: 'a2.grammar.verbs.perfectum_zijn', name: 'Perfectum with zijn', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 2,
    description: 'Present perfect using zijn for movement/state-change verbs',
    grammar_points: ['perfectum with zijn', 'movement verbs', 'state change verbs'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.past_participle_regular', name: 'Past Participle — Regular', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 3,
    description: 'Regular past participle formation: ge- + stam + -t/-d',
    grammar_points: ['regular past participle', 'ge- + stam + -t/-d', "'t kofschip rule"],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.past_participle_irregular', name: 'Past Participle — Irregular', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 4,
    description: 'Irregular past participles: ge- + stam + -en with vowel changes',
    grammar_points: ['irregular past participle', 'vowel changes', 'strong verbs'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.imperfectum_regular', name: 'Imperfectum — Regular', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 5,
    description: 'Simple past regular: stam + -te/-de (singular), + -n (plural)',
    grammar_points: ['imperfectum regular', 'stam + -te/-de', "'t kofschip for -te vs -de"],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.imperfectum_irregular', name: 'Imperfectum — Irregular', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 6,
    description: 'Simple past of common irregular verbs: was, had, ging, kwam, etc.',
    grammar_points: ['imperfectum irregular', 'was/had/ging/kwam/deed/zag'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.separable', name: 'Separable Verbs', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 7,
    description: 'opbellen, meenemen, aankomen — prefix splits in main clause, ge- inserts in participle',
    grammar_points: ['separable verbs', 'prefix at end of clause', 'ge- between prefix and stem'],
    suitable_exercise_types: ['word_reorder', 'fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.inseparable', name: 'Inseparable Verbs', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 8,
    description: 'beginnen, vertellen, ontmoeten — no ge- in past participle',
    grammar_points: ['inseparable verbs', 'no ge- prefix (be-/ver-/ont-/her-/ge-/er-)'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.reflexive', name: 'Reflexive Verbs', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 9,
    description: 'zich wassen, zich voelen — reflexive pronouns (me, je, zich, ons)',
    grammar_points: ['reflexive verbs', 'reflexive pronouns me/je/zich/ons'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.verbs.future', name: 'Future Tense', level: 'A2', parent_id: 'a2.grammar.verbs', sort_order: 10,
    description: 'Future with gaan + infinitive and zullen + infinitive',
    grammar_points: ['gaan + infinitive', 'zullen + infinitive', 'future tense'],
    suitable_exercise_types: ['translation', 'fill_blank', 'word_reorder'],
  }),

  // -- Pronouns --
  topic({
    id: 'a2.grammar.pronouns.object', name: 'Object Pronouns', level: 'A2', parent_id: 'a2.grammar.pronouns', sort_order: 1,
    description: 'mij/me, jou/je, hem, haar, ons, jullie, hen/hun',
    grammar_points: ['object pronouns', 'direct vs indirect object'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.pronouns.possessive', name: 'Possessive Pronouns', level: 'A2', parent_id: 'a2.grammar.pronouns', sort_order: 2,
    description: 'mijn, jouw, zijn, haar, ons/onze, jullie, hun',
    grammar_points: ['possessive adjectives', 'ons vs onze'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.pronouns.demonstrative', name: 'Demonstrative Pronouns', level: 'A2', parent_id: 'a2.grammar.pronouns', sort_order: 3,
    description: 'deze/die (de-woorden), dit/dat (het-woorden)',
    grammar_points: ['deze/die', 'dit/dat', 'demonstrative with de/het'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'a2.grammar.pronouns.indefinite', name: 'Indefinite Pronouns', level: 'A2', parent_id: 'a2.grammar.pronouns', sort_order: 4,
    description: 'iets, niets, iemand, niemand, alles, veel, weinig',
    grammar_points: ['indefinite pronouns'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Conjunctions --
  topic({
    id: 'a2.grammar.conjunctions_coordinating', name: 'Coordinating Conjunctions', level: 'A2', parent_id: 'a2.grammar', sort_order: 3,
    description: 'en, maar, of, want, dus — no word order change',
    grammar_points: ['coordinating conjunctions', 'en/maar/of/want/dus', 'no inversion after coordinating'],
    suitable_exercise_types: ['fill_blank', 'word_reorder'],
  }),
  topic({
    id: 'a2.grammar.conjunctions_subordinating', name: 'Subordinating Conjunctions (intro)', level: 'A2', parent_id: 'a2.grammar', sort_order: 4,
    description: 'dat, omdat, als, wanneer — verb goes to end of subordinate clause',
    grammar_points: ['subordinating conjunctions', 'verb-final in subclauses', 'dat/omdat/als/wanneer'],
    suitable_exercise_types: ['word_reorder', 'translation'],
  }),

  // -- Adjectives --
  topic({
    id: 'a2.grammar.comparatives', name: 'Comparatives & Superlatives', level: 'A2', parent_id: 'a2.grammar', sort_order: 5,
    description: 'groter, grootst, goed/beter/best, veel/meer/meest',
    grammar_points: ['comparative -er', 'superlative -st', 'irregular comparisons'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Er --
  topic({
    id: 'a2.grammar.er_introduction', name: 'Er + zijn (there is/are)', level: 'A2', parent_id: 'a2.grammar', sort_order: 6,
    description: 'Er is/er zijn as existential constructions',
    grammar_points: ['er + zijn', 'er is/er zijn', 'placeholder subject'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),

  // -- Prepositions --
  topic({
    id: 'a2.grammar.prepositions_expanded', name: 'Expanded Prepositions', level: 'A2', parent_id: 'a2.grammar', sort_order: 7,
    description: 'met, voor, na, over, onder, tussen, achter, naast + er-combinations intro',
    grammar_points: ['expanded prepositions', 'er + preposition introduction (erover, ermee)'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Vocabulary Themes (informational only) --
  vocabTheme({
    id: 'a2.vocabulary.daily_routines', name: 'Daily Routines & Habits', level: 'A2', parent_id: 'a2.vocabulary', sort_order: 1,
    description: 'Describing daily schedule, habits, and routines in detail',
    vocabulary_themes: ['daily routines', 'habits', 'time management'],
  }),
  vocabTheme({
    id: 'a2.vocabulary.shopping', name: 'Shopping', level: 'A2', parent_id: 'a2.vocabulary', sort_order: 2,
    description: 'Prices, quantities, preferences, transactions',
    vocabulary_themes: ['shopping', 'prices', 'quantities'],
  }),
  vocabTheme({
    id: 'a2.vocabulary.travel', name: 'Travel & Transport', level: 'A2', parent_id: 'a2.vocabulary', sort_order: 3,
    description: 'Tickets, timetables, directions, public transport',
    vocabulary_themes: ['travel', 'transport', 'tickets', 'directions'],
  }),
  vocabTheme({
    id: 'a2.vocabulary.hobbies', name: 'Hobbies & Leisure', level: 'A2', parent_id: 'a2.vocabulary', sort_order: 4,
    description: 'Sports, hobbies, leisure activities',
    vocabulary_themes: ['hobbies', 'sports', 'leisure'],
  }),
  vocabTheme({
    id: 'a2.vocabulary.work', name: 'Work & Occupations', level: 'A2', parent_id: 'a2.vocabulary', sort_order: 5,
    description: 'Jobs, workplace, basic work vocabulary',
    vocabulary_themes: ['occupations', 'workplace', 'work activities'],
  }),
  vocabTheme({
    id: 'a2.vocabulary.health', name: 'Health & Body', level: 'A2', parent_id: 'a2.vocabulary', sort_order: 6,
    description: 'Basic complaints, body parts, feeling unwell',
    vocabulary_themes: ['health', 'body parts', 'illness'],
  }),
  vocabTheme({
    id: 'a2.vocabulary.food_cooking', name: 'Food & Cooking', level: 'A2', parent_id: 'a2.vocabulary', sort_order: 7,
    description: 'Recipes, restaurants, ordering, ingredients',
    vocabulary_themes: ['cooking', 'restaurants', 'ordering food', 'ingredients'],
  }),
]

// ---------------------------------------------------------------------------
// B1 — Intermediate
// ---------------------------------------------------------------------------

const B1_TOPICS: CurriculumTopic[] = [
  // -- Categories --
  category({ id: 'b1.grammar', name: 'Grammar', description: 'Complex structures for independent communication', level: 'B1', parent_id: null, sort_order: 1 }),
  category({ id: 'b1.grammar.verbs', name: 'Verbs', description: 'Past perfect, conditionals, passive voice', level: 'B1', parent_id: 'b1.grammar', sort_order: 1 }),
  category({ id: 'b1.grammar.word_order', name: 'Advanced Word Order', description: 'Complex clause structures', level: 'B1', parent_id: 'b1.grammar', sort_order: 2 }),
  category({ id: 'b1.grammar.connectors', name: 'Conjunctions & Connectors', description: 'Linking ideas and clauses', level: 'B1', parent_id: 'b1.grammar', sort_order: 3 }),
  category({ id: 'b1.grammar.er', name: 'The Word "er"', description: 'All functions of er', level: 'B1', parent_id: 'b1.grammar', sort_order: 4 }),
  category({ id: 'b1.vocabulary', name: 'Vocabulary Themes', description: 'Topics for independent communication', level: 'B1', parent_id: null, sort_order: 2 }),

  // -- Verbs --
  topic({
    id: 'b1.grammar.verbs.past_perfect', name: 'Past Perfect', level: 'B1', parent_id: 'b1.grammar.verbs', sort_order: 1,
    description: 'had/was + voltooid deelwoord (voltooid verleden tijd)',
    grammar_points: ['past perfect', 'had + past participle', 'was + past participle'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),
  topic({
    id: 'b1.grammar.verbs.conditional', name: 'Conditional', level: 'B1', parent_id: 'b1.grammar.verbs', sort_order: 2,
    description: 'zou/zouden + infinitive for hypothetical situations',
    grammar_points: ['conditional', 'zou/zouden + infinitive'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),
  topic({
    id: 'b1.grammar.verbs.passive_worden', name: 'Passive Voice (worden)', level: 'B1', parent_id: 'b1.grammar.verbs', sort_order: 3,
    description: 'Passive with worden + past participle',
    grammar_points: ['passive voice', 'worden + voltooid deelwoord', 'agent with door'],
    suitable_exercise_types: ['translation', 'word_reorder', 'fill_blank'],
  }),
  topic({
    id: 'b1.grammar.verbs.passive_zijn', name: 'Passive Voice (zijn)', level: 'B1', parent_id: 'b1.grammar.verbs', sort_order: 4,
    description: 'Result-state passive with zijn + past participle',
    grammar_points: ['zijn-passive', 'result state', 'worden vs zijn passive'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'b1.grammar.verbs.te_infinitive', name: 'Te + Infinitive', level: 'B1', parent_id: 'b1.grammar.verbs', sort_order: 5,
    description: 'proberen te, vergeten te, zitten te + infinitive',
    grammar_points: ['te + infinitive', 'om...te + infinitive', 'purpose clauses'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),
  topic({
    id: 'b1.grammar.verbs.continuous', name: 'Continuous Aspect', level: 'B1', parent_id: 'b1.grammar.verbs', sort_order: 6,
    description: 'liggen/zitten/staan/lopen + te + infinitive for ongoing actions',
    grammar_points: ['continuous with postural verbs', 'zitten te lezen', 'staan te wachten'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),

  // -- Word Order --
  topic({
    id: 'b1.grammar.word_order.verb_cluster', name: 'Verb Clusters', level: 'B1', parent_id: 'b1.grammar.word_order', sort_order: 1,
    description: 'Multiple verbs at end of subordinate clause',
    grammar_points: ['verb cluster in subclauses', 'auxiliary + main verb ordering'],
    suitable_exercise_types: ['word_reorder', 'translation'],
  }),
  topic({
    id: 'b1.grammar.word_order.tmp', name: 'Time-Manner-Place', level: 'B1', parent_id: 'b1.grammar.word_order', sort_order: 2,
    description: 'Ordering adverbials: time before manner before place',
    grammar_points: ['time-manner-place ordering', 'adverbial position'],
    suitable_exercise_types: ['word_reorder'],
  }),
  topic({
    id: 'b1.grammar.word_order.indirect_questions', name: 'Indirect Questions', level: 'B1', parent_id: 'b1.grammar.word_order', sort_order: 3,
    description: 'Indirect questions with of / question words (verb-final)',
    grammar_points: ['indirect questions', 'of + verb-final', 'embedded questions'],
    suitable_exercise_types: ['word_reorder', 'translation'],
  }),

  // -- Connectors --
  topic({
    id: 'b1.grammar.connectors.subordinating', name: 'Subordinating Conjunctions', level: 'B1', parent_id: 'b1.grammar.connectors', sort_order: 1,
    description: 'hoewel, terwijl, voordat, nadat, zodat, tenzij, sinds',
    grammar_points: ['subordinating conjunctions', 'verb-final', 'hoewel/terwijl/voordat/nadat/zodat/tenzij/sinds'],
    suitable_exercise_types: ['fill_blank', 'word_reorder', 'translation'],
  }),
  topic({
    id: 'b1.grammar.connectors.adverbial', name: 'Adverbial Connectors', level: 'B1', parent_id: 'b1.grammar.connectors', sort_order: 2,
    description: 'daarom, daardoor, bovendien, toch, echter, namelijk — cause inversion',
    grammar_points: ['adverbial connectors', 'inversion after connector', 'daarom/daardoor/bovendien/toch/echter'],
    suitable_exercise_types: ['fill_blank', 'word_reorder'],
  }),
  topic({
    id: 'b1.grammar.connectors.relative_clauses', name: 'Relative Clauses', level: 'B1', parent_id: 'b1.grammar.connectors', sort_order: 3,
    description: 'die/dat relative pronouns, relative clauses with prepositions (waarop, waarmee)',
    grammar_points: ['relative pronouns die/dat', 'relative clauses', 'waar + preposition'],
    suitable_exercise_types: ['fill_blank', 'translation', 'word_reorder'],
  }),

  // -- Er --
  topic({
    id: 'b1.grammar.er.placeholder', name: 'Er as Placeholder', level: 'B1', parent_id: 'b1.grammar.er', sort_order: 1,
    description: 'Er zijn veel mensen, er wordt gewerkt',
    grammar_points: ['er as placeholder subject', 'er + zijn', 'er in passive'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'b1.grammar.er.pronominal', name: 'Er + Preposition', level: 'B1', parent_id: 'b1.grammar.er', sort_order: 2,
    description: 'erover, ermee, eraan — replacing prepositional phrases',
    grammar_points: ['pronominal adverbs', 'er + preposition', 'erover/ermee/eraan'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'b1.grammar.er.partitive', name: 'Er as Partitive', level: 'B1', parent_id: 'b1.grammar.er', sort_order: 3,
    description: 'Ik heb er drie — er referring to a quantity',
    grammar_points: ['partitive er', 'er + number'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Vocabulary Themes (informational only) --
  vocabTheme({
    id: 'b1.vocabulary.opinions', name: 'Opinions & Feelings', level: 'B1', parent_id: 'b1.vocabulary', sort_order: 1,
    description: 'Expressing agreement, disagreement, emotions',
    vocabulary_themes: ['opinions', 'feelings', 'agreement', 'disagreement'],
  }),
  vocabTheme({
    id: 'b1.vocabulary.education', name: 'Education & Learning', level: 'B1', parent_id: 'b1.vocabulary', sort_order: 2,
    description: 'School, courses, studying, qualifications',
    vocabulary_themes: ['education', 'school', 'studying'],
  }),
  vocabTheme({
    id: 'b1.vocabulary.work_detailed', name: 'Work Environment', level: 'B1', parent_id: 'b1.vocabulary', sort_order: 3,
    description: 'Meetings, projects, colleagues, workplace communication',
    vocabulary_themes: ['workplace', 'meetings', 'projects'],
  }),
  vocabTheme({
    id: 'b1.vocabulary.health_detailed', name: 'Healthcare', level: 'B1', parent_id: 'b1.vocabulary', sort_order: 4,
    description: 'Doctor visits, symptoms, medication, appointments',
    vocabulary_themes: ['healthcare', 'doctor', 'symptoms', 'medication'],
  }),
  vocabTheme({
    id: 'b1.vocabulary.media', name: 'Media & News', level: 'B1', parent_id: 'b1.vocabulary', sort_order: 5,
    description: 'Newspapers, TV, internet, discussing news',
    vocabulary_themes: ['media', 'news', 'internet'],
  }),
  vocabTheme({
    id: 'b1.vocabulary.housing', name: 'Housing', level: 'B1', parent_id: 'b1.vocabulary', sort_order: 6,
    description: 'Renting, moving, contracts, describing a home',
    vocabulary_themes: ['housing', 'renting', 'moving'],
  }),
  vocabTheme({
    id: 'b1.vocabulary.culture', name: 'Dutch Culture & Traditions', level: 'B1', parent_id: 'b1.vocabulary', sort_order: 7,
    description: 'Sinterklaas, Koningsdag, customs, social norms',
    vocabulary_themes: ['Dutch customs', 'traditions', 'holidays'],
  }),
]

// ---------------------------------------------------------------------------
// B2 — Upper Intermediate
// ---------------------------------------------------------------------------

const B2_TOPICS: CurriculumTopic[] = [
  category({ id: 'b2.grammar', name: 'Grammar', description: 'Refinement and complex constructions', level: 'B2', parent_id: null, sort_order: 1 }),
  category({ id: 'b2.grammar.verbs', name: 'Verb Mastery', description: 'Advanced tense usage and constructions', level: 'B2', parent_id: 'b2.grammar', sort_order: 1 }),
  category({ id: 'b2.grammar.style', name: 'Style & Register', description: 'Formal vs informal, nominalizations', level: 'B2', parent_id: 'b2.grammar', sort_order: 2 }),
  category({ id: 'b2.vocabulary', name: 'Vocabulary Themes', description: 'Abstract and specialized topics', level: 'B2', parent_id: null, sort_order: 2 }),

  // -- Verbs --
  topic({
    id: 'b2.grammar.verbs.double_infinitive', name: 'Double Infinitive', level: 'B2', parent_id: 'b2.grammar.verbs', sort_order: 1,
    description: 'had willen komen, is gaan werken — modal/auxiliary + infinitive in perfect tense',
    grammar_points: ['double infinitive construction', 'had willen/kunnen/moeten + infinitive'],
    suitable_exercise_types: ['translation', 'fill_blank', 'word_reorder'],
  }),
  topic({
    id: 'b2.grammar.verbs.advanced_modals', name: 'Advanced Modal Nuances', level: 'B2', parent_id: 'b2.grammar.verbs', sort_order: 2,
    description: 'zou moeten, had kunnen, hoeft niet vs moet niet — subtle modal distinctions',
    grammar_points: ['zou moeten', 'had kunnen', 'hoeft niet vs moet niet', 'modal nuance'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),
  topic({
    id: 'b2.grammar.verbs.passive_all_tenses', name: 'Passive in All Tenses', level: 'B2', parent_id: 'b2.grammar.verbs', sort_order: 3,
    description: 'Passive voice across present, past, perfect, and future',
    grammar_points: ['passive in all tenses', 'werd/is geworden/was geworden'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),

  // -- Word Order --
  topic({
    id: 'b2.grammar.complex_sentences', name: 'Complex Multi-Clause Sentences', level: 'B2', parent_id: 'b2.grammar', sort_order: 3,
    description: 'Sentences with multiple subordinate clauses, emphasis through topicalization',
    grammar_points: ['nested subordinate clauses', 'topicalization for emphasis', 'green/red verb positions'],
    suitable_exercise_types: ['word_reorder', 'translation', 'guided_write'],
  }),

  // -- Style & Register --
  topic({
    id: 'b2.grammar.style.formal_informal', name: 'Formal vs Informal Writing', level: 'B2', parent_id: 'b2.grammar.style', sort_order: 1,
    description: 'Register differences in writing, formal letter conventions',
    grammar_points: ['formal register', 'informal register', 'letter/email conventions'],
    suitable_exercise_types: ['translation', 'guided_write'],
  }),
  topic({
    id: 'b2.grammar.style.nominalizations', name: 'Nominalizations', level: 'B2', parent_id: 'b2.grammar.style', sort_order: 2,
    description: 'het gebruik van, de ontwikkeling van — turning verbs/adjectives into nouns',
    grammar_points: ['nominalization', 'het + infinitive as noun', 'abstract nouns from verbs'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),
  topic({
    id: 'b2.grammar.style.reported_speech', name: 'Reported Speech', level: 'B2', parent_id: 'b2.grammar.style', sort_order: 3,
    description: 'hij zei dat..., indirect speech with tense shifting',
    grammar_points: ['reported speech', 'indirect speech', 'tense shifting in reported speech'],
    suitable_exercise_types: ['translation', 'word_reorder'],
  }),
  topic({
    id: 'b2.grammar.style.impersonal', name: 'Impersonal Constructions', level: 'B2', parent_id: 'b2.grammar.style', sort_order: 4,
    description: 'men, er wordt gezegd dat — impersonal and generic statements',
    grammar_points: ['men', 'impersonal er', 'er wordt gezegd dat'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),

  // -- Cohesion --
  topic({
    id: 'b2.grammar.advanced_connectors', name: 'Advanced Connectors', level: 'B2', parent_id: 'b2.grammar', sort_order: 4,
    description: 'desalniettemin, naarmate, aangezien, mits, zolang — formal linking words',
    grammar_points: ['advanced connectors', 'desalniettemin/naarmate/aangezien/mits/zolang'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),
  topic({
    id: 'b2.grammar.discourse_markers', name: 'Discourse Markers', level: 'B2', parent_id: 'b2.grammar', sort_order: 5,
    description: 'overigens, trouwens, althans, immers — conversation and text flow markers',
    grammar_points: ['discourse markers', 'overigens/trouwens/althans/immers'],
    suitable_exercise_types: ['fill_blank', 'translation'],
  }),

  // -- Vocabulary --
  // -- Vocabulary (informational only) --
  vocabTheme({
    id: 'b2.vocabulary.abstract', name: 'Abstract Concepts', level: 'B2', parent_id: 'b2.vocabulary', sort_order: 1,
    description: 'Abstract ideas, philosophical concepts, emotions in depth',
    vocabulary_themes: ['abstract concepts', 'philosophy', 'deep emotions'],
  }),
  vocabTheme({
    id: 'b2.vocabulary.politics', name: 'Politics & Current Affairs', level: 'B2', parent_id: 'b2.vocabulary', sort_order: 2,
    description: 'Government, elections, political parties, current events',
    vocabulary_themes: ['politics', 'government', 'elections', 'current affairs'],
  }),
  vocabTheme({
    id: 'b2.vocabulary.science', name: 'Science & Technology', level: 'B2', parent_id: 'b2.vocabulary', sort_order: 3,
    description: 'Scientific concepts, technology, innovation',
    vocabulary_themes: ['science', 'technology', 'innovation'],
  }),
  vocabTheme({
    id: 'b2.vocabulary.arts', name: 'Arts & Literature', level: 'B2', parent_id: 'b2.vocabulary', sort_order: 4,
    description: 'Books, film, music, art criticism and discussion',
    vocabulary_themes: ['arts', 'literature', 'film', 'music criticism'],
  }),
  vocabTheme({
    id: 'b2.vocabulary.idioms', name: 'Idiomatic Expressions', level: 'B2', parent_id: 'b2.vocabulary', sort_order: 5,
    description: 'Common Dutch idioms, fixed expressions, proverbs',
    vocabulary_themes: ['idioms', 'fixed expressions', 'proverbs'],
  }),
  vocabTheme({
    id: 'b2.vocabulary.legal', name: 'Legal & Administrative', level: 'B2', parent_id: 'b2.vocabulary', sort_order: 6,
    description: 'Contracts, insurance, rights, official documents',
    vocabulary_themes: ['legal', 'contracts', 'insurance', 'administration'],
  }),
]

// ---------------------------------------------------------------------------
// C1 — Advanced
// ---------------------------------------------------------------------------

const C1_TOPICS: CurriculumTopic[] = [
  category({ id: 'c1.grammar', name: 'Grammar', description: 'Advanced and nuanced grammar', level: 'C1', parent_id: null, sort_order: 1 }),
  category({ id: 'c1.vocabulary', name: 'Vocabulary Themes', description: 'Professional and academic vocabulary', level: 'C1', parent_id: null, sort_order: 2 }),

  topic({
    id: 'c1.grammar.subjunctive', name: 'Subjunctive Mood', level: 'C1', parent_id: 'c1.grammar', sort_order: 1,
    description: 'Formulaic subjunctive: leve de koning, het zij zo, moge het lukken',
    grammar_points: ['subjunctive mood', 'formulaic subjunctive', 'leve/moge/zij'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),
  topic({
    id: 'c1.grammar.advanced_passive', name: 'Advanced Passive & Nominalized Infinitives', level: 'C1', parent_id: 'c1.grammar', sort_order: 2,
    description: 'Complex passive chains, het lezen van boeken',
    grammar_points: ['complex passive', 'nominalized infinitives', 'het + infinitive + van'],
    suitable_exercise_types: ['translation', 'guided_write'],
  }),
  topic({
    id: 'c1.grammar.modality', name: 'Nuanced Modality', level: 'C1', parent_id: 'c1.grammar', sort_order: 3,
    description: 'schijnen, blijken, lijken — epistemic vs deontic modality',
    grammar_points: ['schijnen/blijken/lijken', 'epistemic modality', 'deontic modality'],
    suitable_exercise_types: ['translation', 'fill_blank'],
  }),
  topic({
    id: 'c1.grammar.hedging', name: 'Hedging Language', level: 'C1', parent_id: 'c1.grammar', sort_order: 4,
    description: 'wellicht, mogelijk, enigszins, in zekere zin — academic caution',
    grammar_points: ['hedging', 'academic caution language', 'wellicht/mogelijk/enigszins'],
    suitable_exercise_types: ['translation', 'fill_blank', 'guided_write'],
  }),
  topic({
    id: 'c1.grammar.text_structure', name: 'Paragraph Cohesion', level: 'C1', parent_id: 'c1.grammar', sort_order: 5,
    description: 'Paragraph-level cohesion, academic argument structure',
    grammar_points: ['paragraph cohesion', 'argument structure', 'thesis-evidence-conclusion'],
    suitable_exercise_types: ['guided_write', 'paragraph_write'],
  }),
  topic({
    id: 'c1.grammar.register_switching', name: 'Register & Style Variation', level: 'C1', parent_id: 'c1.grammar', sort_order: 6,
    description: 'Formal/academic Dutch, bureaucratic Dutch (ambtelijk Nederlands), journalistic style',
    grammar_points: ['register switching', 'ambtelijk Nederlands', 'journalistic style'],
    suitable_exercise_types: ['translation', 'guided_write', 'paragraph_write'],
  }),

  // -- Vocabulary --
  // -- Vocabulary (informational only) --
  vocabTheme({
    id: 'c1.vocabulary.academic', name: 'Academic Discourse', level: 'C1', parent_id: 'c1.vocabulary', sort_order: 1,
    description: 'Academic writing vocabulary, argumentation, citations',
    vocabulary_themes: ['academic writing', 'argumentation', 'research'],
  }),
  vocabTheme({
    id: 'c1.vocabulary.professional', name: 'Professional Communication', level: 'C1', parent_id: 'c1.vocabulary', sort_order: 2,
    description: 'Business Dutch, presentations, negotiations',
    vocabulary_themes: ['business', 'presentations', 'negotiations'],
  }),
  vocabTheme({
    id: 'c1.vocabulary.figurative', name: 'Figurative Language', level: 'C1', parent_id: 'c1.vocabulary', sort_order: 3,
    description: 'Metaphors, similes, irony, understatement',
    vocabulary_themes: ['figurative language', 'metaphors', 'irony'],
  }),
]

// ---------------------------------------------------------------------------
// C2 — Mastery
// ---------------------------------------------------------------------------

const C2_TOPICS: CurriculumTopic[] = [
  category({ id: 'c2.grammar', name: 'Grammar', description: 'Near-native mastery', level: 'C2', parent_id: null, sort_order: 1 }),
  category({ id: 'c2.vocabulary', name: 'Vocabulary Themes', description: 'Native-level vocabulary', level: 'C2', parent_id: null, sort_order: 2 }),

  topic({
    id: 'c2.grammar.literary_forms', name: 'Archaic & Literary Forms', level: 'C2', parent_id: 'c2.grammar', sort_order: 1,
    description: 'Older subjunctive, literary inversion, recognition in classic texts',
    grammar_points: ['archaic forms', 'literary Dutch', 'older subjunctive'],
    suitable_exercise_types: ['translation', 'guided_write'],
  }),
  topic({
    id: 'c2.grammar.full_register', name: 'Full Register Mastery', level: 'C2', parent_id: 'c2.grammar', sort_order: 2,
    description: 'Fluid switching between all registers, humor and irony through grammar',
    grammar_points: ['register mastery', 'stylistic variation', 'humor through grammar'],
    suitable_exercise_types: ['guided_write', 'paragraph_write'],
  }),
  topic({
    id: 'c2.grammar.complex_nominalization', name: 'Complex Nominalization', level: 'C2', parent_id: 'c2.grammar', sort_order: 3,
    description: 'Advanced nominalization patterns, legal and technical syntax',
    grammar_points: ['complex nominalization', 'legal Dutch syntax', 'technical Dutch'],
    suitable_exercise_types: ['translation', 'guided_write'],
  }),

  // -- Vocabulary (informational only) --
  vocabTheme({
    id: 'c2.vocabulary.specialized', name: 'Specialized & Technical', level: 'C2', parent_id: 'c2.vocabulary', sort_order: 1,
    description: 'Legal, academic, technical vocabulary at native level',
    vocabulary_themes: ['legal', 'academic', 'technical', 'domain-specific'],
  }),
  vocabTheme({
    id: 'c2.vocabulary.regional', name: 'Regional Variation', level: 'C2', parent_id: 'c2.vocabulary', sort_order: 2,
    description: 'Flemish vs Netherlands Dutch, regional expressions',
    vocabulary_themes: ['Flemish Dutch', 'regional expressions', 'dialectal awareness'],
  }),
  vocabTheme({
    id: 'c2.vocabulary.low_frequency', name: 'Low-Frequency Expressions', level: 'C2', parent_id: 'c2.vocabulary', sort_order: 3,
    description: 'Rare idioms, etymological awareness, literary vocabulary',
    vocabulary_themes: ['rare idioms', 'etymology', 'literary vocabulary'],
  }),
]

// ---------------------------------------------------------------------------
// Combined curriculum
// ---------------------------------------------------------------------------

export const CURRICULUM: CurriculumTopic[] = [
  ...A1_TOPICS,
  ...A2_TOPICS,
  ...B1_TOPICS,
  ...B2_TOPICS,
  ...C1_TOPICS,
  ...C2_TOPICS,
]

// Compute topic counts per level (trackable topics only — grammar, not vocab themes)
for (const levelMeta of CEFR_LEVELS) {
  levelMeta.topic_count = CURRICULUM.filter(
    (t) => t.level === levelMeta.level && t.trackable
  ).length
}

/** Mastery threshold: correct percentage needed over minimum exercises */
export const MASTERY_THRESHOLD = 0.8 // 80% correct
export const MASTERY_MIN_EXERCISES = 8 // at least 8 exercises attempted
/** Percentage of trackable topics that must be mastered to suggest level advancement */
export const LEVEL_ADVANCEMENT_THRESHOLD = 0.7 // 70% of topics mastered

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const topicIndex = new Map<string, CurriculumTopic>()
for (const t of CURRICULUM) {
  topicIndex.set(t.id, t)
}

/** Get a topic by its ID */
export function getTopic(id: string): CurriculumTopic | undefined {
  return topicIndex.get(id)
}

/** Get all trackable topics (grammar — tracked for mastery) for a CEFR level */
export function getTrackableTopics(level: CEFRLevel): CurriculumTopic[] {
  return CURRICULUM.filter((t) => t.level === level && t.trackable)
}

/** Get all leaf topics (trackable + vocab themes, non-category) for a CEFR level */
export function getLeafTopics(level: CEFRLevel): CurriculumTopic[] {
  return CURRICULUM.filter((t) => t.level === level && !t.is_category)
}

/** Get all topics (including categories) for a CEFR level */
export function getAllTopics(level: CEFRLevel): CurriculumTopic[] {
  return CURRICULUM.filter((t) => t.level === level)
}

/** Get children of a category topic */
export function getChildren(parentId: string): CurriculumTopic[] {
  return CURRICULUM.filter((t) => t.parent_id === parentId)
}

/** Get all ancestor IDs for a topic (for roll-up aggregation) */
export function getAncestorIds(topicId: string): string[] {
  const ancestors: string[] = []
  let current = topicIndex.get(topicId)
  while (current?.parent_id) {
    ancestors.push(current.parent_id)
    current = topicIndex.get(current.parent_id)
  }
  return ancestors
}

/** Get the level metadata */
export function getLevelMeta(level: CEFRLevel): CEFRLevelMeta | undefined {
  return CEFR_LEVELS.find((l) => l.level === level)
}
