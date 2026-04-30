#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${HOME}"
OLD_EMAIL="${OLD_EMAIL:-}"
NEW_NAME="${NEW_NAME:-}"
NEW_EMAIL="${NEW_EMAIL:-}"
OWNER="${GITHUB_OWNER:-}"
EXECUTE=0
PUSH=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/rewrite-git-email.sh --old-email OLD --new-name NAME --new-email EMAIL [options]

Options:
  --root DIR        Root directory to scan. Default: $HOME
  --owner OWNER     Only process repos whose origin belongs to this GitHub owner
  --execute         Rewrite matching repo history with git filter-branch
  --push            After rewrite, run git push --force --all and --force --tags
  -h, --help        Show this help

Environment variables are also supported:
  OLD_EMAIL, NEW_NAME, NEW_EMAIL, GITHUB_OWNER

Dry-run example:
  scripts/rewrite-git-email.sh --root "$HOME" --owner qingbingwei \
    --old-email wrong@example.com --new-name qingbingwei --new-email correct@example.com

Rewrite only:
  scripts/rewrite-git-email.sh --root "$HOME" --owner qingbingwei \
    --old-email wrong@example.com --new-name qingbingwei --new-email correct@example.com --execute

Rewrite and force-push:
  scripts/rewrite-git-email.sh --root "$HOME" --owner qingbingwei \
    --old-email wrong@example.com --new-name qingbingwei --new-email correct@example.com --execute --push
USAGE
}

die() {
  printf '[rewrite-email] error: %s\n' "$*" >&2
  exit 1
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --root)
        ROOT_DIR="${2:-}"
        shift 2
        ;;
      --owner)
        OWNER="${2:-}"
        shift 2
        ;;
      --old-email)
        OLD_EMAIL="${2:-}"
        shift 2
        ;;
      --new-name)
        NEW_NAME="${2:-}"
        shift 2
        ;;
      --new-email)
        NEW_EMAIL="${2:-}"
        shift 2
        ;;
      --execute)
        EXECUTE=1
        shift
        ;;
      --push)
        PUSH=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1"
        ;;
    esac
  done
}

validate_args() {
  [[ -d "$ROOT_DIR" ]] || die "root directory does not exist: $ROOT_DIR"
  [[ -n "$OLD_EMAIL" ]] || die "--old-email is required"
  [[ -n "$NEW_NAME" ]] || die "--new-name is required"
  [[ -n "$NEW_EMAIL" ]] || die "--new-email is required"
  [[ "$OLD_EMAIL" != "$NEW_EMAIL" ]] || die "old and new email are identical"
  if [[ "$PUSH" -eq 1 && "$EXECUTE" -ne 1 ]]; then
    die "--push requires --execute"
  fi
}

discover_git_markers() {
  find "$ROOT_DIR" \
    \( -name node_modules -o -name .venv -o -name Library -o -path "$ROOT_DIR/go/pkg/mod" \) -prune \
    -o -name .git -print
}

repo_from_marker() {
  dirname "$1"
}

origin_url() {
  git -C "$1" remote get-url origin 2>/dev/null || true
}

owner_matches() {
  local url="$1"
  [[ -z "$OWNER" ]] && return 0
  case "$url" in
    *"github.com:${OWNER}/"*|*"github.com/${OWNER}/"*) return 0 ;;
    *) return 1 ;;
  esac
}

matching_commit_count() {
  git -C "$1" log --all --format='%H%x09%ae%x09%ce' |
    awk -F '\t' -v old="$OLD_EMAIL" '($2 == old || $3 == old) && !seen[$1]++ { count++ } END { print count + 0 }'
}

require_clean_repo() {
  local status
  status="$(git -C "$1" status --porcelain)"
  [[ -z "$status" ]] || die "dirty worktree, commit or stash first: $1"
}

rewrite_repo() {
  OLD_EMAIL="$OLD_EMAIL" NEW_NAME="$NEW_NAME" NEW_EMAIL="$NEW_EMAIL" \
    git -C "$1" filter-branch --force --env-filter '
if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]; then
  export GIT_COMMITTER_NAME="$NEW_NAME"
  export GIT_COMMITTER_EMAIL="$NEW_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]; then
  export GIT_AUTHOR_NAME="$NEW_NAME"
  export GIT_AUTHOR_EMAIL="$NEW_EMAIL"
fi
' --tag-name-filter cat -- --branches --tags
}

verify_rewrite() {
  local remaining
  remaining="$(matching_commit_count "$1")"
  [[ "$remaining" = "0" ]] || die "rewrite left $remaining matching commits in: $1"
}

force_push_repo() {
  git -C "$1" push --force --all
  git -C "$1" push --force --tags
}

process_repo() {
  local repo="$1"
  local url count
  git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  url="$(origin_url "$repo")"
  owner_matches "$url" || return 0
  count="$(matching_commit_count "$repo")"
  [[ "$count" != "0" ]] || return 0
  printf '[rewrite-email] match commits=%s repo=%s origin=%s\n' "$count" "$repo" "${url:-none}"
  if [[ "$EXECUTE" -ne 1 ]]; then
    return 0
  fi
  require_clean_repo "$repo"
  rewrite_repo "$repo"
  verify_rewrite "$repo"
  if [[ "$PUSH" -eq 1 ]]; then
    force_push_repo "$repo"
  fi
}

main() {
  parse_args "$@"
  validate_args
  printf '[rewrite-email] mode=%s root=%s owner=%s old=%s new=%s <%s>\n' \
    "$([[ "$EXECUTE" -eq 1 ]] && printf execute || printf dry-run)" \
    "$ROOT_DIR" "${OWNER:-any}" "$OLD_EMAIL" "$NEW_NAME" "$NEW_EMAIL"
  while IFS= read -r marker; do
    process_repo "$(repo_from_marker "$marker")"
  done < <(discover_git_markers)
  if [[ "$EXECUTE" -ne 1 ]]; then
    printf '[rewrite-email] dry-run complete; add --execute to rewrite, add --push to force-push.\n'
  fi
}

main "$@"
