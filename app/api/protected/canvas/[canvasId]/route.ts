import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { prisma } from "@/lib/prisma";
import { applyOperations, getCanvasSnapshot, getOwnedCanvas } from "@/models/canvas";
import {
  NODE_TYPE_DEFS,
  resolveTargetPort,
} from "@/lib/canvas/registry";
import type { CanvasNodeType } from "@/types/canvas";
import { z } from "zod";

const NodeId = z.string().uuid();
const EdgeId = z.string().uuid();

const OperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("node.upsert"),
    nodeId: NodeId,
    type: z.enum(["text", "image", "storyboard", "video", "upload"]),
    x: z.number(),
    y: z.number(),
    config: z.record(z.any()),
  }),
  z.object({
    op: z.literal("node.move"),
    nodeId: NodeId,
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    op: z.literal("node.config"),
    nodeId: NodeId,
    config: z.record(z.any()),
  }),
  z.object({ op: z.literal("node.delete"), nodeId: NodeId }),
  z.object({
    op: z.literal("edge.add"),
    edgeId: EdgeId,
    sourceNodeId: NodeId,
    targetNodeId: NodeId,
    targetPort: z.string(),
  }),
  z.object({ op: z.literal("edge.delete"), edgeId: EdgeId }),
  z.object({ op: z.literal("viewport"), viewport: z.record(z.any()) }),
]);

const BatchSaveSchema = z.object({
  operations: z.array(OperationSchema).min(1),
});

export async function GET(req: Request, { params }: { params: { canvasId: string } }) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const canvasId = Number(params.canvasId);
    if (!Number.isFinite(canvasId)) return respErr(errMsg("invalid.params"));

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const canvas = await getOwnedCanvas(user.id, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    const snapshot = await getCanvasSnapshot(canvasId);
    return respData(snapshot);
  } catch (e) {
    console.error("get canvas snapshot failed:", e);
    return respErr(errMsg("canvas.save.failed"));
  }
}

export async function PATCH(req: Request, { params }: { params: { canvasId: string } }) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const canvasId = Number(params.canvasId);
    if (!Number.isFinite(canvasId)) return respErr(errMsg("invalid.params"));

    const body = await req.json();
    const parsed = BatchSaveSchema.safeParse(body);
    if (!parsed.success) return respErr(errMsg("invalid.params"));

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const canvas = await getOwnedCanvas(user.id, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    // 服务端连线校验（类型兼容 + 禁止自环）
    const nodeTypeById = new Map<string, CanvasNodeType>();
    const nodes = await prisma.nodes.findMany({
      where: { canvas_id: canvasId },
      select: { id: true, type: true },
    });
    for (const n of nodes) nodeTypeById.set(n.id, n.type as CanvasNodeType);

    for (const op of parsed.data.operations) {
      if (op.op === "edge.add") {
        if (op.sourceNodeId === op.targetNodeId) {
          return respErr(errMsg("canvas.invalid.connection"));
        }
        const sourceType = nodeTypeById.get(op.sourceNodeId);
        const targetType = nodeTypeById.get(op.targetNodeId);
        // 若节点是新创建的（本批次 node.upsert），从本批次推断类型
        const createdType = parsed.data.operations.find(
          (o) => o.op === "node.upsert" && o.nodeId === op.sourceNodeId
        );
        const source = sourceType ?? (createdType?.op === "node.upsert" ? (createdType.type as CanvasNodeType) : undefined);
        const createdTarget = parsed.data.operations.find(
          (o) => o.op === "node.upsert" && o.nodeId === op.targetNodeId
        );
        const target = targetType ?? (createdTarget?.op === "node.upsert" ? (createdTarget.type as CanvasNodeType) : undefined);

        if (!source || !target) {
          return respErr(errMsg("canvas.invalid.connection"));
        }
        const expectedPort = resolveTargetPort(NODE_TYPE_DEFS[source].outputs[0].kind, target);
        if (!expectedPort) {
          return respErr(errMsg("canvas.invalid.connection"));
        }
      }
    }

    const result = await applyOperations(canvasId, parsed.data.operations);
    return respData(result);
  } catch (e) {
    console.error("apply canvas operations failed:", e);
    return respErr(errMsg("canvas.save.failed"));
  }
}
