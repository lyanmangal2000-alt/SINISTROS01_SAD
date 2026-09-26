'use client'

import { useState } from 'react'
import JSZip from 'jszip'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PROJETO_FILES, PROJETO_TOTAL_SIZE } from '@/lib/projeto-files'
import { Download, Copy, Check, FileCode, Archive, FolderDown } from 'lucide-react'

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

function getMime(name: string) {
  if (name.endsWith('.py')) return 'text/x-python; charset=utf-8'
  if (name.endsWith('.md')) return 'text/markdown; charset=utf-8'
  return 'text/plain; charset=utf-8'
}

export function DownloadProject() {
  const [copied, setCopied] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  const [downloaded, setDownloaded] = useState<string | null>(null)

  const handleCopy = async (name: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(name)
      setTimeout(() => setCopied(null), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDownloadOne = (name: string, content: string) => {
    downloadBlob(content, name, getMime(name))
    setDownloaded(name)
    setTimeout(() => setDownloaded(null), 2000)
  }

  const handleDownloadZip = async () => {
    setZipping(true)
    try {
      const zip = new JSZip()
      const folder = zip.folder('campanha-transito-arvore-decisao')!
      for (const file of PROJETO_FILES) {
        folder.file(file.name, file.content)
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'campanha-transito-arvore-decisao.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setZipping(false)
    }
  }

  const handleDownloadAll = async () => {
    // Baixa cada arquivo individualmente com pequeno delay
    for (const file of PROJETO_FILES) {
      handleDownloadOne(file.name, file.content)
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  return (
    <Card id="baixar-projeto" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderDown className="h-5 w-5" />
          Baixar arquivos do projeto
        </CardTitle>
        <CardDescription>
          Baixe o projeto Python completo para rodar no VS Code. Como o gateway bloqueia
          downloads estáticos, os arquivos são gerados no seu navegador (client-side) e
          baixados diretamente para sua pasta de Downloads.
          <br />
          <strong>{PROJETO_FILES.length} arquivos</strong> · {(PROJETO_TOTAL_SIZE / 1024).toFixed(1)} KB total
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={handleDownloadZip} disabled={zipping} className="gap-2">
            <Archive className="h-4 w-4" />
            {zipping ? 'Gerando ZIP...' : 'Baixar tudo como ZIP'}
          </Button>
          <Button onClick={handleDownloadAll} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Baixar arquivos separados
          </Button>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {PROJETO_FILES.map((file) => {
            const size = (file.content.length / 1024).toFixed(1)
            const lines = file.content.split('\n').length
            return (
              <div
                key={file.name}
                className="flex items-center gap-3 rounded-md border border-border/60 p-3 bg-background hover:bg-accent/30 transition-colors"
              >
                <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono font-medium">{file.name}</code>
                    <Badge variant="outline" className="text-[10px]">{file.language}</Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {size} KB · {lines} linhas
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs"
                    onClick={() => handleCopy(file.name, file.content)}
                    title="Copiar conteúdo"
                  >
                    {copied === file.name ? (
                      <><Check className="h-3 w-3 text-green-600" /> Copiado</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copiar</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs"
                    onClick={() => handleDownloadOne(file.name, file.content)}
                    title="Baixar arquivo"
                  >
                    {downloaded === file.name ? (
                      <><Check className="h-3 w-3 text-green-600" /> OK</>
                    ) : (
                      <><Download className="h-3 w-3" /> Baixar</>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-900 dark:text-blue-200">
          <strong>Como usar:</strong>
          <ol className="mt-1 ml-4 list-decimal space-y-1">
            <li>Clique em <em>"Baixar tudo como ZIP"</em> acima (recomendado)</li>
            <li>Abra o arquivo ZIP baixado e descompacte numa pasta sem espaços no nome (ex.: <code>C:\projetos\campanha-transito-arvore-decisao</code>)</li>
            <li>Abra essa pasta no VS Code (<code>File → Open Folder</code>)</li>
            <li>Siga as instruções do arquivo <code>COMO_RODAR_VSCODE.md</code> dentro do projeto</li>
          </ol>
        </div>

        <div className="mt-3 text-[11px] text-muted-foreground">
          Os 9 arquivos do projeto (sem <code>datatran2025.csv</code> — esse você baixa da PRF).
          Para gerar dados sintéticos e testar o pipeline, rode <code>python gerar_dados_sinteticos.py</code> depois.
        </div>
      </CardContent>
    </Card>
  )
}
