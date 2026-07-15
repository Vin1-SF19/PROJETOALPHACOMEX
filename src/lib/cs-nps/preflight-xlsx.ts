import type { Readable } from "node:stream";
import { createInflateRaw } from "node:zlib";
import * as yauzl from "yauzl";

const LIMITE_ENTRADA_DESCOMPACTADA = 20 * 1024 * 1024;
const LIMITE_TOTAL_DESCOMPACTADO = 50 * 1024 * 1024;
const LIMITE_RAZAO_COMPRESSAO = 100;
const LIMITE_ENTRADAS = 256;

export class ErroPreflightXlsx extends Error {
  readonly code: string;
  readonly status: 413 | 422;

  constructor(message: string, code: string, status: 413 | 422) {
    super(message);
    this.name = "ErroPreflightXlsx";
    this.code = code;
    this.status = status;
  }
}

function abrirZip(buffer: ArrayBuffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(buffer),
      {
        autoClose: false,
        lazyEntries: true,
        decodeStrings: true,
        validateEntrySizes: true,
        strictFileNames: true,
      },
      (error, zipfile) => {
        if (error) {
          reject(new ErroPreflightXlsx("Estrutura ZIP inválida", "INVALID_ZIP_STREAM", 422));
          return;
        }
        resolve(zipfile);
      },
    );
  });
}

function erroDeStream(error: Error): ErroPreflightXlsx {
  const mensagem = error.message.toLocaleLowerCase("en-US");
  if (mensagem.includes("too many bytes") || mensagem.includes("not enough bytes")) {
    return new ErroPreflightXlsx(
      "O tamanho real de uma entrada diverge do declarado",
      "ZIP_SIZE_MISMATCH",
      413,
    );
  }
  return new ErroPreflightXlsx("Falha ao validar conteúdo interno", "INVALID_ZIP_STREAM", 422);
}

export async function validarXlsxStreaming(buffer: ArrayBuffer): Promise<void> {
  const zipfile = await abrirZip(buffer);

  await new Promise<void>((resolve, reject) => {
    let concluido = false;
    let encerrado = false;
    let entradasLidas = 0;
    let totalReal = 0;
    const streamsAtivos = new Set<Readable>();

    const falhar = (error: ErroPreflightXlsx): void => {
      if (encerrado) return;
      encerrado = true;
      for (const stream of streamsAtivos) {
        try {
          stream.destroy();
        } catch {
          // A rejeição original continua sendo a causa pública.
        }
      }
      streamsAtivos.clear();
      try {
        if (zipfile.isOpen) zipfile.close();
      } catch {
        // O yauzl pode encerrar o reader junto com o stream; close é best-effort.
      } finally {
        reject(error);
      }
    };

    zipfile.once("error", (error: Error) => falhar(erroDeStream(error)));
    zipfile.once("close", () => {
      if (!encerrado && !concluido) {
        falhar(new ErroPreflightXlsx("ZIP encerrado antes da validação", "PREMATURE_ZIP_CLOSE", 422));
      }
    });
    zipfile.once("end", () => {
      if (encerrado) return;
      if (entradasLidas !== zipfile.entryCount) {
        falhar(new ErroPreflightXlsx("Leitura incompleta do ZIP", "PREMATURE_ZIP_END", 422));
        return;
      }
      concluido = true;
      encerrado = true;
      if (zipfile.isOpen) zipfile.close();
      resolve();
    });

    zipfile.on("entry", (entry: yauzl.Entry) => {
      if (encerrado) return;
      entradasLidas += 1;
      if (entradasLidas > LIMITE_ENTRADAS) {
        falhar(new ErroPreflightXlsx("Entradas internas demais", "TOO_MANY_ZIP_ENTRIES", 422));
        return;
      }
      if (entry.isEncrypted()) {
        falhar(new ErroPreflightXlsx("ZIP criptografado não é aceito", "ENCRYPTED_ZIP", 422));
        return;
      }
      if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
        falhar(new ErroPreflightXlsx("Método de compressão não suportado", "UNSUPPORTED_COMPRESSION", 422));
        return;
      }
      if (entry.uncompressedSize > LIMITE_ENTRADA_DESCOMPACTADA) {
        falhar(new ErroPreflightXlsx("Uma entrada excede 20 MB", "ZIP_ENTRY_TOO_LARGE", 413));
        return;
      }
      if (entry.compressedSize === 0 && entry.uncompressedSize > 0) {
        falhar(new ErroPreflightXlsx("Taxa de compressão inválida", "ZIP_BOMB", 413));
        return;
      }
      if (
        entry.compressedSize > 0 &&
        entry.uncompressedSize / entry.compressedSize > LIMITE_RAZAO_COMPRESSAO
      ) {
        falhar(new ErroPreflightXlsx("Taxa de compressão excede o limite", "ZIP_BOMB", 413));
        return;
      }
      if (entry.fileName.endsWith("/")) {
        if (entry.uncompressedSize !== 0) {
          falhar(new ErroPreflightXlsx("Diretório ZIP inválido", "INVALID_ZIP_DIRECTORY", 422));
          return;
        }
        zipfile.readEntry();
        return;
      }

      const opcoes = entry.compressionMethod === 8 ? { decompress: false } : undefined;
      const aoAbrir = (error: Error | null, stream: Readable): void => {
        if (encerrado) {
          stream?.destroy();
          return;
        }
        if (error) {
          falhar(erroDeStream(error));
          return;
        }
        streamsAtivos.add(stream);
        const inflate = entry.compressionMethod === 8 ? createInflateRaw() : null;
        const fluxo = inflate ? stream.pipe(inflate) : stream;
        if (inflate) streamsAtivos.add(inflate);
        let bytesReaisEntrada = 0;

        stream.once("error", (streamError: Error) => falhar(erroDeStream(streamError)));
        fluxo.on("data", (chunk: Buffer) => {
          if (encerrado) return;
          bytesReaisEntrada += chunk.length;
          totalReal += chunk.length;
          if (bytesReaisEntrada > LIMITE_ENTRADA_DESCOMPACTADA) {
            falhar(new ErroPreflightXlsx("Uma entrada real excede 20 MB", "ZIP_ENTRY_TOO_LARGE", 413));
            return;
          }
          if (totalReal > LIMITE_TOTAL_DESCOMPACTADO) {
            falhar(new ErroPreflightXlsx("Conteúdo real excede 50 MB", "ZIP_TOO_LARGE", 413));
            return;
          }
          if (
            (entry.compressedSize === 0 && bytesReaisEntrada > 0) ||
            (entry.compressedSize > 0 &&
              bytesReaisEntrada / entry.compressedSize > LIMITE_RAZAO_COMPRESSAO)
          ) {
            falhar(new ErroPreflightXlsx("Taxa real de compressão excede o limite", "ZIP_BOMB", 413));
          }
        });
        if (fluxo !== stream) {
          fluxo.once("error", (streamError: Error) => falhar(erroDeStream(streamError)));
        }
        fluxo.once("end", () => {
          if (encerrado) return;
          streamsAtivos.delete(stream);
          streamsAtivos.delete(fluxo);
          if (bytesReaisEntrada !== entry.uncompressedSize) {
            falhar(new ErroPreflightXlsx(
              "O tamanho real de uma entrada diverge do declarado",
              "ZIP_SIZE_MISMATCH",
              413,
            ));
            return;
          }
          zipfile.readEntry();
        });
      };
      if (opcoes) zipfile.openReadStream(entry, opcoes, aoAbrir);
      else zipfile.openReadStream(entry, aoAbrir);
    });

    zipfile.readEntry();
  });
}
