type FunctionCall = {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
};

export function isFunctionCall(item: unknown): item is FunctionCall {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const value = item as Record<string, unknown>;

  return (
    value.type === "function_call" &&
    typeof value.name === "string" &&
    typeof value.arguments === "string" &&
    typeof value.call_id === "string"
  );
}
