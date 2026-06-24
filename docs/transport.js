// Web Serial API ラッパー。
// Bluetooth 仮想COM(SPP)を開いて送受信する。ファーム書き込みは flash.bat(arduino-cli)を使用。

export class SerialTransport {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    /** @type {((data:Uint8Array)=>void)|null} 受信コールバック(メインボードからの戻り) */
    this.onData = null;
    /** @type {(()=>void)|null} 切断コールバック */
    this.onDisconnect = null;
  }

  get connected() {
    return !!this.port;
  }

  static get supported() {
    return "serial" in navigator;
  }

  /** ポート選択ダイアログを開いて接続。BT仮想COMはボーレート任意(SPPは実UARTでないため) */
  async connect(baudRate = 115200) {
    if (!SerialTransport.supported) {
      throw new Error(
        "このブラウザは Web Serial に非対応です。Chrome または Edge を使用してください。"
      );
    }
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate });
    this.writer = this.port.writable.getWriter();
    this._startReadLoop();
    return this.info();
  }

  info() {
    try {
      return this.port ? this.port.getInfo() : {};
    } catch {
      return {};
    }
  }

  async _startReadLoop() {
    while (this.port && this.port.readable) {
      this.reader = this.port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value && value.length && this.onData) this.onData(value);
        }
      } catch {
        // 切断などで読み取りが中断 — ループを抜ける
        break;
      } finally {
        try {
          this.reader.releaseLock();
        } catch {}
      }
    }
  }

  /** @param {Uint8Array} bytes */
  async write(bytes) {
    if (!this.writer) throw new Error("未接続です");
    await this.writer.write(bytes);
  }

  async disconnect() {
    try {
      if (this.reader) await this.reader.cancel();
    } catch {}
    try {
      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer.releaseLock();
      }
    } catch {}
    try {
      if (this.port) await this.port.close();
    } catch {}
    this.port = null;
    this.writer = null;
    this.reader = null;
    if (this.onDisconnect) this.onDisconnect();
  }
}
