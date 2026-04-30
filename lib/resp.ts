export function respData(data: any) {
  return respJson(0, "ok", data || []);
}

export type RespMessage = string | { zh: string; en: string };

export function getReqLang(req: Request): string {
  return req.headers.get("Arcwall-Language") ?? "zh";
}

function resolveMessage(message: RespMessage, lang: string): string {
  if (typeof message === "string") return message;
  return lang === "en" ? message.en : message.zh;
}

export function createLocaleResp(req: Request) {
  const lang = getReqLang(req);
  return {
    respErr: (message: RespMessage, status: number = 200) =>
      respErr(message, status, lang),
  };
}

export function respErr(message: RespMessage, status: number = 200, lang?: string) {
  const resolved = lang ? resolveMessage(message, lang) : message;
  return respJson(-1, resolved, undefined, status);
}

export function respJson(code: number, message: RespMessage, data?: any, status: number = 200) {
  let json: any = {
    code: code,
    message: message,
  };
  if (data !== undefined) {
    json["data"] = data;
  }

  return Response.json(json, { status });
}
