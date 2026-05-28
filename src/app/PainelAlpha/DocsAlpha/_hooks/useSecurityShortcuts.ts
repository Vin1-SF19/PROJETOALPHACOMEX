'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function useSecurityShortcuts(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return

    const handleKey = async (e: KeyboardEvent) => {
      const isPrintKey = e.key === 'PrintScreen' || e.keyCode === 44
      const isForbiddenShortcut = e.ctrlKey && ['p', 'P', 's', 'S', 'c', 'C'].includes(e.key)
      const isSystemCapture = e.metaKey && e.shiftKey

      if (isPrintKey || isForbiddenShortcut || isSystemCapture) {
        e.preventDefault()
        try { await navigator.clipboard.writeText("ACESSO RESTRITO ALPHA") } catch { /* silent */ }
        toast.error("SEGURANÇA ALPHA", {
          description: "AÇÃO BLOQUEADA: CONTEÚDO RESTRITO",
          duration: 4000,
          style: { background: '#450a0a', border: '2px solid #ff0000', color: '#fff' },
        })
      }
    }

    const handleContext = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('keydown', handleKey)
    window.addEventListener('contextmenu', handleContext)

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('contextmenu', handleContext)
    }
  }, [ativo])
}
