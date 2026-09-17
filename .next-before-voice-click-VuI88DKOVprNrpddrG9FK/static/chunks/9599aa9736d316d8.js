(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,455607,e=>{"use strict";let a=(0,e.i(475254).default)("map-pin",[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]]);e.s(["default",()=>a])},346897,e=>{"use strict";var a=e.i(455607);e.s(["MapPin",()=>a.default])},772328,e=>{"use strict";var a=e.i(571164),t=e.i(138544),i=e.i(271645);function r(){a.hasReducedMotionListener.current||(0,t.initPrefersReducedMotion)();let[e]=(0,i.useState)(a.prefersReducedMotion.current);return e}e.s(["useReducedMotion",()=>r])},497140,e=>{"use strict";let a=(0,e.i(475254).default)("star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]]);e.s(["default",()=>a])},870273,e=>{"use strict";var a=e.i(497140);e.s(["Star",()=>a.default])},996829,e=>{"use strict";var a=e.i(843476),t=e.i(271645),i=e.i(190072),r=e.i(408560);function s({className:e,intensidade:s=.9,variant:n="sutil",pausado:o=!1,corPrimaria:l="#1e1b4b",corSecundaria:c="#6366f1",velocidade:d=1}){let u=(0,t.useRef)(null),m=(0,t.useRef)(o),p=(0,t.useRef)(d),x=(0,t.useRef)(l),v=(0,t.useRef)(c);return(0,t.useEffect)(()=>{m.current=o,p.current=d,x.current=l,v.current=c},[o,d,l,c]),(0,t.useEffect)(()=>{let e=u.current;if(!e)return;let a=new i.Scene,t=new i.OrthographicCamera(-1,1,1,-1,0,1),n=new r.WebGLRenderer({antialias:!0,alpha:!0});n.setSize(e.clientWidth||1,e.clientHeight||1),e.appendChild(n.domElement);let o=new i.ShaderMaterial({uniforms:{iTime:{value:0},iResolution:{value:new i.Vector2(e.clientWidth,e.clientHeight)},iIntensidade:{value:s},uCorPrimaria:{value:new i.Color(x.current)},uCorSecundaria:{value:new i.Color(v.current)}},vertexShader:`
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,fragmentShader:`
        uniform float iTime;
        uniform vec2 iResolution;
        uniform float iIntensidade;
        uniform vec3 uCorPrimaria;
        uniform vec3 uCorSecundaria;

        #define NUM_OCTAVES 3

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);

          float res = mix(
            mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0;
          float a = 0.3;
          vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.4;
          }
          return v;
        }

        void main() {
          vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
          vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
          vec2 v;
          vec4 o = vec4(0.0);

          float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

          for (float i = 0.0; i < 35.0; i++) {
            v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
            float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));

            /* Mistura animada entre as 2 cores configur\xe1veis (default reproduz a
               paleta indigo/slate original) — shimmer combina as 3 fases que antes
               moviam R/G/B de forma independente, agora aplicadas como 1 fator de mix. */
            float shimmer = (sin(i * 0.2 + iTime * 0.4) + cos(i * 0.3 + iTime * 0.5) + sin(i * 0.4 + iTime * 0.3)) / 3.0;
            vec4 auroraColors = vec4(mix(uCorPrimaria, uCorSecundaria, 0.5 + 0.5 * shimmer), 1.0);
            vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
          }

          o = tanh(pow(o / 100.0, vec4(1.6)));
          gl_FragColor = o * iIntensidade;
        }
      `,transparent:!0}),l=new i.PlaneGeometry(2,2),c=new i.Mesh(l,o);a.add(c);let d=0,h=!1,f=()=>{h&&!m.current&&(o.uniforms.iTime.value+=.016*p.current,o.uniforms.uCorPrimaria.value.set(x.current),o.uniforms.uCorSecundaria.value.set(v.current),n.render(a,t)),d=requestAnimationFrame(f)};f();let g=()=>{e&&0!==e.clientWidth&&(n.setSize(e.clientWidth,e.clientHeight),o.uniforms.iResolution.value.set(e.clientWidth,e.clientHeight))},b=new ResizeObserver(g);b.observe(e);let C=requestAnimationFrame(g),j=new IntersectionObserver(e=>{(h=e[0]?.isIntersecting??!1)&&g()},{threshold:0});return j.observe(e),()=>{cancelAnimationFrame(d),cancelAnimationFrame(C),b.disconnect(),j.disconnect(),e.removeChild(n.domElement),l.dispose(),o.dispose(),n.dispose()}},[]),(0,a.jsx)("div",{ref:u,"aria-hidden":"true",className:e??"absolute inset-0 -z-10 overflow-hidden pointer-events-none"})}e.s(["default",()=>s])},202329,e=>{"use strict";var a=e.i(843476),t=e.i(975157);function i({children:e,className:i,surfaceClassName:r,accent:s="37, 99, 235"}){return(0,a.jsxs)("div",{className:(0,t.cn)("relative w-full overflow-hidden rounded-[14px]",i,"border border-blue-600 bg-slate-800/95 shadow-none","transition-transform duration-150 ease-out hover:scale-[1.02]","motion-reduce:transition-none motion-reduce:hover:scale-100"),children:[(0,a.jsx)("div",{"aria-hidden":"true",className:"absolute inset-0 z-0 bg-slate-800/95"}),r&&(0,a.jsx)("div",{"aria-hidden":"true",className:(0,t.cn)("absolute inset-0 z-0",r,"border-0")}),(0,a.jsx)("span",{"aria-hidden":"true",className:"pointer-events-none absolute inset-y-0 left-0 z-20 w-[3px]",style:{backgroundColor:`rgb(${s})`}}),(0,a.jsx)("div",{className:"relative z-10 w-full p-3",children:e})]})}e.s(["GradientBlobCard",()=>i])},286373,e=>{"use strict";var a=e.i(843476),t=e.i(271645),i=e.i(776639),r=e.i(519455),s=e.i(793479),n=e.i(110204),o=e.i(531278),l=e.i(346897),c=e.i(555436),d=e.i(846696);let u={cep:"",logradouro:"",numero:"",complemento:"",bairro:"",cidade:"",uf:""};function m({open:e,onClose:m,onSalvar:p,inicial:x}){let[v,h]=(0,t.useState)(x??u),[f,g]=(0,t.useState)(!1);function b(e,a){h(t=>({...t,[e]:a}))}async function C(){let e=v.cep.replace(/\D/g,"");if(8!==e.length)return void d.toast.error("CEP deve ter 8 dígitos");g(!0);try{let a=await fetch(`https://viacep.com.br/ws/${e}/json/`),t=await a.json();if(t.erro)return void d.toast.error("CEP não encontrado");h(e=>({...e,logradouro:t.logradouro||"",bairro:t.bairro||"",cidade:t.localidade||"",uf:t.uf||""}))}catch{d.toast.error("Erro ao buscar CEP")}finally{g(!1)}}return(0,a.jsx)(i.Dialog,{open:e,onOpenChange:e=>!e&&m(),children:(0,a.jsxs)(i.DialogContent,{className:"bg-slate-950 border-white/10 text-slate-200 max-w-lg rounded-3xl",children:[(0,a.jsx)(i.DialogHeader,{children:(0,a.jsxs)(i.DialogTitle,{className:"flex items-center gap-2 text-white font-black uppercase italic tracking-tight",children:[(0,a.jsx)(l.MapPin,{size:18,className:"text-indigo-400"}),"Endereço para brindes e presentes"]})}),(0,a.jsxs)("div",{className:"space-y-4 pt-2",children:[(0,a.jsxs)("div",{className:"space-y-1",children:[(0,a.jsx)(n.Label,{className:"text-[10px] font-black uppercase text-slate-500 tracking-widest",children:"CEP *"}),(0,a.jsxs)("div",{className:"flex gap-2",children:[(0,a.jsx)(s.Input,{placeholder:"00000-000",value:v.cep,onChange:e=>b("cep",e.target.value),className:"bg-black/40 border-white/10 rounded-xl text-sm font-mono",maxLength:9}),(0,a.jsx)(r.Button,{type:"button",onClick:C,disabled:f,className:"bg-indigo-600 hover:bg-indigo-500 rounded-xl px-3 shrink-0",children:f?(0,a.jsx)(o.Loader2,{size:14,className:"animate-spin"}):(0,a.jsx)(c.Search,{size:14})})]})]}),(0,a.jsxs)("div",{className:"grid grid-cols-3 gap-3",children:[(0,a.jsxs)("div",{className:"col-span-2 space-y-1",children:[(0,a.jsx)(n.Label,{className:"text-[10px] font-black uppercase text-slate-500 tracking-widest",children:"Logradouro *"}),(0,a.jsx)(s.Input,{value:v.logradouro,onChange:e=>b("logradouro",e.target.value),placeholder:"Rua / Av.",className:"bg-black/40 border-white/10 rounded-xl text-sm"})]}),(0,a.jsxs)("div",{className:"space-y-1",children:[(0,a.jsx)(n.Label,{className:"text-[10px] font-black uppercase text-slate-500 tracking-widest",children:"Número"}),(0,a.jsx)(s.Input,{value:v.numero,onChange:e=>b("numero",e.target.value),placeholder:"Nº",className:"bg-black/40 border-white/10 rounded-xl text-sm"})]})]}),(0,a.jsxs)("div",{className:"space-y-1",children:[(0,a.jsx)(n.Label,{className:"text-[10px] font-black uppercase text-slate-500 tracking-widest",children:"Complemento"}),(0,a.jsx)(s.Input,{value:v.complemento,onChange:e=>b("complemento",e.target.value),placeholder:"Apto, sala, bloco...",className:"bg-black/40 border-white/10 rounded-xl text-sm"})]}),(0,a.jsxs)("div",{className:"space-y-1",children:[(0,a.jsx)(n.Label,{className:"text-[10px] font-black uppercase text-slate-500 tracking-widest",children:"Bairro *"}),(0,a.jsx)(s.Input,{value:v.bairro,onChange:e=>b("bairro",e.target.value),className:"bg-black/40 border-white/10 rounded-xl text-sm"})]}),(0,a.jsxs)("div",{className:"grid grid-cols-3 gap-3",children:[(0,a.jsxs)("div",{className:"col-span-2 space-y-1",children:[(0,a.jsx)(n.Label,{className:"text-[10px] font-black uppercase text-slate-500 tracking-widest",children:"Cidade *"}),(0,a.jsx)(s.Input,{value:v.cidade,onChange:e=>b("cidade",e.target.value),className:"bg-black/40 border-white/10 rounded-xl text-sm"})]}),(0,a.jsxs)("div",{className:"space-y-1",children:[(0,a.jsx)(n.Label,{className:"text-[10px] font-black uppercase text-slate-500 tracking-widest",children:"UF *"}),(0,a.jsx)(s.Input,{value:v.uf,onChange:e=>b("uf",e.target.value.toUpperCase()),maxLength:2,className:"bg-black/40 border-white/10 rounded-xl text-sm uppercase"})]})]}),(0,a.jsxs)("div",{className:"flex gap-3 pt-2",children:[(0,a.jsx)(r.Button,{type:"button",variant:"ghost",onClick:m,className:"flex-1 border border-white/10 rounded-2xl text-slate-400 hover:text-white",children:"Cancelar"}),(0,a.jsx)(r.Button,{type:"button",onClick:function(){v.cep&&v.logradouro&&v.bairro&&v.cidade&&v.uf?(p(v),m()):d.toast.error("Preencha os campos obrigatórios do endereço")},className:"flex-1 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest text-xs",children:"Salvar Endereço"})]})]})]})})}e.s(["default",()=>m])}]);