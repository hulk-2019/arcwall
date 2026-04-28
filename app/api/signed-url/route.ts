import { respData, respErr } from "@/lib/resp";
import { getSignedUrl } from "@/lib/oss";
import { SignedUrlSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SignedUrlSchema.safeParse(body);
    if (!parsed.success) {
      return respErr("invalid.params.paths.array");
    }
    const { paths } = parsed.data;

    const entries = await Promise.all(
      paths
        .filter((path: any) => path && typeof path === 'string')
        .map(async (path: string) => {
          try {
            return [path, await getSignedUrl(path, 86400)] as const;
          } catch (e) {
            console.log(`Failed to generate signed URL for ${path}:`, e);
            return [path, ''] as const;
          }
        })
    );
    const urls: Record<string, string> = Object.fromEntries(entries);

    return respData(urls);
  } catch (e) {
    console.log("generate signed urls failed: ", e);
    return respErr("generate.signed.urls.failed");
  }
}

