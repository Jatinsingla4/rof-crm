#!/bin/bash

API_URL="http://localhost:4000"

# Get JWT token
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "avigupta9453@gmail.com",
    "password": "TestUser@123"
  }' | jq -r '.token')

echo "JWT Token obtained: ${TOKEN:0:20}..."

# Get a consumer ID for testing
CONSUMER_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d rof_crm -t -c "SELECT id FROM consumers LIMIT 1")

echo "Using Consumer ID: $CONSUMER_ID"

# Generate ATS document
ATS_RESPONSE=$(curl -s -X POST "$API_URL/api/documents/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"consumerId\": $CONSUMER_ID,
    \"documentType\": \"buyer_builder_agreement\"
  }")

ATS_DOC_ID=$(echo "$ATS_RESPONSE" | jq -r '.data.documentId // empty')
echo "ATS Document ID: $ATS_DOC_ID"

# Generate Conveyance Deed document
CONV_RESPONSE=$(curl -s -X POST "$API_URL/api/documents/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"consumerId\": $CONSUMER_ID,
    \"documentType\": \"conveyance_deed\"
  }")

CONV_DOC_ID=$(echo "$CONV_RESPONSE" | jq -r '.data.documentId // empty')
echo "Conveyance Deed Document ID: $CONV_DOC_ID"

# Verify documents exist
echo ""
echo "=== Verification ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d rof_crm << 'VERIFY'
SELECT id, document_type, LENGTH(html_content) as html_size FROM documents WHERE document_type IN ('buyer_builder_agreement', 'conveyance_deed') ORDER BY created_at DESC LIMIT 2;
VERIFY

echo ""
echo "Documents ready for browser testing"
echo "ATS: http://localhost:4000/api/documents/$ATS_DOC_ID/html?token=$TOKEN"
echo "Conveyance: http://localhost:4000/api/documents/$CONV_DOC_ID/html?token=$TOKEN"
