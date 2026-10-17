# 보고서 내보내기 로컬 자산

WEB-023은 아래 배포 파일을 저장소에 포함해 같은 로컬 서버에서만 읽는다. 보고서 본문은 외부 서비스에 보내지 않는다. 브라우저에서 선택한 형식의 라이브러리와 글꼴을 필요할 때 로드한다. 사용 시 npm 설치·빌드·CDN 접속이 필요 없다. 각 파일의 SHA-256은 SHA256SUMS.txt에 기록한다.

| 경로 | 버전·원본 | 라이선스 |
| --- | --- | --- |
| pdfmake-0.2.20/pdfmake.min.js | [pdfmake 0.2.20 배포](https://unpkg.com/pdfmake@0.2.20/build/pdfmake.min.js), [공식 저장소](https://github.com/bpampuch/pdfmake) | 같은 폴더 LICENSE, MIT |
| docx-9.5.1/index.umd.js | [docx 9.5.1 UMD 배포](https://unpkg.com/docx@9.5.1/dist/index.umd.cjs), 확장자만 .js로 보관 | 같은 폴더 LICENSE, MIT; 번들 안 기존 의존성 고지 유지 |
| notosanskr-2.004/*.otf | [Noto CJK Sans2.004 KR 공식 태그](https://github.com/notofonts/noto-cjk/tree/Sans2.004/Sans/SubsetOTF/KR), Regular·Bold 원본 | 같은 폴더 LICENSE, SIL OFL 1.1 |
| notosans/*.ttf | [Noto Sans 공식 정적 폰트](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans), 2026-10-18 확보 Regular·Bold 원본; 자산 자체를 해시로 고정 | 같은 폴더 LICENSE, SIL OFL 1.1 |

한글 글꼴의 KR 부분집합에 없는 아래첨자 ₂ 등은 Noto Sans로 표시한다. 폰트 파일은 수정·부분집합화하지 않고 그대로 보관한다. PDF 생성기의 문서 내장 부분집합은 생성 라이브러리가 처리한다. DOCX에는 일반 굵기 글꼴을 내장하며 굵게 표시는 문서 스타일로 지정한다.

구현 참고 1차 문서:

- [pdfmake 브라우저 사용](https://pdfmake.github.io/docs/0.1/getting-started/client-side/)
- [pdfmake 사용자 글꼴·메모리 파일](https://pdfmake.github.io/docs/0.1/fonts/custom-fonts-client-side/vfs/)
- [pdfmake 생성 메서드](https://pdfmake.github.io/docs/0.1/getting-started/client-side/methods/)
- [docx 공식 문서](https://docx.js.org/)
- [docx Packer Blob 출력](https://docx.js.org/api/classes/index.Packer.html)

라이브러리를 바꿀 때는 고정 버전·라이선스·해시를 함께 갱신하고 문서의 한글·기호·표·페이지 배치를 다시 확인한다.
