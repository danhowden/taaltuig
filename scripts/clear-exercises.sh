#!/bin/bash
# Clear all writing exercises, card-exercise links, and writing attempts from DynamoDB.
# Usage: ./scripts/clear-exercises.sh [--dry-run]

set -euo pipefail

TABLE="taaltuig-main"
REGION="eu-central-1"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "DRY RUN — no items will be deleted"
fi

echo "Scanning for EXERCISE#, CARD_EXERCISE#, and ATTEMPT# items..."

ITEMS=$(aws dynamodb scan \
  --table-name "$TABLE" \
  --filter-expression "begins_with(SK, :ex) OR begins_with(SK, :ce) OR begins_with(SK, :at)" \
  --expression-attribute-values '{":ex":{"S":"EXERCISE#"},":ce":{"S":"CARD_EXERCISE#"},":at":{"S":"ATTEMPT#"}}' \
  --projection-expression "PK, SK" \
  --region "$REGION" \
  --output json)

COUNT=$(echo "$ITEMS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['Items']))")
echo "Found $COUNT items to delete"

if [[ "$COUNT" == "0" ]]; then
  echo "Nothing to delete"
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "$ITEMS" | python3 -c "
import json, sys, collections
data = json.load(sys.stdin)
counts = collections.Counter()
for item in data['Items']:
    sk = item['SK']['S']
    prefix = sk.split('#')[0]
    counts[prefix] += 1
for prefix, count in counts.most_common():
    print(f'  {prefix}#: {count}')
"
  exit 0
fi

echo "Deleting $COUNT items in batches of 25..."

echo "$ITEMS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data['Items']
for i in range(0, len(items), 25):
    chunk = items[i:i+25]
    requests = [{'DeleteRequest': {'Key': item}} for item in chunk]
    print(json.dumps({'$TABLE': requests}))
" | while IFS= read -r batch; do
  aws dynamodb batch-write-item --request-items "$batch" --region "$REGION" > /dev/null
done

echo "Done — deleted $COUNT items"
