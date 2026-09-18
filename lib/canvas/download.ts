export interface DownloadLock {
  current: boolean;
}

const DOWNLOAD_FRAME_ID = "canvas-isolated-download";

/** 首次请求立即执行；同一请求结束前忽略后续点击，不依赖定时器。 */
export async function withDownloadLock<T>(
  lock: DownloadLock,
  action: () => Promise<T>
): Promise<T | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  try {
    return await action();
  } finally {
    lock.current = false;
  }
}

/** 在持久隐藏 iframe 中发起下载，避免跨域失败时导航当前页面。 */
export function startIsolatedDownload(
  url: string,
  targetDocument: Document = document
): void {
  let frame = targetDocument.getElementById(DOWNLOAD_FRAME_ID) as
    | HTMLIFrameElement
    | null;
  if (!frame) {
    frame = targetDocument.createElement("iframe");
    frame.id = DOWNLOAD_FRAME_ID;
    frame.title = "download";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "fixed",
      width: "0",
      height: "0",
      border: "0",
      visibility: "hidden",
    });
    targetDocument.body.appendChild(frame);
  }
  frame.src = url;
}
