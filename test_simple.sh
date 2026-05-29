#!/bin/bash

API="http://localhost:3001"

# Login and extract token
LOGIN=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"avigupta9453@gmail.com","password":"TestUser@123"}')

echo "Login response: $LOGIN"

# Get consumer ID
CID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d rof_crm -t -c "SELECT id FROM consumers LIMIT 1" | xargs)
echo "Consumer ID: $CID"

# Try to generate documents with manual curl
echo "Generating ATS..."
curl -v -X POST "$API/api/documents/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkODc2MTAwYy0yYjQ2LTQ3NzUtYjJmNy1iZTQ5ZjI3NDAyYzUiLCJlbWFpbCI6ImF2aWd1cHRhOTQ1M0BnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NDc0OTUzNzUsImV4cCI6MTc0NzU4MTc3NX0.lPNM8b6dEtpY8OwZKiU8m1L3X-UQZM0pPv-z_PmrKs0" \
  -d "{\"consumerId\": \"$CID\", \"documentType\": \"buyer_builder_agreement\"}" 2>&1 | head -50

