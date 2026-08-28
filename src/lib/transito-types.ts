// Tipos TypeScript do JSON exportado por main.py (outputs/resultados.json)

export interface Meta {
  n_registros: number;
  n_features: number;
  n_train: number;
  n_test: number;
  target: string;
  classes: string[];
  random_state: number;
  test_size: number;
  hiperparams: {
    criterion: string;
    max_depth: number;
    min_samples_leaf: number;
    class_weight: string;
  };
  leakage_cols: string[];
  modelo_depth_real: number;
  modelo_n_leaves: number;
  arvore_png: string;
  matriz_png: string;
  importancia_png: string;
}

export interface KPIs {
  baseline_acc: number;
  model_acc_train: number;
  model_acc_test: number;
  gap_overfit: number;
  lift_acc_vs_baseline: number;
  recall_fatais: number;
  recall_feridos: number;
  recall_sem_vitimas: number;
  precision_fatais: number;
  f1_fatais: number;
  baseline_recall_fatais: number;
  lift_recall_fatais: number;
  taxa_global_fatais: number;
}

export interface MatrizConfusao {
  labels: string[];
  short_labels: string[];
  normalized: number[][];
  counts: number[][];
  support: number[];
}

export interface ClasseReport {
  classe: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ClassificationReport {
  por_classe: ClasseReport[];
  macro_avg: Record<string, number>;
  weighted_avg: Record<string, number>;
}

export interface HyperparametroRow {
  max_depth: number;
  min_samples_leaf: number;
  acc_train: number;
  acc_test: number;
  gap_overfit: number;
}

export interface ImportanciaRow {
  feature: string;
  importance: number;
  col_orig: string;
  valor: string | null;
}

export interface RecomendacaoCampanha {
  rank: number;
  feature: string;
  col_orig: string;
  valor: string;
  importancia: number;
  n_casos: number;
  pct_total: number;
  pct_fatais_grupo: number;
  lift_fatais: number;
  campanha: {
    tipo: string;
    publico: string;
    momento: string;
    canal: string;
  };
}

export interface DistItem {
  label: string;
  count: number;
}

export interface Distribuicoes {
  alvo: DistItem[];
  uf: DistItem[];
  mes: DistItem[];
  periodo_dia: DistItem[];
  fase_dia: DistItem[];
  causa_acidente: DistItem[];
  tipo_acidente: DistItem[];
  condicao_metereologica: DistItem[];
  tipo_pista: DistItem[];
  uso_solo: DistItem[];
  dia_semana: DistItem[];
  veiculos: DistItem[];
}

export interface ResultadosPayload {
  meta: Meta;
  kpis: KPIs;
  matriz_confusao: MatrizConfusao;
  classification_report: ClassificationReport;
  hiperparametros: HyperparametroRow[];
  importancias_top20: ImportanciaRow[];
  recomendacoes_top10: RecomendacaoCampanha[];
  distribuicoes: Distribuicoes;
}
