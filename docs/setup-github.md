# GitHub 세팅 순서 (담당: D)

처음 한 번만 하면 돼요. `gh`(GitHub CLI)가 있으면 명령어로, 없으면 웹 화면으로 해요.

## 1. 레포 만들고 뼈대 올리기

```bash
# 받은 zip을 풀고, 6개 커밋을 만드는 스크립트를 실행해요
unzip noteapp.zip && cd noteapp
bash ../make-commits.sh

# 공개 레포를 만들고 main, develop을 올려요 (README·.gitignore·라이선스는 추가하지 않은 빈 레포)
gh repo create noteapp --public --source . --remote origin
git push -u origin main develop
```

`gh`가 없으면 GitHub 웹에서 빈 공개 레포 `noteapp`을 만든 뒤 `git remote add origin <레포 주소>`를 하고 같은 push를 해요.

## 2. 기본 브랜치와 보호 규칙

1. Settings → General → Default branch를 `develop`으로 바꿔요. PR이 자동으로 develop을 향해요.
2. Settings → Rules → Rulesets에서 `main`, `develop`에 규칙을 만들어요.
   - Require a pull request before merging, 승인 1명
   - Require review from Code Owners
   - Require status checks to pass: `check` (CI가 한 번 돈 뒤에 목록에 나타나요)
   - Block force pushes
3. Settings → General → Pull Requests에서 Squash merge만 켜요.

## 3. 팀원과 리뷰어

1. Settings → Collaborators에서 3명을 초대해요.
2. `.github/CODEOWNERS`의 `@member-a`~`@member-d`를 실제 GitHub 아이디로 바꿔서 PR로 올려요.

## 4. 라벨

```bash
for m in notes sessions editor cards ai-draft calendar execution feed settings shared infra; do
  gh label create "module:$m" --color 1D76DB --force
done
gh label create P0 --color B60205 --description "데모에 꼭 필요" --force
gh label create P1 --color D93F0B --description "데모 다음" --force
gh label create P2 --color FBCA04 --description "여유 있을 때" --force
gh label create contract --color 5319E7 --description "공통 타입 변경, 승인 2명" --force
gh label create blocked --color 000000 --description "다른 작업을 기다리는 중" --force
gh label create integration --color 0E8A16 --description "두 기능 이상이 걸린 작업" --force
gh label create learning --color C5DEF5 --description "공부하며 생긴 질문" --force
```

## 5. 마일스톤과 보드

1. Issues → Milestones에서 `M0 뼈대` ~ `M4 데모` 5개를 만들어요. 내용은 [roadmap.md](roadmap.md)에 있어요.
2. Projects → New project → Board로 보드를 만들고 Todo · In progress · Review · Done 칸을 둬요.
3. 각 기능 폴더 README의 "M1 할 일"을 이슈로 등록하고 담당자·라벨·마일스톤을 붙여요.

## 6. 보안 확인

- Settings → Code security에서 Secret scanning과 Push protection이 켜져 있는지 확인해요.
- 키를 실수로 커밋했다면 바로 폐기하고 새로 발급해요. 커밋을 지워도 이미 공개된 걸로 봐요.
