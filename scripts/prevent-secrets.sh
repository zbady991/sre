#!/bin/bash

echo "🔍 Checking for sensitive files before commit..."

# Define sensitive patterns
blocked_patterns=("vault.json" ".env" "*.pem" "*.key" "*.secret")

for file in $(git diff --cached --name-only); do
  for pattern in "${blocked_patterns[@]}"; do
    if [[ "$file" == $pattern || "$file" == *$pattern ]]; then
      echo "❌ ERROR: You’re trying to commit a sensitive file: $file"
      echo "🚫 Commit blocked to protect secrets."
      exit 1
    fi
  done
done


# Regex patterns for secrets
secret_patterns=(
  "AKIA[0-9A-Z]{16}"                       # AWS Access Key
  "AIza[0-9A-Za-z-_]{35}"                  # Google API Key
  "-----BEGIN PRIVATE KEY-----"            # Private key blocks
  "ghp_[0-9a-zA-Z]{36}"                    # GitHub personal access token
  "eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}" # JWT token pattern
  "password\s*[:=]\s*['\"].+['\"]?"        # password = '...'
  "secret\s*[:=]\s*['\"].+['\"]?"          # secret = '...'
  "sk-[a-zA-Z0-9]{48}"
)

# Check .smyth files for secret patterns
for file in $(git diff --cached --name-only | grep '\.smyth$'); do
  if [ -f "$file" ]; then
    for pattern in "${secret_patterns[@]}"; do
      if grep -E -q "$pattern" "$file"; then
        echo "❌ ERROR: Potential secret detected in file: $file"
        echo "🕵️‍♂️ Pattern matched: $pattern"
        echo "🚫 Commit blocked."
        exit 1
      fi
    done
  fi
done


echo "✅ No secrets found. Commit allowed."
exit 0
