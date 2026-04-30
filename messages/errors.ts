import type { RespMessage } from "@/lib/resp";

export const ERROR_MESSAGES = {
  "invalid.params": { zh: "请求参数无效", en: "Invalid parameters" },
  "invalid.params.file.missing": { zh: "缺少上传文件", en: "Missing upload file" },
  "invalid.params.paths.array": { zh: "paths 参数必须是数组", en: "paths must be an array" },
  "invalid.params.wallpaperId.required": { zh: "wallpaperId 为必填项", en: "wallpaperId is required" },
  "user.not.found": { zh: "用户不存在", en: "User not found" },
  "get.user.info.failed": { zh: "获取用户信息失败", en: "Failed to get user info" },
  "get.dictionaries.failed": { zh: "获取词典失败", en: "Failed to get dictionaries" },
  "permission.denied": { zh: "没有权限", en: "Permission denied" },
  "unpublish.failed": { zh: "取消发布失败", en: "Failed to unpublish" },
  "redeem.code.invalid": { zh: "兑换码无效", en: "Invalid redeem code" },
  "redeem.code.used": { zh: "兑换码已使用", en: "Redeem code already used" },
  "redeem.code.failed": { zh: "兑换失败", en: "Redeem failed" },
  "generate.redeem.code.failed": { zh: "生成兑换码失败", en: "Failed to generate redeem code" },
  "toggle.favorite.failed": { zh: "切换收藏状态失败", en: "Failed to toggle favorite" },
  "batch.unfavorite.failed": { zh: "批量取消收藏失败", en: "Failed to batch unfavorite" },
  "get.trash.failed": { zh: "获取回收站失败", en: "Failed to get trash" },
  "delete.failed": { zh: "删除失败", en: "Delete failed" },
  "soft.delete.from.trash.failed": { zh: "从回收站删除失败", en: "Failed to delete from trash" },
  "clear.trash.failed": { zh: "清空回收站失败", en: "Failed to clear trash" },
  "restore.failed": { zh: "恢复失败", en: "Restore failed" },
  "restore.wallpaper.failed": { zh: "恢复壁纸失败", en: "Failed to restore wallpaper" },
  "credits.not.enough": { zh: "积分不足", en: "Insufficient credits" },
  "consume.credits.failed": { zh: "扣减积分失败", en: "Failed to consume credits" },
  "fetch.transactions.failed": { zh: "获取交易记录失败", en: "Failed to fetch transactions" },
  "get.my.works.failed": { zh: "获取我的作品失败", en: "Failed to get my works" },
  "batch.delete.failed": { zh: "批量删除失败", en: "Failed to batch delete" },
  "delete.wallpaper.failed": { zh: "删除壁纸失败", en: "Failed to delete wallpaper" },
  "publish.failed": { zh: "发布失败", en: "Failed to publish" },
  "wallpaper.not.found": { zh: "壁纸不存在", en: "Wallpaper not found" },
  "path.not.available": { zh: "路径不可用", en: "Path not available" },
  "generate.wallpaper.url.failed": { zh: "生成壁纸下载地址失败", en: "Failed to generate wallpaper URL" },
  "too.many.requests": { zh: "请求过于频繁", en: "Too many requests" },
  "request.pending": { zh: "已有进行中的请求", en: "Request is pending" },
  "generate.wallpaper.failed": { zh: "生成壁纸失败", en: "Failed to generate wallpaper" },
  "upload.failed": { zh: "上传失败", en: "Upload failed" },
  "generate.signed.urls.failed": { zh: "生成签名链接失败", en: "Failed to generate signed URLs" },
  unauthorized: { zh: "未授权", en: "Unauthorized" },
  "invalid.params.wallpaper.id.required": { zh: "wallpaperId 为必填项", en: "wallpaperId is required" },
  "invalid.params.wallpaper.ids.required": { zh: "wallpaperIds 为必填项", en: "wallpaperIds is required" },
  "invalid.params.prompt.required": { zh: "prompt 为必填项", en: "prompt is required" },
  "optimize.prompt.failed": { zh: "优化提示词失败", en: "Failed to optimize prompt" }
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

export function errMsg(key: ErrorMessageKey): RespMessage {
  return ERROR_MESSAGES[key];
}
