import https from "node:https";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

function consultarExterno(url: URL): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      family: 4,
      headers: { Accept: "application/json", "User-Agent": "PainelAlpha/1.0" },
    }, (res) => {
      if (res.statusCode === undefined || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error("EmpresaAqui indisponível"));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(new Error("Resposta EmpresaAqui excedeu o limite"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        try {
          const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
          resolve(data as Record<string, unknown>);
        } catch {
          reject(new Error("Resposta EmpresaAqui inválida"));
        }
      });
      res.on("error", () => reject(new Error("Falha na resposta EmpresaAqui")));
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("Tempo limite EmpresaAqui excedido")));
    req.on("error", () => reject(new Error("Falha de conexão EmpresaAqui")));
  });
}

export async function getEmpresaAquiData(cnpj: string): Promise<Record<string, unknown>> {
  const token = process.env.EMPRESAQUI_TOKEN?.trim();
  if (!token) throw new Error("EmpresaAqui não configurada");
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) throw new Error("CNPJ inválido");

  // O contrato atual do fornecedor usa o token no caminho. A URL não é registrada.
  const url = new URL(`https://www.empresaqui.com.br/api/${encodeURIComponent(token)}/${digits}`);
  const data = await consultarExterno(url);
  if (data.error || data.status === "error") throw new Error("EmpresaAqui recusou a consulta");
  const returnedCnpj = String(data.cnpj ?? "").replace(/\D/g, "");
  if (returnedCnpj !== digits) throw new Error("EmpresaAqui retornou CNPJ divergente ou ausente");
  return data;
}
