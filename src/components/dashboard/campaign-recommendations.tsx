'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RecomendacaoCampanha } from '@/lib/transito-types'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, Radio, Megaphone, TrendingUp } from 'lucide-react'

interface Props {
  recomendacoes: RecomendacaoCampanha[]
  taxaGlobalFatais: number
}

function liftColor(lift: number) {
  if (lift >= 2) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
  if (lift >= 1.5) return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-900'
  if (lift >= 1.1) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900'
  if (lift >= 0.9) return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200'
  return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
}

export function CampaignRecommendations({ recomendacoes, taxaGlobalFatais }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Recomendações de Campanha — Top 10 Atributos
        </CardTitle>
        <CardDescription>
          Cada bloco conecta um atributo de alta importância (do modelo treinado, não da frequência
          bruta) a uma campanha educativa concreta. <strong>Lift</strong> = taxa de fatais do grupo ÷
          taxa global ({(taxaGlobalFatais * 100).toFixed(2)}%). Lift {'>'} 1 = grupo super-representado em fatais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {recomendacoes.map((r) => (
            <div
              key={r.rank}
              className="rounded-lg border border-border/60 bg-background p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      #{r.rank}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {r.col_orig}
                      {r.valor && r.valor !== '(qualquer)' && (
                        <span className="font-mono"> = {r.valor.length > 30 ? r.valor.slice(0, 28) + '…' : r.valor}</span>
                      )}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold leading-tight">
                    {r.campanha.tipo}
                  </h3>
                </div>
                <Badge variant="outline" className={`shrink-0 ${liftColor(r.lift_fatais)}`}>
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  {r.lift_fatais.toFixed(2)}×
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <Stat label="Casos" value={r.n_casos.toLocaleString('pt-BR')} sub={`${r.pct_total.toFixed(1)}% do total`} />
                <Stat label="% Fatais" value={`${r.pct_fatais_grupo.toFixed(1)}%`} sub={`vs ${(taxaGlobalFatais * 100).toFixed(1)}% global`} />
                <Stat label="Importância" value={r.importancia.toFixed(3)} sub="ganho de info" />
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-start gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span><strong>Público:</strong> {r.campanha.publico}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span><strong>Momento:</strong> {r.campanha.momento}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span><strong>Canal:</strong> {r.campanha.canal}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  )
}
