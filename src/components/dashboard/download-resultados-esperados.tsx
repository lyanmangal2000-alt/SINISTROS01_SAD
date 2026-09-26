'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RESULTADOS_ESPERADOS_CONTENT, RESULTADOS_ESPERADOS_SIZE } from '@/lib/resultados-esperados'
import { Download, FileText, Copy, Check } from 'lucide-react'

function downloadBlob(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function DownloadResultadosEsperados() {
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const handleDownload = () => {
    downloadBlob(RESULTADOS_ESPERADOS_CONTENT, 'RESULTADOS_ESPERADOS.md', 'text/markdown; charset=utf-8')
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(RESULTADOS_ESPERADOS_CONTENT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const lines = RESULTADOS_ESPERADOS_CONTENT.split('\n').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-600" />
          ARQUIVO 2 — Resultados Esperados (download separado)
        </CardTitle>
        <CardDescription>
          Documento didático com a simulação dos resultados esperados pela pipeline.
          Disponibilizado separadamente do projeto principal conforme solicitado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3">
          <FileText className="h-5 w-5 text-amber-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-medium">RESULTADOS_ESPERADOS.md</code>
              <Badge variant="outline" className="text-[10px]">markdown</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {(RESULTADOS_ESPERADOS_SIZE / 1024).toFixed(1)} KB · {lines} linhas
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <><Check className="h-3 w-3 text-green-600" /> Copiado</>
              ) : (
                <><Copy className="h-3 w-3" /> Copiar</>
              )}
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleDownload}
            >
              {downloaded ? (
                <><Check className="h-3 w-3" /> Baixado</>
              ) : (
                <><Download className="h-3 w-3" /> Baixar</>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-muted-foreground">
          <strong>Conteúdo:</strong> simulação didática dos resultados (acurácia baseline ~0,775,
          árvore ~0,58–0,62 com <code className="font-mono">class_weight=&quot;balanced&quot;</code>),
          explicação de que o ganho real é no <em>recall de fatais</em>, não na acurácia global,
          tabela esperada do grid 3×3 de hiperparâmetros, e matriz de confusão esperada.
        </div>

        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-900 dark:text-blue-200">
          <strong>Como usar:</strong> este arquivo está disponível <em>separadamente</em> do projeto principal.
          Baixe-o e inclua no repositório GitHub apenas se quiser documentar publicamente a simulação
          didática. Se preferir manter apenas a documentação técnica, ignore este download.
        </div>
      </CardContent>
    </Card>
  )
}
