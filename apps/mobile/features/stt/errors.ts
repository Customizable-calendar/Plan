/** 화면에 그대로 보여 줘도 되는 받아쓰기 오류예요. */
export class SttError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SttError';
  }
}
