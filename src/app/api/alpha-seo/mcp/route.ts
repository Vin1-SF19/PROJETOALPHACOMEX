import { handleAlphaSeoMcpRequest } from "@/lib/alpha-seo/mcp/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleAlphaSeoMcpRequest;
export const POST = handleAlphaSeoMcpRequest;
export const DELETE = handleAlphaSeoMcpRequest;
export const OPTIONS = handleAlphaSeoMcpRequest;

