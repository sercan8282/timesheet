#!/bin/bash
FILE="C:\Users\Administrator\Downloads\Factuur EU Transport week 45_2025-75.pdf"
curl -X POST http://localhost:3000/api/invoices/import-pdf \
  -H "Authorization: Bearer test-token" \
  -F "file=@$FILE" \
  -s | jq .
