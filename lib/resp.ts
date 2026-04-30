export function respData(data: any) {
  return respJson(0, "ok", data || []);
}

export function respOk() {
  return respJson(0, "ok");
}

export type RespMessage = string | { zh: string; en: string };

export function respErr(message: RespMessage, status: number = 200) {
  return respJson(-1, message, undefined, status);
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
