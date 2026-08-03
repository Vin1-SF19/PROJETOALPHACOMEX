import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";

export type SomContainerPreset = ContainerCargaComponente["somAbertura"];

interface WindowComWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

type FonteAudio = AudioBufferSourceNode | OscillatorNode;

let contextoCompartilhado: AudioContext | null = null;

function obterContexto() {
  if (typeof window === "undefined") return null;
  if (contextoCompartilhado) return contextoCompartilhado;
  const AudioContextClass = window.AudioContext
    ?? (window as WindowComWebkitAudio).webkitAudioContext;
  contextoCompartilhado = AudioContextClass ? new AudioContextClass() : null;
  return contextoCompartilhado;
}

function contextoEstaRodando(contexto: AudioContext) {
  return contexto.state === "running";
}

/** Deve ser chamado diretamente por um clique/tecla do player para liberar o Web Audio. */
export async function desbloquearAudioContainer() {
  const contexto = obterContexto();
  if (!contexto) return false;
  if (contextoEstaRodando(contexto)) return true;
  try {
    await contexto.resume();
    return contextoEstaRodando(contexto);
  } catch {
    return false;
  }
}

function criarRuido(contexto: AudioContext, duracao: number) {
  const buffer = contexto.createBuffer(1, Math.ceil(contexto.sampleRate * duracao), contexto.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let index = 0; index < dados.length; index += 1) {
    dados[index] = Math.random() * 2 - 1;
  }
  const fonte = contexto.createBufferSource();
  fonte.buffer = buffer;
  return fonte;
}

function envelope(gain: GainNode, inicio: number, pico: number, fim: number, volume: number) {
  gain.gain.setValueAtTime(0.0001, inicio);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), pico);
  gain.gain.exponentialRampToValueAtTime(0.0001, fim);
}

function agendarIndustrial(contexto: AudioContext, volume: number, fontes: FonteAudio[]) {
  const agora = contexto.currentTime + 0.02;
  const ruido = criarRuido(contexto, 1.65);
  const filtro = contexto.createBiquadFilter();
  const ganhoRuido = contexto.createGain();
  filtro.type = "lowpass";
  filtro.frequency.setValueAtTime(1300, agora);
  filtro.frequency.exponentialRampToValueAtTime(170, agora + 1.5);
  envelope(ganhoRuido, agora, agora + 0.08, agora + 1.62, volume * 0.4);
  ruido.connect(filtro).connect(ganhoRuido).connect(contexto.destination);
  ruido.start(agora);
  ruido.stop(agora + 1.65);
  fontes.push(ruido);

  const motor = contexto.createOscillator();
  const ganhoMotor = contexto.createGain();
  motor.type = "sawtooth";
  motor.frequency.setValueAtTime(82, agora);
  motor.frequency.exponentialRampToValueAtTime(43, agora + 1.25);
  envelope(ganhoMotor, agora, agora + 0.05, agora + 1.3, volume * 0.22);
  motor.connect(ganhoMotor).connect(contexto.destination);
  motor.start(agora);
  motor.stop(agora + 1.32);
  fontes.push(motor);

  [0.18, 0.48].forEach((atraso, index) => {
    const impacto = contexto.createOscillator();
    const ganhoImpacto = contexto.createGain();
    impacto.type = "triangle";
    impacto.frequency.setValueAtTime(index === 0 ? 620 : 460, agora + atraso);
    impacto.frequency.exponentialRampToValueAtTime(95, agora + atraso + 0.18);
    envelope(ganhoImpacto, agora + atraso, agora + atraso + 0.012, agora + atraso + 0.2, volume * 0.34);
    impacto.connect(ganhoImpacto).connect(contexto.destination);
    impacto.start(agora + atraso);
    impacto.stop(agora + atraso + 0.22);
    fontes.push(impacto);
  });
}

function agendarHidraulico(contexto: AudioContext, volume: number, fontes: FonteAudio[]) {
  const agora = contexto.currentTime + 0.02;
  const ruido = criarRuido(contexto, 1.9);
  const filtro = contexto.createBiquadFilter();
  const ganhoRuido = contexto.createGain();
  filtro.type = "bandpass";
  filtro.Q.value = 0.8;
  filtro.frequency.setValueAtTime(2600, agora);
  filtro.frequency.exponentialRampToValueAtTime(420, agora + 1.75);
  envelope(ganhoRuido, agora, agora + 0.12, agora + 1.88, volume * 0.3);
  ruido.connect(filtro).connect(ganhoRuido).connect(contexto.destination);
  ruido.start(agora);
  ruido.stop(agora + 1.9);
  fontes.push(ruido);

  const pressao = contexto.createOscillator();
  const ganhoPressao = contexto.createGain();
  pressao.type = "sine";
  pressao.frequency.setValueAtTime(150, agora);
  pressao.frequency.exponentialRampToValueAtTime(54, agora + 1.7);
  envelope(ganhoPressao, agora, agora + 0.18, agora + 1.78, volume * 0.25);
  pressao.connect(ganhoPressao).connect(contexto.destination);
  pressao.start(agora);
  pressao.stop(agora + 1.8);
  fontes.push(pressao);

  const trava = contexto.createOscillator();
  const ganhoTrava = contexto.createGain();
  trava.type = "square";
  trava.frequency.setValueAtTime(760, agora + 0.12);
  trava.frequency.exponentialRampToValueAtTime(180, agora + 0.22);
  envelope(ganhoTrava, agora + 0.12, agora + 0.125, agora + 0.24, volume * 0.2);
  trava.connect(ganhoTrava).connect(contexto.destination);
  trava.start(agora + 0.12);
  trava.stop(agora + 0.25);
  fontes.push(trava);
}

/** Sons procedurais locais: não carregam arquivo externo e podem ser interrompidos no unmount. */
export function tocarSomAberturaContainer(preset: SomContainerPreset, volume: number) {
  const contexto = obterContexto();
  const fontes: FonteAudio[] = [];
  let cancelado = false;

  const agendar = () => {
    if (cancelado || !contexto) return;
    if (preset === "hidraulico") agendarHidraulico(contexto, volume, fontes);
    else agendarIndustrial(contexto, volume, fontes);
  };

  if (contexto && contexto.state !== "running") {
    void desbloquearAudioContainer().then((liberado) => {
      if (liberado) agendar();
    });
  } else {
    agendar();
  }

  return () => {
    cancelado = true;
    fontes.forEach((fonte) => {
      try {
        fonte.stop();
      } catch {
        // Fonte já finalizada.
      }
    });
  };
}
