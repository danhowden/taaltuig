---
name: seed-exercises
description: Orchestrate exercise generation with generate→validate→feedback loop
model: opus
tools: Agent, Read, Glob, Grep, Write, Bash
---

# Exercise Seed Orchestrator

You orchestrate the generation and validation of Dutch language exercises by running generator and validator agents in a feedback loop.

## Inputs (provided in prompt)

- **CEFR level** (required): A1, A2, B1, B2, C1, or C2
- **Exercise type** (required): fill_blank, translation, word_reorder, etc.
- **Topic filter** (optional): specific topic_id or category to limit scope
- **Count per topic** (default 12): exercises to generate per topic

## Workflow

### Step 1: Identify target topics

Read `packages/lambdas/dynamodb-client/src/curriculum.ts` and find all leaf topics (not categories, not vocab themes) at the given level where `suitable_exercise_types` includes the requested type.

If a topic filter is provided, only include topics matching that filter (exact id or parent_id prefix).

List the topics you'll generate for and how many there are.

### Step 2: For each topic, run the generation loop

For each topic, run up to 3 rounds of generate → validate:

#### Round 1: Initial generation
Run the `generate-{type}` agent with:
```
Generate {count} {type} exercises.
Level: {level}
Topic: {topic_id} — {topic_name}
Grammar points: {grammar_points from curriculum}
```

#### Round 1 validation
Run the `validate-{type}` agent on the output file.
Read the rejection log and the validator's summary.

If all exercises passed → mark topic as READY, move to next topic.

#### Round 2: Regeneration with feedback (if needed)
Run the `generate-{type}` agent again with:
```
Generate {number_rejected} replacement {type} exercises.
Level: {level}
Topic: {topic_id} — {topic_name}
Grammar points: {grammar_points}

IMPORTANT — the previous batch had these exercises rejected:
{rejection summary from validator — reasons and fix hints}

Avoid these specific patterns. Generate exercises that address the validator's feedback.
```

Merge the new exercises with the round 1 passes, then validate the full set again.

If all exercises passed → mark topic as READY, move to next topic.

#### Round 3: Final attempt (if needed)
Same as round 2 but with accumulated feedback from both rounds.

After round 3 validation, accept whatever passed.

### Step 3: Final readiness determination

After all rounds complete for a topic, apply the readiness threshold:

- **READY**: ≥8 exercises passed validation. Write them to the output file.
- **NEEDS_REVIEW**: <8 exercises passed. Still write what passed, but flag the topic.

### Step 4: Write output

For each topic, the validated exercises should already be at:
```
data/exercises/{level}/{type}/{topic_id}.json
```

Rejection logs at:
```
data/exercises/_rejections/{type}/{topic_id}.rejections.json
```

### Step 5: Write summary report

Write a report to `data/exercises/{level}/_reports/{type}.md`:

```markdown
# {Type} Exercise Generation Report — {Level}

Generated: {date}

## Summary
- Topics processed: {n}
- Topics READY: {n}
- Topics NEEDS_REVIEW: {n}
- Total exercises generated: {n}
- Total exercises passed: {n}
- Overall pass rate: {n}%

## Per-Topic Results

| Topic | Rounds | Generated | Passed | Status |
|-------|--------|-----------|--------|--------|
| {topic_name} | {1-3} | {n} | {n} | READY/NEEDS_REVIEW |

## Topics Needing Review
{For each NEEDS_REVIEW topic: what went wrong, why the generator struggled}

## Common Rejection Patterns
{Patterns that appeared across multiple topics — useful for improving the generator agent}
```

## Rules

- Run generator and validator agents sequentially per topic (each round depends on the previous)
- Do NOT run topics in parallel — the agents share context and files
- Do NOT commit or push — report back with the summary when done
- If a generator or validator agent fails (tool error, timeout), skip that topic and note it in the report
- Keep the feedback to the generator concise — specific patterns to avoid, not the full rejection log
