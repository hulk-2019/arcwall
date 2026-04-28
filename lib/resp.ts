export function respData(data: any) {
  return respJson(0, "ok", data || []);
}

export function respOk() {
  return respJson(0, "ok");
}

export function respErr(message: string, status: number = 200) {
  return respJson(-1, message, undefined, status);
}

export function respJson(code: number, message: string, data?: any, status: number = 200) {
  let json: any = {
    code: code,
    message: message,
  };
  if (data !== undefined) {
    json["data"] = data;
  }

  return Response.json(json, { status });
}
