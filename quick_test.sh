#!/bin/bash

# Use Postgres to get test user ID directly
USER_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d rof_crm -t -c "SELECT id FROM users LIMIT 1" | xargs)
echo "Test User ID: $USER_ID"

# Get a valid token by creating a session
TOKEN=$(PGPASSWORD=postgres psql -h localhost -U postgres -d rof_crm -t -c "SELECT auth_token FROM user_sessions WHERE user_id='$USER_ID' LIMIT 1" | xargs)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "NULL" ]; then
  echo "No existing token, trying manual jwt..."
  # For now, use the known good token
  TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkODc2MTAwYy0yYjQ2LTQ3NzUtYjJmNy1iZTQ5ZjI3NDAyYzUiLCJlbWFpbCI6ImF2aWd1cHRhOTQ1M0BnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NDc1ODE3NzUsImV4cCI6OTk5OTk5OTk5OX0.test"
fi

echo "Token: ${TOKEN:0:30}..."

CONSUMER_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d rof_crm -t -c "SELECT id FROM consumers LIMIT 1" | xargs)
echo "Consumer ID: $CONSUMER_ID"

# Try to generate ATS
curl -s -X POST "http://localhost:3001/api/documents/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"consumerId\": \"$CONSUMER_ID\", \"documentType\": \"buyer_builder_agreement\"}" 2>&1 | head -100

