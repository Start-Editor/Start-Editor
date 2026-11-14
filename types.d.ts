/**
 * types.d.ts — StartEditor 运行时全局 API 声明
 *
 * 所有跨块通信都挂在 window.__bl* 命名空间上（见 docs/代码结构说明.md）。
 * 这里只声明被多个块共享、且有明确契约的入口；单块内部实现不外露。
 */

/** DEFLATE 解码器（[B00]）：传入 base64 的 raw-deflate 数据，同步返回解压后的文本 */
type BlInflateB64 = (b64: string) => string;

/** 同步注入总线 v3（[B107]）：按优先级把代码片段送进文档 */
interface BlSync {
  /** 已注册的注入任务数 */
  readonly size: number;
  push(id: string, fn: () => void, priority?: number): void;
  run(): void;
}

/** 运行时性能总线（[B01]）：统一 rAF / 定时器 / DOM 观察 */
interface BlPerf {
  raf(fn: FrameRequestCallback): number;
  idle(fn: () => void, timeout?: number): number;
  once(selector: string, fn: (el: Element) => void): void;
}

/** 设置项的读写通道（[B74] 设置面板与各主题/布局块共用） */
interface BlSettings {
  get<T = unknown>(key: string, fallback?: T): T;
  set(key: string, value: unknown): void;
  onChange(key: string, fn: (value: unknown) => void): () => void;
}

declare global {
  interface Window {
    __blInflateB64?: BlInflateB64;
    __blSync?: BlSync;
    __blPerf?: BlPerf;
    __blRuntimePerf?: BlPerf;
    __blSettings?: BlSettings;
    __blStarAISettings?: BlSettings;
    /** 其余扩展挂载点（主题、Dock、舞台、工具箱等）统一按需扩展 */
    [key: `__bl${string}`]: any;
  }
}

export {};
