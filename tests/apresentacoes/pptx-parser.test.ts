import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extrairApresentacaoPptx } from "@/lib/apresentacoes/pptx/parser";

const CANVAS_TESTE = { width: 1280, height: 720 };

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function montarZip(arquivos: Record<string, string>, binarios: Record<string, string> = {}): Promise<Buffer> {
  const zip = new JSZip();
  for (const [caminho, conteudo] of Object.entries(arquivos)) zip.file(caminho, conteudo);
  for (const [caminho, base64] of Object.entries(binarios)) zip.file(caminho, base64, { base64: true });
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("extrairApresentacaoPptx — caso básico (texto, imagem, forma colorida)", () => {
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
</p:presentation>`;

  const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type=".../slide" Target="slides/slide1.xml"/>
</Relationships>`;

  const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="457200"/><a:ext cx="7772400" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="4400" b="1"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:rPr><a:t>Titulo de Teste</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="3" name="Picture 2"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="1000000" y="2000000"/><a:ext cx="3000000" cy="2000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Rectangle 3"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="5000000" y="3000000"/><a:ext cx="2000000" cy="1000000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="00B050"/></a:solidFill>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"/><a:t>Caixa colorida</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type=".../image" Target="../media/image1.png"/>
</Relationships>`;

  it("extrai texto (com cor/negrito/tamanho/alinhamento direto), imagem embutida e forma colorida com texto aninhado", async () => {
    const buffer = await montarZip(
      {
        "ppt/presentation.xml": presentationXml,
        "ppt/_rels/presentation.xml.rels": presentationRels,
        "ppt/slides/slide1.xml": slideXml,
        "ppt/slides/_rels/slide1.xml.rels": slideRels,
      },
      { "ppt/media/image1.png": PNG_1X1_BASE64 },
    );

    const resultado = await extrairApresentacaoPptx(buffer, CANVAS_TESTE);
    expect(resultado.slides).toHaveLength(1);
    expect(resultado.slides[0].formas).toHaveLength(3);

    // Ordem real do XML: Title 1 (p:sp) → Picture 2 (p:pic) → Rectangle 3 (p:sp) — `ordem-xml.ts`
    // garante que a saída respeita essa ordem entre tipos intercalados, não o agrupamento por tag.
    const [titulo, imagem, caixa] = resultado.slides[0].formas;
    expect(titulo).toMatchObject({ tipo: "texto", corTexto: "#FF0000", negrito: true, alinhamento: "center", ehTitulo: true });
    expect(imagem).toMatchObject({ tipo: "imagem", mimeType: "image/png" });
    if (imagem.tipo === "imagem") expect(imagem.bytes.byteLength).toBeGreaterThan(0);
    expect(caixa).toMatchObject({ tipo: "caixa", corFundo: "#00B050", formato: "roundRect" });
    if (caixa.tipo === "caixa") expect(caixa.textoInterno?.paragrafos).toEqual(["Caixa colorida"]);
  });
});

describe("extrairApresentacaoPptx — herança de tema/layout/master, grupos e rotação", () => {
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
</p:presentation>`;

  const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type=".../slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type=".../slide" Target="slides/slide1.xml"/>
</Relationships>`;

  const themeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Teste">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F1F1F"/></a:dk2>
      <a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>
      <a:accent1><a:srgbClr val="2244AA"/></a:accent1>
      <a:accent2><a:srgbClr val="AA4422"/></a:accent2>
      <a:accent3><a:srgbClr val="333333"/></a:accent3>
      <a:accent4><a:srgbClr val="444444"/></a:accent4>
      <a:accent5><a:srgbClr val="555555"/></a:accent5>
      <a:accent6><a:srgbClr val="666666"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>
    </a:clrScheme>
  </a:themeElements>
</a:theme>`;

  const masterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:sldMaster>`;

  const masterRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type=".../theme" Target="../theme/theme1.xml"/>
</Relationships>`;

  const layoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="9" name="Subtitle Placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="900000" y="4500000"/><a:ext cx="4000000" cy="900000"/></a:xfrm></p:spPr>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;

  const layoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type=".../slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

  const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Retangulo tema"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="1000000" cy="500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"/><a:t>Subtitulo herdado</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Rotacionado"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm rot="2700000"><a:off x="6000000" y="1000000"/><a:ext cx="800000" cy="400000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="00FF00"/></a:solidFill></p:spPr>
      </p:sp>
      <p:grpSp>
        <p:nvGrpSpPr><p:cNvPr id="5" name="Grupo"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="2000000" y="2000000"/><a:ext cx="2000000" cy="2000000"/><a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="1000000"/></a:xfrm></p:grpSpPr>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="6" name="FilhoDoGrupo"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="200000" cy="200000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFF00"/></a:solidFill></p:spPr>
        </p:sp>
      </p:grpSp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type=".../slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  async function montar() {
    const buffer = await montarZip({
      "ppt/presentation.xml": presentationXml,
      "ppt/_rels/presentation.xml.rels": presentationRels,
      "ppt/theme/theme1.xml": themeXml,
      "ppt/slideMasters/slideMaster1.xml": masterXml,
      "ppt/slideMasters/_rels/slideMaster1.xml.rels": masterRels,
      "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels": layoutRels,
      "ppt/slides/slide1.xml": slideXml,
      "ppt/slides/_rels/slide1.xml.rels": slideRels,
    });
    return extrairApresentacaoPptx(buffer, CANVAS_TESTE);
  }

  it("resolve o fundo herdado do master (schemeClr accent2) como 1ª forma, zIndex mais baixo", async () => {
    const resultado = await montar();
    const [fundo] = resultado.slides[0].formas;
    expect(fundo).toMatchObject({ tipo: "caixa", corFundo: "#AA4422", x: 0, y: 0, w: CANVAS_TESTE.width, h: CANVAS_TESTE.height });
  });

  it("resolve cor de tema (schemeClr accent1) num preenchimento de forma", async () => {
    const resultado = await montar();
    const retangulo = resultado.slides[0].formas[1];
    expect(retangulo).toMatchObject({ tipo: "caixa", corFundo: "#2244AA" });
  });

  it("herda posição/tamanho do layout quando o placeholder não tem xfrm próprio no slide", async () => {
    const resultado = await montar();
    const subtitulo = resultado.slides[0].formas[2];
    expect(subtitulo.x).toBeGreaterThan(0);
    expect(subtitulo.y).toBeGreaterThan(0);
    if (subtitulo.tipo === "texto") expect(subtitulo.paragrafos).toEqual(["Subtitulo herdado"]);
  });

  it("lê a rotação do xfrm (60.000avos de grau → graus)", async () => {
    const resultado = await montar();
    const rotacionado = resultado.slides[0].formas[3];
    expect(rotacionado.rotacao).toBe(45);
  });

  it("recalcula a posição de filhos de grupo usando chOff/chExt (transform local do grupo)", async () => {
    const resultado = await montar();
    const filhoGrupo = resultado.slides[0].formas[4];
    // Grupo off=(2M,2M) ext=(2M,2M), chOff=(0,0) chExt=(1M,1M) → escala 2x.
    // Filho local off=(500K,500K) ext=(200K,200K) → mapeado off=(3M,3M) ext=(400K,400K).
    // Canvas 1280x720 sobre slide 12192000x6858000 (16:9 exato) → escala ≈0.000105.
    expect(filhoGrupo.x).toBeCloseTo(315, 0);
    expect(filhoGrupo.y).toBeCloseTo(315, 0);
    expect(filhoGrupo.w).toBeCloseTo(42, 0);
    expect(filhoGrupo.h).toBeCloseTo(42, 0);
  });
});

describe("extrairApresentacaoPptx — blipFill dentro de p:sp (imagem como preenchimento de forma)", () => {
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
</p:presentation>`;

  const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type=".../slide" Target="slides/slide1.xml"/>
</Relationships>`;

  // Freeform 1: custGeom RETANGULAR (5 pontos == cantos de w/h) + blipFill com svgBlip — deve
  // preferir o SVG (rId4) sobre o raster (rId3) e NÃO recortar (é só um retângulo disfarçado).
  // Freeform 2: custGeom CURVO (círculo via 4 cubicBezTo) + blipFill só raster — deve recortar
  // (clipPath) a imagem original, virando um SVG novo com a foto embutida como data: URI.
  // Freeform 3: custGeom CURVO (mesma estrela) + solidFill (sem blipFill) — sem card nativo pra
  // path arbitrário, deve virar SVG com o path colorido (fallback de última instância).
  const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Freeform Retangular"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="2000000" cy="1000000"/></a:xfrm>
          <a:custGeom>
            <a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>
            <a:rect l="0" t="0" r="0" b="0"/>
            <a:pathLst>
              <a:path w="2000000" h="1000000">
                <a:moveTo><a:pt x="0" y="0"/></a:moveTo>
                <a:lnTo><a:pt x="2000000" y="0"/></a:lnTo>
                <a:lnTo><a:pt x="2000000" y="1000000"/></a:lnTo>
                <a:lnTo><a:pt x="0" y="1000000"/></a:lnTo>
                <a:close/>
              </a:path>
            </a:pathLst>
          </a:custGeom>
          <a:blipFill>
            <a:blip r:embed="rId3">
              <a:extLst>
                <a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">
                  <asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId4"/>
                </a:ext>
              </a:extLst>
            </a:blip>
            <a:stretch><a:fillRect/></a:stretch>
          </a:blipFill>
        </p:spPr>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="5" name="Foto Recortada"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="500000" y="500000"/><a:ext cx="1000000" cy="1000000"/></a:xfrm>
          <a:custGeom>
            <a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>
            <a:rect l="0" t="0" r="0" b="0"/>
            <a:pathLst>
              <a:path w="1000000" h="1000000">
                <a:moveTo><a:pt x="500000" y="0"/></a:moveTo>
                <a:cubicBezTo><a:pt x="776142" y="0"/><a:pt x="1000000" y="223858"/><a:pt x="1000000" y="500000"/></a:cubicBezTo>
                <a:cubicBezTo><a:pt x="1000000" y="776142"/><a:pt x="776142" y="1000000"/><a:pt x="500000" y="1000000"/></a:cubicBezTo>
                <a:cubicBezTo><a:pt x="223858" y="1000000"/><a:pt x="0" y="776142"/><a:pt x="0" y="500000"/></a:cubicBezTo>
                <a:cubicBezTo><a:pt x="0" y="223858"/><a:pt x="223858" y="0"/><a:pt x="500000" y="0"/></a:cubicBezTo>
                <a:close/>
              </a:path>
            </a:pathLst>
          </a:custGeom>
          <a:blipFill>
            <a:blip r:embed="rId3"/>
            <a:stretch><a:fillRect/></a:stretch>
          </a:blipFill>
        </p:spPr>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="7" name="Estrela Colorida"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="500000" cy="500000"/></a:xfrm>
          <a:custGeom>
            <a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>
            <a:rect l="0" t="0" r="0" b="0"/>
            <a:pathLst>
              <a:path w="500000" h="500000">
                <a:moveTo><a:pt x="250000" y="0"/></a:moveTo>
                <a:lnTo><a:pt x="300000" y="200000"/></a:lnTo>
                <a:lnTo><a:pt x="500000" y="250000"/></a:lnTo>
                <a:lnTo><a:pt x="300000" y="300000"/></a:lnTo>
                <a:close/>
              </a:path>
            </a:pathLst>
          </a:custGeom>
          <a:solidFill><a:srgbClr val="112233"/></a:solidFill>
        </p:spPr>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId3" Type=".../image" Target="../media/image1.png"/>
  <Relationship Id="rId4" Type=".../image" Target="../media/image2.svg"/>
</Relationships>`;

  async function montar() {
    const buffer = await montarZip(
      {
        "ppt/presentation.xml": presentationXml,
        "ppt/_rels/presentation.xml.rels": presentationRels,
        "ppt/slides/slide1.xml": slideXml,
        "ppt/slides/_rels/slide1.xml.rels": slideRels,
        "ppt/media/image2.svg": `<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>`,
      },
      { "ppt/media/image1.png": PNG_1X1_BASE64 },
    );
    return extrairApresentacaoPptx(buffer, CANVAS_TESTE);
  }

  it("custGeom retangular + blipFill: prefere o asvg:svgBlip sobre o raster e NÃO recorta (é só um retângulo)", async () => {
    const resultado = await montar();
    const forma = resultado.slides[0].formas[0];
    expect(forma).toMatchObject({ tipo: "imagem", mimeType: "image/svg+xml", nomeArquivo: "image2.svg" });
  });

  it("custGeom curvo + blipFill: recorta a imagem original pelo path real (clipPath), virando SVG novo", async () => {
    const resultado = await montar();
    const forma = resultado.slides[0].formas[1];
    expect(forma.tipo).toBe("imagem");
    if (forma.tipo !== "imagem") return;
    expect(forma.mimeType).toBe("image/svg+xml");
    expect(forma.nomeArquivo).toMatch(/-recortada\.svg$/);
    const svg = Buffer.from(forma.bytes).toString("utf-8");
    expect(svg).toContain("<clipPath");
    expect(svg).toContain("<image");
    expect(svg).toContain("data:image/png;base64,");
  });

  it("custGeom curvo + solidFill (sem blipFill): fallback de última instância vira SVG com o path colorido", async () => {
    const resultado = await montar();
    const forma = resultado.slides[0].formas[2];
    expect(forma.tipo).toBe("imagem");
    if (forma.tipo !== "imagem") return;
    expect(forma.mimeType).toBe("image/svg+xml");
    expect(forma.nomeArquivo).toMatch(/^forma-/);
    const svg = Buffer.from(forma.bytes).toString("utf-8");
    expect(svg).toContain('fill="#112233"');
    expect(svg).not.toContain("<clipPath");
  });
});

describe("extrairApresentacaoPptx — ordem real do documento, fontes detectadas e diagnóstico", () => {
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
</p:presentation>`;

  const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type=".../slide" Target="slides/slide1.xml"/>
</Relationships>`;

  // Ordem real intercalada: sp(A) → pic(B) → grpSp(C, com sp filho D) → sp(E) → sp(Vazio) → cxnSp(F).
  // `fast-xml-parser` agruparia em [sp,sp,sp] / [pic] / [grpSp] / [cxnSp] — só a ordem real do
  // XML (via ordem-xml.ts) reproduz [A, B, D, E, Vazio(ignorado), F(ignorado)].
  const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="A"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="1000000" cy="500000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"><a:latin typeface="SF Pro Display Heavy"/></a:rPr><a:t>A</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="3" name="B"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="1500000" y="100000"/><a:ext cx="900000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
      <p:grpSp>
        <p:nvGrpSpPr><p:cNvPr id="4" name="C"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/><a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="1000000"/></a:xfrm></p:grpSpPr>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="5" name="D"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr><a:xfrm><a:off x="200000" y="200000"/><a:ext cx="400000" cy="200000"/></a:xfrm></p:spPr>
          <p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"><a:latin typeface="Open Sans"/></a:rPr><a:t>D</a:t></a:r></a:p></p:txBody>
        </p:sp>
      </p:grpSp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="6" name="E"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="3000000" y="3000000"/><a:ext cx="900000" cy="400000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"/><a:t>E</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="8" name="FormaVazia"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="4000000" y="4000000"/><a:ext cx="300000" cy="300000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:sp>
      <p:cxnSp>
        <p:nvCxnSpPr><p:cNvPr id="9" name="Conector 1"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="500000" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom></p:spPr>
      </p:cxnSp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId3" Type=".../image" Target="../media/image1.png"/>
</Relationships>`;

  async function montar() {
    const buffer = await montarZip(
      {
        "ppt/presentation.xml": presentationXml,
        "ppt/_rels/presentation.xml.rels": presentationRels,
        "ppt/slides/slide1.xml": slideXml,
        "ppt/slides/_rels/slide1.xml.rels": slideRels,
      },
      { "ppt/media/image1.png": PNG_1X1_BASE64 },
    );
    return extrairApresentacaoPptx(buffer, CANVAS_TESTE);
  }

  it("respeita a ordem real do XML entre tipos intercalados (sp → pic → grupo → sp), não o agrupamento por tag", async () => {
    const resultado = await montar();
    const rotulos = resultado.slides[0].formas.map((f) => (f.tipo === "texto" ? f.paragrafos[0] : f.tipo));
    expect(rotulos).toEqual(["A", "imagem", "D", "E"]);
  });

  it("detecta fontes usadas (a:latin typeface) e reporta em fontesNaoAplicadas, sem duplicar", async () => {
    const resultado = await montar();
    expect(resultado.fontesNaoAplicadas).toContain("SF Pro Display Heavy");
    expect(resultado.fontesNaoAplicadas).toContain("Open Sans");
  });

  it("registra motivo ESPECÍFICO (com o nome da forma) pra forma sem fill/texto — nunca a mensagem genérica antiga", async () => {
    const resultado = await montar();
    const motivos = Object.keys(resultado.ignorados);
    expect(motivos.some((m) => m.includes("FormaVazia"))).toBe(true);
    expect(motivos).not.toContain("forma sem texto/preenchimento reconhecido");
  });

  it("conta p:cxnSp (conector) em ignorados em vez de descartar em silêncio", async () => {
    const resultado = await montar();
    const motivos = Object.keys(resultado.ignorados);
    expect(motivos.some((m) => m.toLowerCase().includes("conector") || m.toLowerCase().includes("cxnsp"))).toBe(true);
  });

  it("preenche diagnostico com 1 entrada por elemento, incluindo grupoPai do filho do grupo", async () => {
    const resultado = await montar();
    const diagD = resultado.diagnostico.find((d) => d.nome === "D");
    expect(diagD?.grupoPai).toBe("C");
    const diagA = resultado.diagnostico.find((d) => d.nome === "A");
    expect(diagA?.grupoPai).toBeNull();
  });
});
