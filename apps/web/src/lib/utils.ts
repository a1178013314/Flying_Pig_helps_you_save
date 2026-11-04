export function cn(...inputs: Array<string | false | null | undefined>): string {
  // shortcut: 只拼接同类名，不解决冲突；出现需要覆盖同名工具类时再引 tailwind-merge
  return inputs.filter(Boolean).join(" ");
}
