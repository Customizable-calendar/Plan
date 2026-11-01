# GitHub 세팅 순서 (담당: D)

처음 한 번만 하면 돼요. 레포 관리자(admin) 권한과 `gh`(GitHub CLI) 로그인이 필요해요.

## 1. 레포 설정 한 번에 적용

```bash
bash scripts/github/apply-settings.sh
```

이 스크립트가 하는 일이에요. 다시 실행해도 같은 결과가 돼요.

- `develop` 브랜치를 `stage`로 이름 바꾸기, 기본 브랜치를 `stage`로
- 머지 방식: stage는 Squash merge, main은 merge commit. rebase merge는 끔. 머지한 브랜치는 자동 삭제
- 브랜치 규칙 적용: [.github/rulesets/](../.github/rulesets/)
  - `stage`: PR 필수, 승인 1명, Code Owners 리뷰, CI `check`·`db-types` 통과, stage 최신 위에서만 머지, force push·삭제 금지
  - `main`: PR 필수, 승인 1명, CI `check` 통과, force push·삭제 금지
- `develop`을 대상으로 하던 예전 규칙(`main·develop 보호`) 삭제
- 배포 환경 `stage` 만들기 (비밀값은 [deploy.md](deploy.md)에서 따로 넣어요)
- 라벨, 마일스톤 M0~M4 만들기

브랜치 이름을 바꾼 뒤 팀원은 각자 로컬에서 한 번 실행해요.

```bash
git fetch origin --prune
git branch -m develop stage 2>/dev/null; git branch -u origin/stage stage
git remote set-head origin -a
```

## 2. 팀원과 리뷰어 (아이디만 받으면 돼요)

1. Settings → Collaborators에서 3명을 초대해요(Write 권한).
2. [.github/team.json](../.github/team.json)에 담당별 GitHub 아이디를 채워요.
   ```json
   { "a": "아이디", "b": "아이디", "c": "아이디", "d": "아이디" }
   ```
3. 아래를 실행하면 `CODEOWNERS`의 `@member-a`~`@member-d`가 실제 아이디로 바뀌어요. 두 파일을 함께 PR로 올려요.
   ```bash
   node scripts/github/apply-owners.mjs
   ```

담당이 바뀌면 CODEOWNERS를 직접 고쳐요(스크립트는 자리표시자가 있을 때만 바꿔요).

## 3. 보드

Projects → New project → Board로 보드를 만들고 Todo · In progress · Review · Done 칸을 둬요.
각 기능 폴더 README의 "M1 할 일"을 이슈로 등록하고 담당자·라벨·마일스톤을 붙여요.

## 4. 보안 확인

- Settings → Code security에서 Secret scanning과 Push protection이 켜져 있는지 확인해요.
- 키를 실수로 커밋했다면 바로 폐기하고 새로 발급해요. 커밋을 지워도 이미 공개된 걸로 봐요.
