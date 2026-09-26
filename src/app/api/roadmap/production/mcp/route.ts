import { handleRoadmapMcpRequest } from "@/lib/roadmap-mcp/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleRoadmapMcpRequest;
export const POST = handleRoadmapMcpRequest;
export const DELETE = handleRoadmapMcpRequest;
export const OPTIONS = handleRoadmapMcpRequest;
