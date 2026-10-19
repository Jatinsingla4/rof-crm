#!/usr/bin/env bash
# Runs each API test script, keeps going after a failure, and reports every failed check by name.
# Usage: run-api-tests.sh script1.mjs script2.mjs ...
# Exit code is 1 when any script failed. In GitHub Actions each failed check becomes an error annotation
# and is listed in the job summary.
set -u
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
failed=0
echo "## API tests" >> "$summary"
for script in "$@"; do
  name=$(basename "$script")
  out=$(node "$script" 2>&1); code=$?
  result=$(printf '%s\n' "$out" | grep -E '^RESULT' | tail -1)
  fails=$(printf '%s\n' "$out" | grep -E '^FAIL' || true)
  if [ "$code" -eq 0 ]; then
    echo "OK    $name - $result"
    echo "- ✅ \`$name\` - $result" >> "$summary"
    continue
  fi
  failed=1
  echo "FAILED $name (exit $code) ${result:+- $result}"
  echo "::group::Full output of $name"; printf '%s\n' "$out"; echo "::endgroup::"
  if [ -n "$fails" ]; then
    printf '%s\n' "$fails" | while IFS= read -r line; do echo "::error title=$name::${line#FAIL }"; done
  else
    # The script stopped before reporting results (for example a crash or a server that is down)
    echo "::error title=$name::The script crashed: $(printf '%s\n' "$out" | tail -4 | tr '\n' ' ')"
  fi
  {
    echo "- ❌ \`$name\` - ${result:-crashed}"
    echo '```'
    if [ -n "$fails" ]; then printf '%s\n' "$fails"; else printf '%s\n' "$out" | tail -8; fi
    echo '```'
  } >> "$summary"
done
exit "$failed"
