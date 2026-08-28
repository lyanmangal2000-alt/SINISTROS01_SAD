'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { KPIs, Meta } from '@/lib/transito-types'
import {
  Activity,
  AlertTriangle,
  Target,
  TrendingDown,
  TrendingUp,
  Scale,
  Crosshair,
} from 'lucide-react'

interface Props {
  kpis: KPIs
  meta: Meta
}

function pct(v: number, digits = 1) {
  return `${(v * 100).toFixed(digits)}%`
}

function sign(v: number, digits = 3) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`
}

export function Hero({ kpis, meta }: Props) {
  const accDelta = kpis.model_acc_test - kpis.baseline_acc
  const recallLift = kpis.recall_fatais - kpis.baseline_recall_fatais
  const classes: Record<string, { label: string; tone: string }> = {
    'Com Vítimas Fatais': { label: 'Fatais', tone: 'bg-red-100 text-red-800 border-red-300' },
    'Com Vítimas Feridas': { label: 'Feridos', tone: 'bg-amber-100 text-amber-800 border-amber-300' },
    'Sem Vítimas': { label: 'Sem Vítimas', tone: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  }

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Painel de Apoio à Decisão · AV1
            </p>
            <CardTitle className="mt-1 text-2xl md:text-3xl leading-tight">
              Campanhas Educativas no Trânsito
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
              Árvore de Decisão com <span className="font-mono">criterion=&quot;entropy&quot;</span> sobre
              {' '}{meta.n_registros.toLocaleString('pt-BR')} sinistros em rodovias federais — priorizando
              atributos associados à ocorrência de vítimas fatais.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {meta.classes.map((c) => (
              <Badge key={c} variant="outline" className={classes[c]?.tone}>
                {c}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <KpiCard
            icon={<Target className="h-4 w-4" />}
            label="Acurácia — Teste"
            value={pct(kpis.model_acc_test)}
            sub={`Baseline ${pct(kpis.baseline_acc)}`}
            delta={accDelta}
            deltaLabel="vs baseline"
            hintNegative
          />
          <KpiCard
            icon={<Crosshair className="h-4 w-4" />}
            label="Recall — Fatais"
            value={pct(kpis.recall_fatais)}
            sub={`Baseline ${pct(kpis.baseline_recall_fatais)}`}
            delta={recallLift}
            deltaLabel="lift vs baseline"
            tone={kpis.recall_fatais >= 0.4 ? 'good' : 'warn'}
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Lift Fatais (×)"
            value={`${kpis.recall_fatais > 0 ? (kpis.recall_fatais / Math.max(kpis.baseline_recall_fatais, 0.001)).toFixed(1) : '—'}×`}
            sub={`Recall ${pct(kpis.recall_fatais)}`}
            tone="good"
          />
          <KpiCard
            icon={<Scale className="h-4 w-4" />}
            label="Precisão — Fatais"
            value={pct(kpis.precision_fatais)}
            sub={`F1 ${kpis.f1_fatais.toFixed(3)}`}
          />
          <KpiCard
            icon={<Activity className="h-4 w-4" />}
            label="Recall — Sem Vítimas"
            value={pct(kpis.recall_sem_vitimas)}
            sub={`Recall Feridos ${pct(kpis.recall_feridos)}`}
          />
          <KpiCard
            icon={<TrendingDown className="h-4 w-4" />}
            label="Gap Overfitting"
            value={sign(kpis.gap_overfit, 3)}
            sub="treino − teste"
            tone={kpis.gap_overfit < 0.1 ? 'good' : 'warn'}
          />
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MiniStat label="Registros" value={meta.n_registros.toLocaleString('pt-BR')} />
          <MiniStat label="Treino / Teste" value={`${meta.n_train.toLocaleString('pt-BR')} / ${meta.n_test.toLocaleString('pt-BR')}`} />
          <MiniStat label="Features (após one-hot)" value={meta.n_features.toLocaleString('pt-BR')} />
          <MiniStat label="Folhas da árvore" value={meta.modelo_n_leaves.toString()} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 text-xs text-muted-foreground">
          <div>
            <span className="font-mono">criterion=&quot;entropy&quot;</span> · ganho de informação (ID3/C4.5)
          </div>
          <div>
            <span className="font-mono">max_depth={meta.hiperparams.max_depth}</span> ·{' '}
            <span className="font-mono">min_samples_leaf={meta.hiperparams.min_samples_leaf}</span>
          </div>
          <div>
            <span className="font-mono">class_weight=&quot;balanced&quot;</span> · repondera 77,5/15,4/7,2%
          </div>
          <div>
            <span className="font-mono">random_state={meta.random_state}</span> · split estratificado {pct(1 - meta.test_size, 0)}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200">
          <strong>Por que a acurácia cai vs. baseline?</strong> Com <code className="font-mono">class_weight=&quot;balanced&quot;</code>,
          o modelo sacrifica acurácia global para subir o <strong>recall da classe minoritária (Fatais)</strong> —
          essa é a métrica que importa para políticas públicas. O <strong>ganho real</strong> é o lift de recall fatais ({pct(kpis.recall_fatais)} vs {pct(kpis.baseline_recall_fatais)}).
        </div>
      </CardContent>
    </Card>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  delta,
  deltaLabel,
  tone,
  hintNegative,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  delta?: number
  deltaLabel?: string
  tone?: 'good' | 'warn' | 'bad'
  hintNegative?: boolean
}) {
  const toneColor =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
      ? 'text-amber-600'
      : tone === 'bad'
      ? 'text-red-600'
      : ''

  let deltaColor = ''
  let deltaIcon: React.ReactNode = null
  if (delta !== undefined) {
    const isGood = hintNegative ? delta > 0 : delta > 0
    deltaColor = isGood ? 'text-emerald-600' : 'text-red-600'
    deltaIcon = isGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background p-3 transition-colors hover:bg-accent/30">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${toneColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      {delta !== undefined && (
        <div className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${deltaColor}`}>
          {deltaIcon}
          <span>{delta >= 0 ? '+' : ''}{delta.toFixed(3)}</span>
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
