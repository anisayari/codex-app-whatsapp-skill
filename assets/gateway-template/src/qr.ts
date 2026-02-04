import qrcode from "qrcode-terminal";

export function printQrToTerminal(qr: string): void {
  qrcode.generate(qr, { small: true });
}

export function qrToAscii(qr: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(qr, { small: true }, (ascii: string) => resolve(ascii));
  });
}
