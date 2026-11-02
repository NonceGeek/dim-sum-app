import type { StreamTextTransform, ToolSet } from "ai";
import { removeJyutping } from "./blocks";

// 末尾可能仍在输出中的粤拼片段：字母、数字、空格、括号
const PENDING_TAIL = /[A-Za-z0-9 \t(（]*$/;

/**
 * 从流式文本中去掉模型自行书写的粤拼。
 * 每段文本末尾的 ASCII 片段先缓存，直到后面出现其他字符再判断，避免粤拼被拆在两个分片里。
 */
export function splitStreamingText(buffer: string): { ready: string; pending: string } {
  const tail = buffer.match(PENDING_TAIL)?.[0] ?? "";
  return { ready: buffer.slice(0, buffer.length - tail.length), pending: tail };
}

export function stripJyutpingTransform<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
  return () => {
    const buffers = new Map<string, string>();
    return new TransformStream({
      transform(part, controller) {
        if (part.type === "text-delta") {
          const { ready, pending } = splitStreamingText((buffers.get(part.id) ?? "") + part.text);
          buffers.set(part.id, pending);
          if (ready) controller.enqueue({ ...part, text: removeJyutping(ready).text });
          return;
        }
        if (part.type === "text-end") {
          const rest = buffers.get(part.id);
          buffers.delete(part.id);
          if (rest) {
            controller.enqueue({ type: "text-delta", id: part.id, text: removeJyutping(rest).text });
          }
        }
        controller.enqueue(part);
      },
    });
  };
}
