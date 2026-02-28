# Taaltuig - AI-Powered Language Learning Platform
## Project Definition

**Project Name:** Taaltuig (Dutch: "taal" = language + "tuig" = gear/toolkit)  
**Tagline:** Your toolkit for real Dutch

## Vision Statement
An open-source language learning platform that teaches practical language skills through real-world context, spaced repetition, and writing practice - moving beyond gamified flashcards to help learners actually use the language in conversation and writing.

By leveraging AI to reduce the traditional burden of human tutoring and content creation, we aim to democratize access to high-quality language education while simultaneously building datasets and feedback loops that improve AI language teaching capabilities.

## Core Problem
Traditional language learning apps focus on gamification and decontextualized vocabulary drilling. Learners can recognize words but struggle to use them naturally in real conversations or writing. There's a gap between "knowing" vocabulary and actually being able to write and speak authentically. Additionally, understanding *why* language works the way it does - the patterns and rules - is often missing.

**Access barriers**: Quality language education typically requires expensive tutors or courses, limiting who can learn effectively. AI can reduce this barrier while generating valuable data to improve language learning models.

## Solution Approach
A learning platform that combines:
- **Real-world input**: Learners capture and learn phrases they encounter in real life
- **AI-powered explanations**: Understand how phrases are constructed, grammar patterns, and usage nuances (e.g., "how a B2 speaker would say this")
- **Pinnable insights**: AI suggests or user saves key learnings (e.g., "how to use 'toch' in Dutch") as separate learnable items
- **Contextual learning**: Content organized around practical contexts (travel, family, shopping, etc.)
- **Writing-focused practice**: Both structured exercises and free-form writing with AI feedback
- **Proven spaced repetition**: Anki-style SRS algorithm (SM-2 or FSRS) for intelligent review scheduling
- **Natural progression**: From learning phrases to understanding their structure to using them independently
- **Meaningful progress tracking**: Celebrate real achievements (words learned, hours practiced, consistency) without artificial game mechanics

## Initial Scope
- **Language pair**: English ↔ Dutch
- **Target users**: Self-motivated adults who want practical language ability
- **Core learning modes**:
  1. Phrase collection & learning (user inputs real-world phrases)
  2. AI-generated explanations (grammar, construction, usage, progression to native-like speech)
  3. Insight pinning (AI-suggested or user-created patterns/rules as learnable items)
  4. Spaced repetition review (Anki-inspired algorithm for phrases AND insights)
  5. Structured exercises (fill-in-the-blank, etc.)
  6. Long-form writing assessments (AI-evaluated by default, human-evaluated optionally)

## Key Principles
- **Understanding over memorization**: Learn the "why" behind language patterns
- **Authenticity over gamification**: Focus on real language use, not points/streaks/levels
- **Intrinsic motivation**: Track meaningful metrics (vocabulary size, practice time, consistency) that reflect real progress
- **User control**: Learners drive their own path and content
- **Context-driven**: Weekly or ongoing contextual themes (travel, family, etc.) that customize without changing core curriculum
- **Progressive difficulty**: Start with understanding phrases, move toward producing natural Dutch
- **Approachable aesthetics**: Clean, fun, modern design that feels encouraging without being childish or game-like
- **Proven methodology**: Build on established SRS research rather than reinventing the wheel
- **Democratized access**: Use AI to make quality language education accessible to everyone, regardless of budget
- **Virtuous cycle**: User interactions and corrections improve the AI, which improves the learning experience for future learners

## Content Types in SRS System
1. **Phrases**: Real-world utterances to learn and recall
2. **Insights**: Grammar patterns, usage rules, construction principles (e.g., "when to use 'toch'")
3. **Structured exercises**: Fill-in-the-blank, sentence construction
4. **Writing prompts**: Longer-form production practice

## Technical Inspirations
- **Anki**: Spaced repetition algorithm (SM-2/FSRS), card scheduling, user-created content model
- **(To be determined)**: AI evaluation, writing assessment, phrase parsing, explanation generation

## What This Is NOT
- Not a gamified app with XP, levels, leaderboards, or cartoon mascots
- Not purely passive recognition - active production is central
- Not a rigid, one-size-fits-all curriculum - adaptable to user needs and interests
- Not punitive - no streak anxiety or guilt-inducing notifications
- Not just rote memorization - understanding is central

## Technical Decisions Made
- **SRS Algorithm**: SM-2 for MVP (proven, simpler), FSRS consideration for v2
- **Authentication**: Google OAuth2 for simplicity and security
- **Database**: DynamoDB (single-table design, cost-optimized at ~$1-3/month)
- **Bidirectional learning**: Independent scheduling per direction (recognition ≠ production)

## Deferred Design Decisions
- How insights are reviewed differently from phrases (to avoid overwhelm)
- Specific AI models and evaluation criteria (Phase 4+)
- Human-in-the-loop review mechanisms (v2 feature - architecture designed to support but not block MVP)

## Human Oversight Strategy (v2)
While the MVP will be AI-powered, the system will be architected to support human review without requiring major refactoring:
- **AI quality validation**: Extensive testing with native Dutch speakers pre-launch
- **User feedback mechanisms**: Flagging/reporting incorrect content from day one
- **Future human review options**: Writing assessment review, phrase verification, explanation validation
- **Potential models**: Paid premium feature, community curation, or professional tutor integration
- **Philosophy**: Be transparent about AI limitations; design for human augmentation from the start
