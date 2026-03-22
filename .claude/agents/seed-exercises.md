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
- **Topic filter** (optional): specific topic_id or category to limit scope
- **Count per topic** (default 12): total exercises to generate per topic, split across suitable types

## Workflow

### Step 1: Identify target topics

Read `packages/lambdas/dynamodb-client/src/curriculum.ts` and find all leaf topics (not categories, not vocab themes) at the given level that have at least one entry in `suitable_exercise_types`.

If a topic filter is provided, only include topics matching that filter (exact id or parent_id prefix).

List the topics you'll generate for and how many there are.

### Step 2: Plan type splits per topic

For each topic, read its `suitable_exercise_types` array and divide the count across types:
- If count=12 and 4 types: 3 each
- If count=12 and 3 types: 4 each
- Distribute remainder to the first types (e.g., count=12, 5 types → 3, 3, 2, 2, 2)

**Only generate types that have a generator agent available.** Check which `generate-{type}` agents exist under `.claude/agents/`. Skip types without a generator and redistribute their count to types that do have one.

Report the planned split before generating.

### Step 3: For each topic, for each type, run the generation loop

For each (topic, type) pair, run up to 3 rounds of generate → validate:

#### Round 1: Initial generation
Run the `generate-{type}` agent with:
```
Generate {count_for_this_type} {type} exercises.
Level: {level}
Topic: {topic_id} — {topic_name}
Grammar points: {grammar_points from curriculum}
```

#### Round 1 validation
Run the `validate-{type}` agent on the output file.
Read the rejection log and the validator's summary.

If all exercises passed → mark (topic, type) as DONE, move on.

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

#### Round 3: Final attempt (if needed)
Same as round 2 but with accumulated feedback from both rounds.

After round 3, accept whatever passed.

### Step 4: Merge and write output

For each topic, merge all exercises across types into a single file:
```
data/exercises/{level}/mixed/{topic_id}.json
```

If a topic only has one type generated (e.g., only fill_blank), also write to:
```
data/exercises/{level}/{type}/{topic_id}.json
```

Rejection logs at:
```
data/exercises/_rejections/{type}/{topic_id}.rejections.json
```

### Step 5: Final readiness determination

Per topic (across all types combined):
- **READY**: ≥8 exercises passed validation total
- **NEEDS_REVIEW**: <8 exercises passed total

### Step 6: Write summary report

Write a report to `data/exercises/{level}/_reports/generation.md`:

```markdown
# Exercise Generation Report — {Level}

Generated: {date}

## Summary
- Topics processed: {n}
- Topics READY: {n}
- Topics NEEDS_REVIEW: {n}
- Total exercises generated: {n}
- Total exercises passed: {n}
- Overall pass rate: {n}%

## Per-Topic Results

| Topic | Types Generated | Generated | Passed | Status |
|-------|----------------|-----------|--------|--------|
| {topic_name} | fill_blank(3), translation(3) | {n} | {n} | READY/NEEDS_REVIEW |

## Types Skipped (no generator agent)
{List of exercise types that were in suitable_exercise_types but had no generator agent}

## Topics Needing Review
{For each NEEDS_REVIEW topic: what went wrong, why the generator struggled}

## Common Rejection Patterns
{Patterns that appeared across multiple topics — useful for improving generator agents}
```

## Rules

- Run generator and validator agents sequentially per topic per type (each round depends on the previous)
- Do NOT run topics in parallel — the agents share context and files
- Do NOT commit or push — report back with the summary when done
- If a generator or validator agent fails (tool error, timeout), skip that (topic, type) pair and note it in the report
- Keep the feedback to the generator concise — specific patterns to avoid, not the full rejection log
