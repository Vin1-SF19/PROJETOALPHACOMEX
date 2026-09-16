import type { ChatbotFlow, FlowValidation } from "@/types/chatbot";

export function validateChatbotFlow(flow: ChatbotFlow): FlowValidation {
  const errors: FlowValidation["errors"] = [];
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  if (!flow.nodes.some((node) => node.type === "startFlow")) {
    errors.push({ code: "missing-trigger", message: "Adicione um node de início ao fluxo." });
  }
  for (const node of flow.nodes) {
    if (!node.data.label.trim()) errors.push({ code: "missing-field", nodeId: node.id, message: "Node sem nome." });
    const connected = flow.edges.some((edge) => edge.source === node.id || edge.target === node.id);
    if (flow.nodes.length > 1 && !connected) errors.push({ code: "orphan-node", nodeId: node.id, message: `“${node.data.label || "Node"}” está desconectado.` });
  }
  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push({ code: "orphan-edge", message: `Conexão ${edge.id} aponta para um node inexistente.` });
  }
  return { valid: errors.length === 0, errors };
}

export function removeFlowNode(flow: ChatbotFlow, nodeId: string): ChatbotFlow {
  return { ...flow, nodes: flow.nodes.filter((node) => node.id !== nodeId), edges: flow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) };
}
