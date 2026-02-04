declare module "qrcode-terminal" {
  export interface GenerateOptions {
    small?: boolean;
  }

  export interface QrCodeTerminal {
    generate: (
      input: string,
      options?: GenerateOptions,
      callback?: (qrcode: string) => void
    ) => void;
  }

  const qrcode: QrCodeTerminal;
  export default qrcode;
}
