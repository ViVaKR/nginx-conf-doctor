# Change Log

"Hun Nginx 설정 닥터(nginx-conf-doctor)"의 주요 변경 사항을 이 파일에 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [1.0.4] - 2026-10-20
### Changed (변경)
- 소개 페이지의 한국어 / English 링크를 절대 주소로 변경
- 버전 배지를 마켓플레이스 최신 버전에 자동 연동
- 목차 앵커를 GitHub·마켓플레이스 양쪽에서 동작하도록 수정

### Added (새로운 기능)
- README에 `extraVariables`, `referenceSeverity` 설정 안내 추가

## [1.0.1] - 2026-10-19
### Added (새로운 기능)
- 문서 포맷터 및 Enter 자동 들여쓰기 기능 추가 (탭/공백 혼재 정리, 여러 줄 문자열·Lua 본문 보호)
- include 경로 Ctrl+클릭 이동 기능
- upstream 및 `$변수` 정의로 이동, 참조 찾기, 이름 바꾸기(F2), 아웃라인(Outline) 지원
- upstream 및 변수 이름 오타 경고와 빠른 수정(Quick Fix) 제공
- "이 위치에서는 쓸 수 없는 지시어" 컨텍스트 오류 경고 기능
- 컨텍스트 인식 자동완성 및 Hover 문서 지원
- Nginx 공식 문서(nginx.org) 기준 1,011개 지시어 데이터 갱신

### Fixed (버그 수정)
- Hover 툴팁 내 마크다운 렌더링 오류 수정
- 정식 버전 안정성 확보

## [0.0.7]
### Added (새로운 기능)
- 참조 찾기(Shift+F12), 이름 바꾸기(F2)
- 마우스 호버 및 Cmd+Click, F12 로 선언으로 이동
- 오타 경고 및 빠른 수정 제안
- Cmd+Shift+O 로 server > location 아웃라인

### Fixed (버그 수정)
- 설정 파일 점검 71개 진단 테스트 오류 0건, 단위 테스트 179개 통과

## [0.0.6]
### Changed (변경)
- Nginx 전용 포맷터 들여쓰기 규칙 개선

### Fixed (버그 수정)
- 단위 테스트 153개 통과

## [0.0.5]
### Added (새로운 기능)
- Nginx 전용 문서 포맷터(Document Formatting Provider)
- README에 포맷터 권장 설정(`[nginx]`)과 파일 연결(`files.associations`) 안내

## [0.0.3]
### Fixed (버그 수정)
- 마우스 호버 도움말 안내문 버그 수정

### Changed (변경)
- 배포 키워드 목록 보강

## [0.0.2]
### Changed (변경)
- 독자 아이콘 제작(중괄호와 심전도 선), 표시 이름 확정, 한/영 병기 설명
- 마켓플레이스 소개 페이지 개편(버튼, 배지, 목차, 진단 예시)
- 배포 규격 정비(갤러리 배너, 신뢰하지 않는 작업 공간/가상 작업 공간 지원)

## [0.0.1]
### Added (새로운 기능)
- 최초 릴리스: 구문 강조, 구조/컨텍스트/알 수 없는 지시어 진단, 빠른 수정, 자동완성, Hover 문서
