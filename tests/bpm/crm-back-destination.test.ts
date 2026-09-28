import { describe, expect, it } from 'vitest';
import { getCrmBackDestination } from '@/app/PainelAlpha/AlphaCRM/crm-back-destination';

describe('retorno das páginas internas do CRM', () => {
  const home = '/PainelAlpha/AlphaCRM';

  it('não mostra botão de voltar na Home', () => {
    expect(getCrmBackDestination(home)).toBeNull();
    expect(getCrmBackDestination(`${home}/`)).toBeNull();
  });

  it('volta de páginas e pipelines para a Home', () => {
    for (const path of [`${home}/tarefas`, `${home}/pendencias`, `${home}/pipeline/123`, `${home}/pipelines`, `${home}/empresa/123`, `${home}/admin`]) {
      expect(getCrmBackDestination(path)).toBe(home);
    }
  });

  it('volta das páginas internas de configuração para Configurações', () => {
    for (const path of [`${home}/admin/checklists`, `${home}/admin/pipelines/123`, `${home}/admin/regras/`]) {
      expect(getCrmBackDestination(path)).toBe(`${home}/admin`);
    }
  });
});
