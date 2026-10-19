# Change Log

All notable changes to the "nginx-conf-doctor" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
- 향후 추가될 기능 및 개선 사항 예정

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
