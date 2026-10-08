/**
 * 공백 주제의 키.
 *
 * 모델이 붙인 주제 이름은 같은 것이라도 띄어쓰기와 꾸밈말이 다르게 나온다
 * ("고유가 피해지원금", "고유가피해 지원금"). 공백과 기호를 걷어 낸 것을
 * 문서 id로 써서 한 곳에 모은다. 그 이상 묶는 것(동의어)은 운영자가 화면에서 한다.
 */
export function topicKey(topic: string): string {
  const key = topic
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 60);
  return key || "untitled";
}
