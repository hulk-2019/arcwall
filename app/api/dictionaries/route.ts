import { respData, respErr } from "@/lib/resp";
import { getDictionariesByCategory } from "@/models/dictionary";
import { DictionariesSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = DictionariesSchema.safeParse(body);
    if (!parsed.success) {
      return respErr("invalid.params");
    }
    const { categories } = parsed.data;

    const dictionaries = await getDictionariesByCategory(categories as any);

    return respData(dictionaries);
  } catch (e) {
    console.log("get dictionaries failed: ", e);
    return respErr("get.dictionaries.failed");
  }
}
