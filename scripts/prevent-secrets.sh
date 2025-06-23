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
  "AKIA[0-9A-Z]+"                              # AWS Access Key
  "AIza[0-9A-Za-z_-]+"                         # Google API Key
  "-----BEGIN[[:space:]]+PRIVATE[[:space:]]+KEY-----"  # Private key block
  "ghp_[0-9a-zA-Z]+"                           # GitHub PAT
  "sk-[a-zA-Z0-9]+"                            # OpenAI API key
  "eyJ[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+" # JWT
  "password[[:space:]]*[:=][[:space:]]*['\"][^'\"]+['\"]?" # password = '...'
  "secret[[:space:]]*[:=][[:space:]]*['\"][^'\"]+['\"]?"   # secret = '...'
)

# Check .smyth files for secret patterns
for file in $(git diff --cached --name-only | grep '\.smyth$'); do
  if [ -f "$file" ]; then
    for pattern in "${secret_patterns[@]}"; do
      if grep -E -q "$pattern" "$file" 2>/dev/null; then
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
