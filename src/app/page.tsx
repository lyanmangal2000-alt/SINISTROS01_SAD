'use client'

import { useEffect, useState } from 'react'
import { ResultadosPayload } from '@/lib/transito-types'
import { Hero } from '@/components/dashboard/hero'
import { ConfusionMatrixHeatmap } from '@/components/dashboard/confusion-matrix'
import { FeatureImportancesChart } from '@/components/dashboard/feature-importances'
import { CampaignRecommendations } from '@/components/dashboard/campaign-recommendations'
import { HyperparameterTable } from '@/components/dashboard/hyperparameter-table'
import { DistributionCharts } from '@/components/dashboard/distribution-charts'
import { ClassificationReportTable, DecisionTreePreview } from '@/components/dashboard/classification-tree'
import { DownloadProject } from '@/components/dashboard/download-project'
import { DownloadResultadosEsperados } from '@/components/dashboard/download-resultados-esperados'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldAlert, Database, GitBranch, FileText, ExternalLink, Github } from 'lucide-react'

export default function Home() {
  const [data, setData] = useState<ResultadosPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/data/resultados.json')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = (await r.json()) as ResultadosPayload
        setData(j)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-slate-100" />
          <p className="mt-3 text-sm text-muted-foreground">Carregando dashboard…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <Alert variant="destructive" className="max-w-lg">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar os resultados</AlertTitle>
          <AlertDescription>
            <p className="text-sm">Erro: {error}</p>
            <p className="mt-2 text-xs">
              Verifique se o arquivo <code className="font-mono">public/data/resultados.json</code> foi
              gerado. Para regerar: rode <code className="font-mono">python main.py</code> no projeto Python
              e copie <code className="font-mono">outputs/resultados.json</code> para{' '}
              <code className="font-mono">public/data/</code>.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-border/60 bg-background sticky top-0 z-30 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-red-600 to-orange-600 grid place-items-center text-white font-bold">
              🚦
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">
                Campanhas Educativas no Trânsito · Dashboard
              </h1>
              <p className="text-[10px] text-muted-foreground">
                Árvore de Decisão (entropy) · {data.meta.n_registros.toLocaleString('pt-BR')} sinistros PRF
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <a
              href="#hero"
              className="hidden sm:inline-flex items-center text-xs px-2 py-1 rounded hover:bg-accent"
            >
              Visão geral
            </a>
            <a
              href="#matriz"
              className="hidden sm:inline-flex items-center text-xs px-2 py-1 rounded hover:bg-accent"
            >
              Matriz
            </a>
            <a
              href="#atributos"
              className="hidden sm:inline-flex items-center text-xs px-2 py-1 rounded hover:bg-accent"
            >
              Atributos
            </a>
            <a
              href="#campanhas"
              className="hidden sm:inline-flex items-center text-xs px-2 py-1 rounded hover:bg-accent"
            >
              Campanhas
            </a>
            <a
              href="#baixar"
              className="inline-flex items-center text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 font-medium hover:bg-amber-200"
            >
              Baixar projeto
            </a>
            <a
              href="#metodo"
              className="hidden sm:inline-flex items-center text-xs px-2 py-1 rounded hover:bg-accent"
            >
              Método
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6 space-y-6">
        {/* 1. Hero com KPIs */}
        <section id="hero" className="scroll-mt-20">
          <Hero kpis={data.kpis} meta={data.meta} />
        </section>

        {/* 2. Matriz de confusão + classification report lado a lado */}
        <section id="matriz" className="grid gap-6 lg:grid-cols-2 scroll-mt-20">
          <ConfusionMatrixHeatmap matriz={data.matriz_confusao} />
          <ClassificationReportTable report={data.classification_report} />
        </section>

        {/* 3. Importância de atributos + Árvore */}
        <section id="atributos" className="grid gap-6 lg:grid-cols-2 scroll-mt-20">
          <FeatureImportancesChart importancias={data.importancias_top20} />
          <DecisionTreePreview src="/outputs/arvore_decisao.png" depth={data.meta.modelo_depth_real} />
        </section>

        {/* 4. Recomendações de campanha */}
        <section id="campanhas" className="scroll-mt-20">
          <CampaignRecommendations
            recomendacoes={data.recomendacoes_top10}
            taxaGlobalFatais={data.kpis.taxa_global_fatais}
          />
        </section>

        {/* 5. Distribuições da base */}
        <section className="scroll-mt-20">
          <DistributionCharts distribuicoes={data.distribuicoes} />
        </section>

        {/* 6. Hipertabela + anti-vazamento */}
        <section id="metodo" className="grid gap-6 lg:grid-cols-2 scroll-mt-20">
          <HyperparameterTable rows={data.hiperparametros} />
          <AntiLeakageCard
            leakageCols={data.meta.leakage_cols}
            nFeatures={data.meta.n_features}
            nRegistros={data.meta.n_registros}
          />
        </section>

        {/* 7. Baixar projeto — 2 arquivos */}
        <section id="baixar" className="scroll-mt-20 space-y-6">
          <DownloadProject />
          <DownloadResultadosEsperados />
        </section>

        {/* 8. Rodapé com metadados e ações */}
        <section className="grid gap-6 md:grid-cols-3 scroll-mt-20">
          <InfoCard
            icon={<Database className="h-4 w-4" />}
            title="Base de dados"
            body={
              <ul className="space-y-1 text-xs">
                <li><strong>Fonte:</strong> Polícia Rodoviária Federal</li>
                <li><strong>Período:</strong> 01/01–31/12/2025</li>
                <li><strong>Registros:</strong> {data.meta.n_registros.toLocaleString('pt-BR')}</li>
                <li><strong>Features após one-hot:</strong> {data.meta.n_features.toLocaleString('pt-BR')}</li>
                <li><strong>Split:</strong> {(1 - data.meta.test_size) * 100}% / {data.meta.test_size * 100}% estratificado</li>
                <li><strong>random_state:</strong> {data.meta.random_state}</li>
              </ul>
            }
          />
          <InfoCard
            icon={<GitBranch className="h-4 w-4" />}
            title="Decisões de modelagem"
            body={
              <ul className="space-y-1 text-xs">
                <li><strong>Algoritmo:</strong> DecisionTreeClassifier (entropy = ganho de informação)</li>
                <li><strong>max_depth:</strong> {data.meta.hiperparams.max_depth}</li>
                <li><strong>min_samples_leaf:</strong> {data.meta.hiperparams.min_samples_leaf}</li>
                <li><strong>class_weight:</strong> {data.meta.hiperparams.class_weight}</li>
                <li><strong>Folhas:</strong> {data.meta.modelo_n_leaves}</li>
                <li><strong>Baseline:</strong> DummyClassifier (most_frequent)</li>
              </ul>
            }
          />
          <InfoCard
            icon={<FileText className="h-4 w-4" />}
            title="Arquivos de origem"
            body={
              <ul className="space-y-1 text-xs">
                <li>
                  <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href="/outputs/matriz_confusao.png" download>
                    <ExternalLink className="h-3 w-3" /> matriz_confusao.png
                  </a>
                </li>
                <li>
                  <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href="/outputs/arvore_decisao.png" download>
                    <ExternalLink className="h-3 w-3" /> arvore_decisao.png
                  </a>
                </li>
                <li>
                  <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href="/outputs/importancia_atributos.png" download>
                    <ExternalLink className="h-3 w-3" /> importancia_atributos.png
                  </a>
                </li>
                <li>
                  <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href="/data/resultados.json" download>
                    <ExternalLink className="h-3 w-3" /> resultados.json (payload completo)
                  </a>
                </li>
              </ul>
            }
          />
        </section>
      </main>

      <footer className="mt-auto border-t border-border/60 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Gerado a partir do pipeline Python em <code className="font-mono">main.py</code>.
            Dados sintéticos para demonstração — substitua pelo <code className="font-mono">datatran2025.csv</code> real
            para análise oficial.
          </p>
          <p className="flex items-center gap-1">
            <Github className="h-3 w-3" />
            AV1 · Árvore de Decisão · 2025
          </p>
        </div>
      </footer>
    </div>
  )
}

function AntiLeakageCard({
  leakageCols,
  nFeatures,
  nRegistros,
}: {
  leakageCols: string[]
  nFeatures: number
  nRegistros: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          Anti-vazamento de dados
        </CardTitle>
        <CardDescription>
          Colunas de contagem pós-evento são a regra que gerou o rótulo — incluí-las em X produz ~100%
          de acurácia artificial. Bloqueadas por <code className="font-mono">assert</code> em <code className="font-mono">main.py</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3">
          <p className="text-xs text-amber-900 dark:text-amber-100 mb-2">
            As <strong>{leakageCols.length} colunas abaixo</strong> são derivadas do alvo e foram
            explicitamente excluídas do conjunto de features:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {leakageCols.map((col) => (
              <code
                key={col}
                className="font-mono text-[11px] bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-100"
              >
                {col}
              </code>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-border/40 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
          <span className="text-muted-foreground"># main.py (trecho)</span>
          <br />
          <span className="text-purple-700 dark:text-purple-300">LEAKAGE_COLS</span> = {`[`}<br />
          {'  '}&quot;pessoas&quot;, &quot;mortos&quot;, &quot;feridos_leves&quot;,<br />
          {'  '}&quot;feridos_graves&quot;, &quot;ilesos&quot;, &quot;ignorados&quot;,<br />
          {'  '}&quot;feridos&quot;<br />
          {`]`}
          <br /><br />
          <span className="text-red-700 dark:text-red-300 font-bold">assert</span>{' '}
          <span className="text-purple-700 dark:text-purple-300">not</span> set(LEAKAGE_COLS) &amp; set(X.columns),<br />
          {'  '}&quot;Coluna de vazamento presente em X!&quot;
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/40 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Features em X</div>
            <div className="text-sm font-semibold tabular-nums">{nFeatures.toLocaleString('pt-BR')}</div>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Registros</div>
            <div className="text-sm font-semibold tabular-nums">{nRegistros.toLocaleString('pt-BR')}</div>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Por que isso importa?</strong> Sem o assert, o modelo
          atingiria ~100% de acurácia apenas redescobrindo que &quot;se mortos ≥ 1 então fatais&quot; —
          sem revelar nenhum fator <em>acionável</em> para campanha educativa.
        </p>
      </CardContent>
    </Card>
  )
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{body}</CardContent>
    </Card>
  )
}
