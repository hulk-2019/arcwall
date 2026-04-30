import { auth, clerkClient } from "@clerk/nextjs/server";
import { findUserByEmail } from "@/models/user";
import { prisma } from "@/lib/prisma";
import { addThumbnailUrlToWallpaper } from "@/lib/wallpaper-utils";
import { formatWallpaper } from "@/models/wallpaper";
import { createSubscriber, wallpaperStatusChannel } from "@/lib/redis-subscriber";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Use auth() only — avoids currentUser() which triggers Clerk session rotation
  // and fails on long-lived GET (SSE) connections.
  const { userId: clerkUserId } = auth();
  if (!clerkUserId) {
    return new Response(JSON.stringify({ code: -2, message: "unauthorized" }), { status: 401 });
  }

  const clerk = clerkClient();
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return new Response("No email on account", { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user?.id) {
    return new Response("User not found", { status: 404 });
  }

  const dbUserId = user.id;
  const encoder = new TextEncoder();

  function encode(event: string, data: unknown) {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Query pending wallpaper IDs before subscribing to know when we're done
  const pendingRows = await prisma.wallpapers.findMany({
    where: { user_id: dbUserId, status: 0, is_delete: false, is_permanently_delete: false },
    select: { id: true },
  });

  const pendingIds = new Set(pendingRows.map((r) => r.id));

  const stream = new ReadableStream({
    async start(controller) {
      if (pendingIds.size === 0) {
        controller.enqueue(encode("done", { message: "no pending tasks" }));
        controller.close();
        return;
      }

      controller.enqueue(encode("connected", { ok: true }));

      const subscriber = createSubscriber();
      const channel = wallpaperStatusChannel(dbUserId);

      const cleanup = () => {
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
      };

      req.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      }, { once: true });

      subscriber.on("message", async (_channel, message) => {
        try {
          const payload = JSON.parse(message);
          const { wallpaperId, status, img_thumbnail_path, failure_reason } = payload;

          pendingIds.delete(wallpaperId);

          // Fetch the full row so formatWallpaper has all fields
          const row = await prisma.wallpapers.findUnique({
            where: { id: wallpaperId },
            include: { user: true },
          });

          if (row) {
            const formatted = formatWallpaper(row as any);
            const withUrl = await addThumbnailUrlToWallpaper(formatted);
            controller.enqueue(encode("status_update", { wallpapers: [withUrl] }));
          } else {
            controller.enqueue(encode("status_update", {
              wallpapers: [{ id: wallpaperId, status, img_thumbnail_path, failure_reason }],
            }));
          }

          if (pendingIds.size === 0) {
            controller.enqueue(encode("done", { message: "all tasks completed" }));
            cleanup();
            controller.close();
          }
        } catch (err) {
          console.error("[SSE] message handler error:", err);
        }
      });

      subscriber.on("error", (err) => {
        console.error("[SSE] subscriber error:", err);
        controller.enqueue(encode("error", { message: "subscription error" }));
        cleanup();
        controller.close();
      });

      await subscriber.subscribe(channel);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
