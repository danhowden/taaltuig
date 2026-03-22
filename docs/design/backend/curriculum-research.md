# Dutch CEFR Curriculum Research

Research conducted March 2026 to validate and improve the CEFR-aligned Dutch curriculum in `curriculum.ts`.

## Sources Consulted

- [Dutch Academy - Levels Explained](https://www.dutchacademy.ca/levels) -- vocabulary benchmarks per CEFR level
- [InCompany Dutch - Dutch Language Levels CEFR](https://incompany-dutch.nl/en/dutch-language-levels/) -- level descriptors and grammar expectations
- [Milton (2009) - Vocabulary breadth across CEFR levels](https://eurosla.org/monographs/EM01/211-232Milton.pdf) -- academic research on vocabulary size
- [LearnDutch.org - 44 lessons Dutch grammar A1/A2/B1](https://www.learndutch.org/dutch-grammar-2/) -- grammar progression sequence
- [LearnDutch.org - Intermediate grammar A2/B1](https://www.learndutch.org/dutch-grammar-3/) -- intermediate grammar topics
- [The Dutch Online Academy - Dutch Grammar](https://thedutchonlineacademy.com/en/dutch-grammar) -- comprehensive grammar reference
- [NT2.nl - Woordenschattoets verantwoording](https://www.nt2.nl/documenten/woordenschattoets/uitgebreide_verantwoording_wtn_opmaak_v2.pdf) -- NT2 vocabulary benchmarks
- [Onderwijskennis - Woordenschatontwikkeling NT2](https://www.onderwijskennis.nl/kennisbank/aandacht-voor-de-woordenschatontwikkeling-van-nt2-studenten-in-het-mbo) -- vocabulary development research
- [coLanguage - Dutch Imperative](https://dutch.colanguage.com/grammar-list/gebiedende-wijs) -- imperative mood placement
- [DutchPod101 - NT2 Dutch Exam Guide](https://www.dutchpod101.com/blog/2020/11/13/dutch-exam/) -- NT2 exam requirements
- [Wikipedia - Dutch Grammar](https://en.wikipedia.org/wiki/Dutch_grammar) -- progressive aspect constructions
- [Inburgering.org - Dutch Language Levels](https://inburgering.org/exam-info/dutch-language-levels-cefr) -- inburgering exam requirements
- [Taalportaal - Dutch Causative Constructions](https://taalportaal.org/taalportaal/topic/pid/topic-14406721600173122) -- laten + infinitive

## Key Findings

### Vocabulary Benchmarks

Research from Dutch Academy, NT2 vocabulary testing, and Milton (2009) suggests:

| Level | Our Benchmark | Research Benchmark | Action |
|-------|--------------|-------------------|--------|
| A1 | 500-1000 | ~1000 lemmas | OK (keep) |
| A2 | 1000-2000 | ~2000 lemmas | OK (keep) |
| B1 | 2500-3500 | ~3500-5000 | Raise to 3500-5000 |
| B2 | 3500-5000 | ~5000-8000 | Raise to 5000-8000 |
| C1 | 5000-7000 | ~8000-15000 | Raise to 8000-15000 |
| C2 | 7000-9000 | ~15000-25000+ | Raise to 15000-25000 |

The B1-C2 benchmarks were significantly underestimated. NT2 exam I (B1) expects approximately 5000 word families. At B2 (NT2 exam II), research places receptive vocabulary at 8000+. C1 and C2 levels require substantially larger vocabularies, especially receptive knowledge, with estimates ranging from 10,000 to 25,000+ word families at the highest levels.

### Missing Grammar Topics

| Topic | Expected Level | Evidence |
|-------|---------------|----------|
| Imperative (gebiedende wijs) | A1 | Taught in all beginner Dutch courses (LearnDutch.org Lesson 30, coLanguage). Formation is simply the verb stem. |
| "Aan het" progressive | A2 | The "zijn + aan het + infinitive" construction is taught at A2 in NT2 curricula (LearnDutch.org intermediate). Simpler than the B1 postural verb progressive. |
| Om...te + infinitive (dedicated) | B1 | Currently bundled into te_infinitive topic. Deserves separate treatment as it's a distinct purpose clause construction (LearnDutch.org Lesson 32). |
| Laten + infinitive | B1 | Causative/permissive construction taught at B1 in standard curricula. "Ik laat mijn haar knippen" is a key B1 structure. |
| Perfectum introduction | A2 | While we have hebben/zijn perfectum topics, an introductory concept topic helps learners understand the overall framework before the split. |

### Exercise Type Issues

| Topic | Issue | Fix |
|-------|-------|-----|
| B2 passive_all_tenses | Missing word_reorder, error_correction | Add both -- passive tense exercises benefit from reordering and error identification |
| B2 reported_speech | Missing fill_blank, error_correction | Add both -- tense shifting in reported speech is well-suited to these formats |
| B2 advanced_modals | Missing multiple_choice, error_correction | Add both -- nuanced modal distinctions are ideal for MCQ |
| A2 future tense | Has sentence_completion but missing conjugation | Add conjugation -- learners need to practice "gaan/zullen" conjugation |

### B1 Conditional Gap

The B1 conditional topic (`b1.grammar.verbs.conditional`) only lists `conditional` and `zou/zouden + infinitive` as grammar points. It should also cover the `als...zou/zouden` conditional sentence structure, which is the primary pattern learners need to produce at B1.

## Changes Applied

1. **Vocabulary benchmarks updated** for B1 (3500-5000), B2 (5000-8000), C1 (8000-15000), C2 (15000-25000)
2. **5 new topics added**: imperative (A1), perfectum intro (A2), aan het progressive (A2), om...te construction (B1), laten + infinitive (B1)
3. **Exercise types fixed** on B2 topics (passive_all_tenses, reported_speech, advanced_modals)
4. **Grammar point added** to B1 conditional: `als...zou/zouden` structure
