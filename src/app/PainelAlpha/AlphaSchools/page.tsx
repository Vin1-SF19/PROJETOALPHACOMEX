'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import AlphaSchoolsWelcome from './AlphaSchoolsWelcome';
import SalaDeAulaAlpha from './SaladeAula';
import { getTema } from "@/lib/temas";
import { getPresetCompletoAction } from '@/actions/questoes';
import { buscarProgressosUsuario } from '@/actions/questoes';

type PresetCompleto = NonNullable<Awaited<ReturnType<typeof getPresetCompletoAction>>>;

export default function PaginaAlphaSchools() {
    const { data: session } = useSession();
    const [view, setView] = useState<'welcome' | 'sala'>('welcome');
    const [presetData, setPresetData] = useState<PresetCompleto | null>(null);
    const [idsAssistidos, setIdsAssistidos] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const temaNome = session?.user?.tema_interface || "blue";
    const style = getTema(temaNome);

    const entrarNaSala = async () => {
        const user = session?.user;
        const presetId = user?.presetId;

        const userId = Number(user?.id);
        if (presetId && Number.isInteger(userId) && userId > 0) {
            setLoading(true);
            const data = await getPresetCompletoAction(presetId);
            
            if (data) {
                const videoIds = data.videos?.map((v) => v.id) || [];
                const assistidos = await buscarProgressosUsuario(userId, videoIds);
                
                setIdsAssistidos(assistidos);
                setPresetData(data);
                setView('sala');
            }
            setLoading(false);
        }
    };

    if (view === 'sala' && presetData) {
        return (
            <SalaDeAulaAlpha
                preset={presetData}
                temaConfig={style}
                userId={session?.user?.id || ""}
                progressosIniciais={idsAssistidos}
                onVoltar={() => setView('welcome')}
            />
        );
    }

    return (
        <AlphaSchoolsWelcome onEnter={entrarNaSala} loading={loading} />
    );
}
