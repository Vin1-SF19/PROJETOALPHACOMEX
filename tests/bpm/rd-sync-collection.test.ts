import { describe, expect, it, vi } from 'vitest';
import { coletarPaginasRd } from '../../scripts/sincronizar-rd-alpha.mjs';

describe('coleta completa de negócios RD',()=>{
  it('percorre cursor e exige o marcador final, preservando todas as identidades',async()=>{
    const request=vi.fn().mockResolvedValueOnce({has_more:true,next_page:'cursor-a',deals:[{id:'a'}]})
      .mockResolvedValueOnce({has_more:false,deals:[{id:'b'}]});
    expect(await coletarPaginasRd(request,'deals')).toEqual([{id:'a'},{id:'b'}]);
    expect(request.mock.calls[1][1]).toMatchObject({next_page:'cursor-a'});
  });
  it('não converte resposta curta sem marcador final em coleta completa',async()=>{
    const request=vi.fn().mockResolvedValue({deals:[{id:'a'}]});
    await expect(coletarPaginasRd(request,'deals')).rejects.toThrow('RD_DEALS_END_MARKER_REQUIRED');
  });
  it('bloqueia repetição de página em vez de duplicar ou interromper silenciosamente',async()=>{
    const request=vi.fn().mockResolvedValueOnce({has_more:true,next_page:'cursor-a',deals:[{id:'a'}]})
      .mockResolvedValueOnce({has_more:false,deals:[{id:'a'}]});
    await expect(coletarPaginasRd(request,'deals')).rejects.toThrow('RD_PAGE_REPEATED');
  });
  it('falha intermediária invalida a coleta mesmo após receber dados',async()=>{
    const request=vi.fn().mockResolvedValueOnce({has_more:true,next_page:'cursor-a',deals:[{id:'a'}]}).mockRejectedValueOnce(Error('RD_HTTP_429'));
    await expect(coletarPaginasRd(request,'deals')).rejects.toThrow('RD_HTTP_429');
  });
  it('bloqueia identidades duplicadas entre páginas parcialmente novas',async()=>{
    const request=vi.fn().mockResolvedValueOnce({has_more:true,next_page:'cursor-a',deals:[{id:'a'}]})
      .mockResolvedValueOnce({has_more:false,deals:[{id:'a'},{id:'b'}]});
    await expect(coletarPaginasRd(request,'deals')).rejects.toThrow('RD_ID_DUPLICATE');
  });
});
