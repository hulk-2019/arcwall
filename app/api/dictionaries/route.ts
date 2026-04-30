import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { getDictionariesByCategory } from "@/models/dictionary";
import { DictionariesSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  try {
    const body = await req.json();
    const parsed = DictionariesSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { categories } = parsed.data;

    const dictionaries = await getDictionariesByCategory(categories as any);

    return respData(dictionaries);
  } catch (e) {
    console.log("get dictionaries failed: ", e);
    return respErr(errMsg("get.dictionaries.failed"));
  }
}
