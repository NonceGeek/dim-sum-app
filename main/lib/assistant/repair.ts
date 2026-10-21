/**
 * 补全模型输出中缺失的 JSON 结尾括号（千问偶尔在长 tool 参数末尾漏掉 `}` 或 `]`）。
 * 只处理"少了结尾"的情况；括号不匹配或补全后仍无法解析时返回 null。
 */
export function balanceJson(text: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") {
      if (stack.pop() !== char) return null;
    }
  }
  if (inString || !stack.length) return null;
  const repaired = text.trimEnd() + stack.reverse().join("");
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}
