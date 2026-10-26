// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ModalEditarPreCadastro from "@/components/Parceiros/ModalEditarPreCadastro";
import { atualizarPreCadastro } from "@/actions/convites-parceiro";
vi.mock("framer-motion", () => {
  const components = new Map<string, React.ComponentType<Record<string, unknown>>>();
  return { AnimatePresence: ({children}: {children: React.ReactNode}) => h(React.Fragment, null, children),
    motion: new Proxy({}, { get: (_target, tag: string) => {
      if (!components.has(tag)) components.set(tag, ({children, ...props}) => h(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !["initial", "animate", "exit", "transition", "layout", "whileHover", "whileTap"].includes(key))), children as React.ReactNode));
      return components.get(tag);
    } }) };
});
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock("next/link",()=>({default:({children,...props}:React.ComponentProps<"a">)=>h("a",props,children)}));
vi.mock("@/components/Checklist/Velocimetro",()=>({default:()=>null}));
vi.mock("@/components/Checklist/ChecklistNotificacoesWidget",()=>({default:()=>null}));
vi.mock("@/actions/checklist",()=>({atualizarItemChecklist:vi.fn(),criarChecklist:vi.fn(),trocarEmbasamentoChecklist:vi.fn(),atualizarObservacaoDocumento:vi.fn(),excluirDocumentoAnalista:vi.fn()}));
vi.mock("@/actions/convites-parceiro",()=>({atualizarPreCadastro:vi.fn()}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));
let host:HTMLDivElement;let root:Root;
beforeEach(()=>{vi.resetAllMocks();Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function input(element:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{const prototype=element.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,"value")!.set!.call(element,value);element.dispatchEvent(new Event("input",{bubbles:true}));});}
it("limpar complemento e UF envia vazio explícito; campos ocultos permanecem omitidos",async()=>{
  vi.mocked(atualizarPreCadastro).mockResolvedValue({success:true});
  const preCadastro={id:1,nomeCompleto:"Pessoa fictícia",tipoRecebimento:"PF",cpf:"12345678900",dataNascimento:"1990-01-01",whatsapp:"11999999999",complemento:"Sala antiga",uf:"SP",souRepresentante:false} as React.ComponentProps<typeof ModalEditarPreCadastro>["preCadastro"];
  await act(async()=>root.render(h(ModalEditarPreCadastro,{preCadastro,onClose:vi.fn(),onSalvo:vi.fn()})));
  for(const label of ["Complemento","UF"]){const field=[...host.querySelectorAll("label")].find(e=>e.textContent===label)!.parentElement!.querySelector("input")!;await input(field,"");}
  await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent?.trim()==="Salvar")!.click());
  expect(atualizarPreCadastro).toHaveBeenCalledWith(1,expect.objectContaining({complemento:"",uf:"",cnpj:undefined}));
});
