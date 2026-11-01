#!/usr/bin/env bash
# 레포 관리자(admin)가 처음 한 번 실행해요. 다시 실행해도 같은 결과가 돼요.
# 실행: bash scripts/github/apply-settings.sh
set -euo pipefail

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
echo "대상 레포: $REPO"

# 1. develop을 stage로 이름 바꾸기 (열린 PR의 대상도 GitHub가 함께 바꿔요)
if gh api "repos/$REPO/branches/develop" --silent 2>/dev/null; then
  gh api -X POST "repos/$REPO/branches/develop/rename" -f new_name=stage --silent
  echo "develop → stage 이름 변경"
fi

# 2. 기본 브랜치 stage, 머지 방식은 squash(stage용)와 merge commit(main용)만
gh api -X PATCH "repos/$REPO" \
  -f default_branch=stage \
  -F allow_squash_merge=true -F allow_merge_commit=true -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true --silent
echo "기본 브랜치·머지 방식 설정"

# 3. 브랜치 규칙 (.github/rulesets/*.json). 같은 이름이 있으면 덮어써요.
for f in .github/rulesets/*.json; do
  name=$(node -p "require('./$f').name")
  id=$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name==\"$name\") | .id")
  if [ -n "$id" ]; then
    gh api -X PUT "repos/$REPO/rulesets/$id" --input "$f" --silent
  else
    gh api -X POST "repos/$REPO/rulesets" --input "$f" --silent
  fi
  echo "규칙 적용: $name"
done

# develop을 대상으로 하던 예전 규칙(예: "main·develop 보호")은 새 규칙을 건 뒤에 지워요.
for id in $(gh api "repos/$REPO/rulesets" --jq '.[].id'); do
  if gh api "repos/$REPO/rulesets/$id" --jq '.conditions.ref_name.include[]' | grep -qx 'refs/heads/develop'; then
    gh api -X DELETE "repos/$REPO/rulesets/$id" --silent
    echo "예전 규칙 삭제: $id"
  fi
done

# 4. 배포 환경 stage (비밀값은 docs/deploy.md 순서대로 따로 넣어요)
gh api -X PUT "repos/$REPO/environments/stage" --silent
echo "환경 생성: stage"

# 5. 라벨
for m in notes sessions editor cards ai-draft calendar execution feed settings shared infra; do
  gh label create "module:$m" --color 1D76DB --force -R "$REPO"
done
gh label create P0 --color B60205 --description "데모에 꼭 필요" --force -R "$REPO"
gh label create P1 --color D93F0B --description "데모 다음" --force -R "$REPO"
gh label create P2 --color FBCA04 --description "여유 있을 때" --force -R "$REPO"
gh label create contract --color 5319E7 --description "공통 타입 변경, 승인 2명" --force -R "$REPO"
gh label create blocked --color 000000 --description "다른 작업을 기다리는 중" --force -R "$REPO"
gh label create integration --color 0E8A16 --description "두 기능 이상이 걸린 작업" --force -R "$REPO"
gh label create learning --color C5DEF5 --description "공부하며 생긴 질문" --force -R "$REPO"

# 6. 마일스톤 (이미 있으면 건너뛰어요)
existing=$(gh api "repos/$REPO/milestones?state=all" --jq '.[].title')
for t in "M0 뼈대" "M1 각자 화면" "M2 데이터 연결" "M3 핵심 흐름" "M4 데모"; do
  if ! grep -qxF "$t" <<<"$existing"; then
    gh api -X POST "repos/$REPO/milestones" -f title="$t" --silent
    echo "마일스톤 생성: $t"
  fi
done

echo "끝. 팀원 초대와 CODEOWNERS 아이디는 docs/setup-github.md 3번을 보세요."
