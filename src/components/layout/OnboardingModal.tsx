'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, PlayCircle, Lock } from 'lucide-react';

interface OnboardingModalProps {
  video: { url: string; titulo: string };
  onDone: () => void;
}

// Libera o botão quando o usuário assistiu quase tudo
const WATCH_THRESHOLD = 0.9;

export default function OnboardingModal({ video, onDone }: OnboardingModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canMark, setCanMark] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const ratio = el.currentTime / el.duration;
    setProgress(ratio);
    if (ratio >= WATCH_THRESHOLD) setCanMark(true);
  };

  const handleMark = async () => {
    if (!canMark || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/marcar-visto', { method: 'POST' });
      if (!res.ok) throw new Error();
      onDone();
    } catch {
      setError('Não consegui registrar. Tente novamente.');
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(2, 6, 23, 0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col max-h-full"
        style={{ background: '#0a1020', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
          <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <PlayCircle size={18} style={{ color: '#a5b4fc' }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-black truncate" style={{ color: '#f1f5f9' }}>{video.titulo || 'Introdução ao IAlpha'}</h2>
            <p className="text-[11px] flex items-center gap-1" style={{ color: '#8fa3bc' }}>
              <Lock size={10} /> Vídeo obrigatório para liberar o painel
            </p>
          </div>
        </div>

        {/* Vídeo */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="rounded-2xl overflow-hidden bg-black" style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
            <video
              ref={videoRef}
              src={video.url}
              controls
              controlsList="nodownload"
              onContextMenu={e => e.preventDefault()}
              onTimeUpdate={onTimeUpdate}
              onEnded={() => setCanMark(true)}
              className="w-full max-h-[55vh] bg-black"
            />
          </div>

          {/* Barra de progresso de visualização */}
          <div className="mt-3">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,45,74,0.7)' }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.min(progress * 100, 100)}%`, background: canMark ? '#22c55e' : '#6366f1' }}
              />
            </div>
            <p className="text-[10.5px] mt-1.5" style={{ color: canMark ? '#6ee7b7' : '#6b7fa0' }}>
              {canMark ? 'Vídeo assistido — você já pode liberar o painel.' : 'Assista o vídeo até o final para liberar o botão.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0 flex items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(99,102,241,0.15)' }}>
          {error
            ? <span className="text-[11px]" style={{ color: '#fca5a5' }}>{error}</span>
            : <span className="text-[11px]" style={{ color: '#5a7090' }}>Esta mensagem não aparecerá novamente.</span>}
          <button
            onClick={handleMark}
            disabled={!canMark || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12.5px] font-black uppercase tracking-wider transition-all active:scale-[0.98] disabled:cursor-not-allowed shrink-0"
            style={{
              background: canMark ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'rgba(30,45,74,0.6)',
              color: canMark ? '#fff' : '#475569',
              border: `1px solid ${canMark ? 'rgba(34,197,94,0.5)' : 'rgba(99,102,241,0.15)'}`,
              boxShadow: canMark ? '0 4px 16px rgba(22,163,74,0.4)' : 'none',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Marcar como visto
          </button>
        </div>
      </div>
    </div>
  );
}
