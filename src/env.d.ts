/** vite.config.ts 의 define 으로 주입되는 앱 버전 (package.json 의 version) */
declare const __APP_VERSION__: string

/** nosleep.js 안의 무음 동영상 데이터 (화면 꺼짐 방지 대체 수단에 사용) */
declare module 'nosleep.js/src/media.js' {
  const media: { webm: string; mp4: string }
  export default media
}
