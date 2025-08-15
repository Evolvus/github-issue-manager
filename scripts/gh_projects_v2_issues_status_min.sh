#!/usr/bin/env bash
# gh_projects_v2_issues_status_min.sh
# Table (default) or JSON of GitHub ProjectsV2 issues + board "Status".
# Usage:
#   ./gh_projects_v2_issues_status_min.sh --org ORG --token TOKEN [--format table|json]
#   # Or target a single project directly:
#   ./gh_projects_v2_issues_status_min.sh --project-id PVT_xxx --token TOKEN [--format table|json]

set -euo pipefail

ORG=""
PROJECT_ID=""
TOKEN=""
FORMAT="table"
GQL="https://api.github.com/graphql"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --org) ORG="$2"; shift 2 ;;
    --project-id) PROJECT_ID="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    -h|--help)
      cat <<'HLP'
Usage:
  gh_projects_v2_issues_status_min.sh --org ORG --token TOKEN [--format table|json]
  gh_projects_v2_issues_status_min.sh --project-id PVT_ID --token TOKEN [--format table|json]
Notes:
- Reads the single-select field named "Status" (case-insensitive).
- Paginates beyond 100 items.
- No ${var@Q} expansions; safe on macOS Bash 3.2.
HLP
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -z "$TOKEN" ]] && { echo "Missing --token"; exit 1; }
if [[ -z "$ORG" && -z "$PROJECT_ID" ]]; then
  echo "Provide either --org OR --project-id"; exit 1
fi

AUTH="Authorization: bearer ${TOKEN}"
CT="Content-Type: application/json"

Q_ORG='query($org:String!, $after:String){
  organization(login:$org){
    projectsV2(first:100, after:$after){
      nodes{ id number title url }
      pageInfo{ hasNextPage endCursor }
    }
  }
}'

Q_ITEMS='query($pid:ID!, $after:String){
  node(id:$pid){
    ... on ProjectV2{
      number
      title
      url
      items(first:100, after:$after){
        nodes{
          content{
            __typename
            ... on Issue{
              id number title url state
              repository{ nameWithOwner }
            }
          }
          fieldValues(first:50){
            nodes{
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue{
                name
                field{
                  __typename
                  ... on ProjectV2SingleSelectField{ name }
                }
              }
            }
          }
        }
        pageInfo{ hasNextPage endCursor }
      }
    }
  }
}'

post_gql () {
  local query="$1"; shift
  local vars_json="$1"; shift
  jq -nc --arg q "$query" --argjson v "$vars_json" '{query:$q, variables:$v}' \
  | curl -sS -X POST "$GQL" -H "$AUTH" -H "$CT" --data @-
}

projects_json='[]'
if [[ -n "$PROJECT_ID" ]]; then
  projects_json="$(jq -nc --arg id "$PROJECT_ID" '[{id:$id, number:null, title:null, url:null}]')"
else
  after=""
  while :; do
    vars="$(jq -nc --arg org "$ORG" --arg after "$after" '{org:$org, after: (if $after=="" then null else $after end)}')"
    resp="$(post_gql "$Q_ORG" "$vars")"
    if jq -e '.errors' >/dev/null 2>&1 <<<"$resp"; then
      echo "GraphQL error (projects):" >&2
      echo "$resp" | jq '.errors' >&2
      exit 1
    fi
    batch="$(jq '.data.organization.projectsV2.nodes // []' <<<"$resp")"
    projects_json="$(jq -c --argjson A "$projects_json" --argjson B "$batch" '$A + $B' <<< 'null')"
    hasNext="$(jq -r '.data.organization.projectsV2.pageInfo.hasNextPage // false' <<<"$resp")"
    if [[ "$hasNext" == "true" ]]; then
      after="$(jq -r '.data.organization.projectsV2.pageInfo.endCursor' <<<"$resp")"
    else
      break
    fi
  done
fi

if [[ "$(jq 'length' <<<"$projects_json")" -eq 0 ]]; then
  if [[ "$FORMAT" == "json" ]]; then
    jq -nc --arg org "${ORG:-""}" '{organization:$org, projects:[]}' | jq .
  else
    echo "No ProjectsV2 found for organization: ${ORG:-<not-used>}"
  fi
  exit 0
fi

final="$(jq -nc --arg org "${ORG:-""}" '{organization:$org, projects:[] }')"

plen="$(jq 'length' <<<"$projects_json")"
for ((i=0; i<plen; i++)); do
  proj="$(jq -c ".[${i}]" <<<"$projects_json")"
  pid="$(jq -r '.id' <<<"$proj")"

  items_after=""
  issues_accum='[]'
  header='{}'

  while :; do
    vars="$(jq -nc --arg pid "$pid" --arg after "$items_after" '{pid:$pid, after: (if $after=="" then null else $after end)}')"
    iresp="$(post_gql "$Q_ITEMS" "$vars")"
    if jq -e '.errors' >/dev/null 2>&1 <<<"$iresp"; then
      echo "GraphQL error (items for $pid):" >&2
      echo "$iresp" | jq '.errors' >&2
      exit 1
    fi

    if [[ "$(jq -r '.data.node.number' <<<"$iresp")" != "null" ]]; then
      header="$(jq '{
        number: .data.node.number,
        title:  .data.node.title,
        url:    .data.node.url
      }' <<<"$iresp")"
    fi

    merged="$(jq -c '
      (.data.node.items.nodes // []) | [
        .[] |
        {
          content: (.content // null),
          status: (
            (.fieldValues.nodes // [])
            | map(select(.__typename=="ProjectV2ItemFieldSingleSelectValue"))
            | map({fname: (((.field.name // "") | tostring) | ascii_downcase), vname: (.name // null)})
            | ( map(select(.fname=="status")) | (.[0].vname // null) )
          )
        }
        | select(.content != null and .content.__typename=="Issue")
        | {
            id: .content.id,
            number: .content.number,
            title: (.content.title // ""),
            url:   (.content.url // ""),
            state: (.content.state // ""),
            repository: (.content.repository.nameWithOwner // ""),
            project_status: .status
          }
      ]' <<<"$iresp")"

    issues_accum="$(jq -c --argjson A "$issues_accum" --argjson B "$merged" '$A + $B' <<< 'null')"

    more="$(jq -r '.data.node.items.pageInfo.hasNextPage // false' <<<"$iresp")"
    if [[ "$more" == "true" ]]; then
      items_after="$(jq -r '.data.node.items.pageInfo.endCursor' <<<"$iresp")"
    else
      break
    fi
  done

  proj_out="$(jq -c --argjson hdr "$header" --argjson issues "$issues_accum" '
    . + { number:$hdr.number, title:$hdr.title, url:$hdr.url, issues:$issues }' <<<"$proj")"
  final="$(jq -c --argjson p "$proj_out" '.projects += [ $p ]' <<<"$final")"

done

if [[ "$FORMAT" == "json" ]]; then
  echo "$final" | jq .
  exit 0
fi

{
  printf "Project#\tProject Title\tRepository\tIssue#\tIssue State\tBoard Status\tIssue Title\tIssue URL\n"
  jq -r '
    def safe(x): if x==null then "" else x end;
    .projects[]
    | .number as $pnum
    | .title  as $ptitle
    | (.issues // [])[]
    | [
        ($pnum|tostring),
        $ptitle,
        .repository,
        (.number|tostring),
        .state,
        safe(.project_status),
        .title,
        .url
      ] | @tsv
  ' <<<"$final"
} | column -t -s $'\t'
