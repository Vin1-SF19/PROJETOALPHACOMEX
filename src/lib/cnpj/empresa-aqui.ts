import https from "https";

function consultarExterno(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      family: 4,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Resposta não é um JSON válido"));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

export async function getEmpresaAquiData(cnpj: string) {
  const token = process.env.EMPRESAQUI_TOKEN?.trim();
  if (!token) throw new Error("Token EmpresaAqui não configurado");

  const dados = await consultarExterno(`https://www.empresaqui.com.br/api/${token}/${cnpj.replace(/\D/g, "")}`);
  if (dados?.error || dados?.status === "error") {
    throw new Error(dados.message || "Erro na API EmpresaAqui");
  }
  return dados;
}
