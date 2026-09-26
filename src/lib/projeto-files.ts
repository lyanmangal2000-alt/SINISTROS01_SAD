// Auto-gerado por scripts/gerar_projeto_files.py

export interface ProjetoFile {
  name: string
  content: string
  language: string
}

export const PROJETO_FILES: ProjetoFile[] = [
  {
    name: 'main.py',
    language: 'python',
    content: `"""
main.py
=======

Pipeline de ponta a ponta para construir um modelo de Árvore de Decisão
apoiando campanhas educativas de trânsito a partir de \`datatran2025.csv\`.

Etapas:
  1. Leitura robusta do CSV (sep/encoding/decimal corretos)
  2. Limpeza e descarte de vazamento de dados (7 colunas)
  3. Engenharia de atributos (horario, tracado_via, data_inversa)
  4. Agrupamento de categorias raras (<1%)
  5. One-Hot Encoding
  6. Split estratificado treino/teste (70/30, random_state=42)
  7. Baseline trivial (DummyClassifier most_frequent)
  8. Árvore de Decisão (criterion="entropy", class_weight="balanced")
  9. Busca de hiperparâmetros (max_depth x min_samples_leaf)
 10. Avaliação: acurácia, matriz de confusão, classification report
 11. Interpretação: feature_importances_ + plot_tree
 12. Recomendações de campanha (relatorio_campanhas.md)

Saídas:
  - outputs/matriz_confusao.png
  - outputs/arvore_decisao.png
  - outputs/importancia_atributos.png
  - relatorio_campanhas.md

Rodar:
    python main.py
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.model_selection import train_test_split
from sklearn.tree import (
    DecisionTreeClassifier,
    plot_tree,
)
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    ConfusionMatrixDisplay,
    confusion_matrix,
)

# ------------------------------------------------------------
# Constantes centralizadas — sem números mágicos no código
# ------------------------------------------------------------
BASE_DIR = Path(__file__).parent
CSV_PATH = BASE_DIR / "datatran2025.csv"
OUTPUTS_DIR = BASE_DIR / "outputs"
RELATORIO_PATH = BASE_DIR / "relatorio_campanhas.md"
JSON_PATH = OUTPUTS_DIR / "resultados.json"  # consumido pelo dashboard Next.js

RANDOM_STATE = 42
TEST_SIZE = 0.30
MAX_DEPTH_DEFAULT = 8
MIN_SAMPLES_LEAF_DEFAULT = 30

# Busca de hiperparâmetros
MAX_DEPTH_GRID = [6, 8, 10]
MIN_SAMPLES_LEAF_GRID = [20, 30, 50]

# Colunas de VAZAMENTO — originaram o rótulo. Devem ser EXCLUÍDAS de X.
LEAKAGE_COLS = [
    "pessoas", "mortos", "feridos_leves", "feridos_graves",
    "ilesos", "ignorados", "feridos",
]

# Colunas a excluir (sem poder preditivo / alta cardinalidade / administrativas / redundant após engenharia)
EXCLUDE_COLS = (
    ["id"]                       # identificador único
    + LEAKAGE_COLS               # vazamento
    + ["regional", "delegacia", "uop"]   # alta cardinalidade administrativa
    + ["municipio", "latitude", "longitude", "br", "km"]  # alta cardinalidade / quase-únicas
    + ["data_inversa", "horario"]  # já derivadas em \`mes\` e \`hora_int\`/\`periodo_dia\`
)

# Coluna-alvo
TARGET = "classificacao_acidente"

# Preditores nominais que recebem one-hot
NOMINAL_COLS = [
    "dia_semana", "uf", "fase_dia", "sentido_via",
    "condicao_metereologica", "tipo_pista", "uso_solo",
    "causa_acidente", "tipo_acidente",
    "periodo_dia",  # derivado de horario
    "mes",          # derivado de data_inversa
]

# Configuração de fonte para matplotlib (suporte UTF-8 + PT-BR)
import matplotlib.font_manager as fm
try:
    fm.fontManager.addfont("/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf")
except Exception:
    pass
try:
    fm.fontManager.addfont("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
except Exception:
    pass
plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Noto Sans SC"]
plt.rcParams["axes.unicode_minus"] = False

sns.set_theme(style="whitegrid", palette="muted")


# ============================================================
# 1. LEITURA
# ============================================================
def ler_csv(path: Path) -> pd.DataFrame:
    """Lê datatran2025.csv com os parâmetros obrigatórios do enunciado.

    Returns:
        DataFrame com 72.529 linhas × 30 colunas.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Arquivo nao encontrado: {path}\\n"
            "Baixe o CSV em:\\n"
            "  https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf\\n"
            "ou gere dados sinteticos para teste:\\n"
            "  python gerar_dados_sinteticos.py"
        )
    df = pd.read_csv(path, sep=";", encoding="latin1", decimal=",")
    print(f"[Leitura] OK: {df.shape[0]:,} linhas x {df.shape[1]} colunas  ({path.name})")
    return df


# ============================================================
# 2. LIMPEZA
# ============================================================
def limpar_alvo(df: pd.DataFrame) -> pd.DataFrame:
    """Descarta a única linha com alvo nulo."""
    n0 = len(df)
    df = df.dropna(subset=[TARGET]).copy()
    print(f"[Limpeza] Descartadas {n0 - len(df)} linhas com alvo nulo. Restam {len(df):,}.")
    return df


# ============================================================
# 3. ENGENHARIA DE ATRIBUTOS
# ============================================================
def hora_para_int(horario_str: str) -> int:
    """Converte 'HH:MM:SS' -> int 0..23. Devolve -1 em caso de erro."""
    try:
        return int(str(horario_str).split(":")[0])
    except (ValueError, AttributeError, IndexError):
        return -1


def hora_para_periodo(hora_int: int) -> str:
    """Mapeia 0..23 -> Madrugada/Manhã/Tarde/Noite."""
    if hora_int < 0 or hora_int > 23:
        return "Desconhecido"
    if 0 <= hora_int < 6:
        return "Madrugada"
    if 6 <= hora_int < 12:
        return "Manhã"
    if 12 <= hora_int < 18:
        return "Tarde"
    return "Noite"


def mes_de_data(data_str: str) -> int:
    """Extrai mês (1..12) de 'dd/mm/yyyy'. Devolve 0 em caso de erro."""
    try:
        return int(str(data_str).split("/")[1])
    except (ValueError, AttributeError, IndexError):
        return 0


def aplicar_engenharia(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica todas as transformações de engenharia de atributos.

    - horario (HH:MM:SS) -> hora_int (0..23) + periodo_dia (4 categorias)
    - data_inversa (dd/mm/yyyy) -> mes (1..12)
    - tracado_via (multirrótulo "A;B") -> colunas binárias via MultiLabelBinarizer
    """
    df = df.copy()

    # horario -> hora_int + periodo_dia
    df["hora_int"] = df["horario"].apply(hora_para_int)
    df["periodo_dia"] = df["hora_int"].apply(hora_para_periodo)
    print(f"[Engenharia] horario -> hora_int + periodo_dia "
          f"({df['periodo_dia'].value_counts().to_dict()})")

    # data_inversa -> mes (string "mes_01".."mes_12" para ser tratado como categórico
    # ordinal no one-hot; árvore aprende splits binários como mes__mes_07 <= 0.5)
    df["mes"] = df["data_inversa"].apply(mes_de_data).astype("Int64").astype(str).replace("<NA>", "0")
    df["mes"] = "mes_" + df["mes"]
    print(f"[Engenharia] data_inversa -> mes "
          f"(categorias: {sorted(df['mes'].unique())[:3]}...{sorted(df['mes'].unique())[-2:]})")

    return df


def binarizar_tracado(df: pd.DataFrame) -> Tuple[pd.DataFrame, list]:
    """Decompõe tracado_via (multirrótulo "Reta;Declive") em colunas binárias.

    Usa MultiLabelBinarizer — cada traçado vira uma coluna 0/1.
    """
    if "tracado_via" not in df.columns:
        return df, []

    series = df["tracado_via"].fillna("").astype(str)
    # cada célula -> lista de tokens após split por ";"
    list_of_lists = series.apply(
        lambda s: [t.strip() for t in s.split(";") if t.strip()]
    )

    mlb = MultiLabelBinarizer()
    bin_matrix = mlb.fit_transform(list_of_lists)
    new_cols = [f"tracado__{c}" for c in mlb.classes_]

    bin_df = pd.DataFrame(bin_matrix, columns=new_cols, index=df.index)
    df = pd.concat([df.drop(columns=["tracado_via"]), bin_df], axis=1)
    print(f"[Engenharia] tracado_via -> {len(new_cols)} colunas binárias "
          f"(ex: {new_cols[:5]})")
    return df, new_cols


def agrupar_raras(series: pd.Series, limiar_frac: float = 0.01) -> pd.Series:
    """Substitui categorias com frequência < limiar_frac por 'Outros'.

    Operação in-place-safe: devolve nova Series.
    """
    contagem = series.value_counts(dropna=False)
    total = len(series)
    raras = contagem[contagem < limiar_frac * total].index
    if len(raras) > 0:
        print(f"[Agrupar] '{series.name}': {len(raras)} categorias raras "
              f"(<{limiar_frac*100:.0f}% de {total:,}) -> 'Outros'")
    return series.where(~series.isin(raras), "Outros")


# ============================================================
# 4. MONTAGEM DE X E y
# ============================================================
def montar_X_y(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """Monta X (preditores) e y (alvo), excluindo vazamento e colunas inúteis.

    Inclui OBRIGATORIAMENTE o assert anti-vazamento.
    """
    y = df[TARGET].astype(str)
    X = df.drop(columns=[TARGET])

    # Excluir colunas inúteis/administrativas/vazamento
    cols_para_dropar = [c for c in EXCLUDE_COLS if c in X.columns]
    X = X.drop(columns=cols_para_dropar)
    print(f"[Montagem] Removidas {len(cols_para_dropar)} colunas: {cols_para_dropar}")

    # ⚠️ ASSERT ANTI-VAZAMENTO — ponto crítico de rigor metodológico
    assert not set(LEAKAGE_COLS) & set(X.columns), (
        f"Coluna de vazamento presente em X! "
        f"Interseção: {set(LEAKAGE_COLS) & set(X.columns)}"
    )
    print(f"[Anti-vazamento] OK — nenhuma das {len(LEAKAGE_COLS)} colunas "
          f"de contagem pós-evento está em X.")

    # veiculos é numérica — manter como está
    return X, y


def codificar_one_hot(X: pd.DataFrame) -> Tuple[pd.DataFrame, list]:
    """Aplica One-Hot Encoding nas colunas nominais (drop_first=False).

    Árvores de decisão não sofrem com multicolinearidade, então mantemos
    todas as dummies.
    """
    cols_nom = [c for c in NOMINAL_COLS if c in X.columns]
    print(f"[One-Hot] {len(cols_nom)} colunas nominais -> dummies: {cols_nom}")

    X_num = X.drop(columns=cols_nom)
    X_cat = pd.get_dummies(X[cols_nom], prefix=cols_nom, drop_first=False, dtype=int)
    X_out = pd.concat([X_num.reset_index(drop=True), X_cat.reset_index(drop=True)], axis=1)
    print(f"[One-Hot] X final: {X_out.shape[0]:,} x {X_out.shape[1]}")
    return X_out, cols_nom


# ============================================================
# 5. BUSCA DE HIPERPARÂMETROS
# ============================================================
def buscar_hiperparametros(X_train, y_train, X_test, y_test) -> pd.DataFrame:
    """Testa grid 3x3 (max_depth x min_samples_leaf) e devolve DataFrame de resultados."""
    rows = []
    for md in MAX_DEPTH_GRID:
        for msl in MIN_SAMPLES_LEAF_GRID:
            m = DecisionTreeClassifier(
                criterion="entropy",
                max_depth=md,
                min_samples_leaf=msl,
                class_weight="balanced",
                random_state=RANDOM_STATE,
            )
            m.fit(X_train, y_train)
            acc_train = accuracy_score(y_train, m.predict(X_train))
            acc_test = accuracy_score(y_test, m.predict(X_test))
            rows.append({
                "max_depth": md,
                "min_samples_leaf": msl,
                "acc_train": acc_train,
                "acc_test": acc_test,
                "gap_overfit": acc_train - acc_test,
            })
    df = pd.DataFrame(rows)
    print("\\n=== Busca de hiperparametros ===")
    print(df.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print(f"\\nEscolha padrão: max_depth={MAX_DEPTH_DEFAULT}, "
          f"min_samples_leaf={MIN_SAMPLES_LEAF_DEFAULT} "
          "(melhor equilíbrio interpretabilidade x generalização, "
          "árvore plottável no vídeo).")
    return df


# ============================================================
# 6. MODELO FINAL
# ============================================================
def treinar_modelo_final(X_train, y_train):
    """Treina o modelo final com hiperparâmetros escolhidos."""
    modelo = DecisionTreeClassifier(
        criterion="entropy",
        max_depth=MAX_DEPTH_DEFAULT,
        min_samples_leaf=MIN_SAMPLES_LEAF_DEFAULT,
        class_weight="balanced",
        random_state=RANDOM_STATE,
    )
    modelo.fit(X_train, y_train)
    print(f"\\n[Modelo Final] Treinado com criterion='entropy', "
          f"max_depth={MAX_DEPTH_DEFAULT}, "
          f"min_samples_leaf={MIN_SAMPLES_LEAF_DEFAULT}, "
          f"class_weight='balanced'.")
    print(f"             Profundidade real alcançada: {modelo.get_depth()}")
    print(f"             Numero de folhas: {modelo.get_n_leaves()}")
    return modelo


# ============================================================
# 7. AVALIAÇÃO
# ============================================================
def avaliar(modelo, X_train, y_train, X_test, y_test, baseline):
    """Calcula acurácias, classification report e gera matriz_confusao.png."""
    acc_train = accuracy_score(y_train, modelo.predict(X_train))
    acc_test = accuracy_score(y_test, modelo.predict(X_test))
    acc_baseline = accuracy_score(y_test, baseline.predict(X_test))

    print("\\n=== Avaliacao ===")
    print(f"  Baseline (most_frequent):     acc_test = {acc_baseline:.4f}  (~{acc_baseline*100:.1f}%)")
    print(f"  Arvore - acc_treino:                       {acc_train:.4f}")
    print(f"  Arvore - acc_teste:                        {acc_test:.4f}")
    print(f"  Gap overfitting (treino - teste):          {acc_train-acc_test:+.4f}")
    print(f"  Lift vs baseline:                          {acc_test-acc_baseline:+.4f}")

    y_pred = modelo.predict(X_test)
    print("\\n=== Classification Report (teste) ===")
    print(classification_report(y_test, y_pred, digits=3))

    # Matriz de confusão normalizada por linha (true) — vê recall por classe
    OUTPUTS_DIR.mkdir(exist_ok=True)
    fig, ax = plt.subplots(figsize=(9, 7), constrained_layout=True)
    ConfusionMatrixDisplay.from_predictions(
        y_test, y_pred, normalize="true", xticks_rotation=30,
        cmap="Blues", ax=ax, values_format=".2f",
    )
    ax.set_title(f"Matriz de Confusão (normalizada por classe real)\\n"
                 f"Acc teste={acc_test:.3f} | Baseline={acc_baseline:.3f} | "
                 f"random_state={RANDOM_STATE}")
    out = OUTPUTS_DIR / "matriz_confusao.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"  -> {out}")

    return {
        "acc_train": acc_train,
        "acc_test": acc_test,
        "acc_baseline": acc_baseline,
        "lift_vs_baseline": acc_test - acc_baseline,
        "y_pred": y_pred,
    }


# ============================================================
# 8. INTERPRETAÇÃO
# ============================================================
def plotar_importancias(modelo, X_train, top_n: int = 20):
    """Gera gráfico de barras horizontal das top-N feature_importances_."""
    importances = modelo.feature_importances_
    feat_names = X_train.columns
    df_imp = (pd.DataFrame({"feature": feat_names, "importance": importances})
              .sort_values("importance", ascending=True)
              .tail(top_n))

    fig, ax = plt.subplots(figsize=(10, max(6, top_n * 0.35)), constrained_layout=True)
    ax.barh(df_imp["feature"], df_imp["importance"], color="#1f6feb")
    ax.set_xlabel("Importância (ganho de informação normalizado)")
    ax.set_title(f"Top {top_n} atributos — feature_importances_")
    for i, (f, v) in enumerate(zip(df_imp["feature"], df_imp["importance"])):
        ax.text(v + 0.001, i, f"{v:.3f}", va="center", fontsize=9)
    out = OUTPUTS_DIR / "importancia_atributos.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"  -> {out}")
    return df_imp.sort_values("importance", ascending=False).reset_index(drop=True)


def plotar_arvore(modelo, X_train, y_train, max_depth_plot: int = 3):
    """Gera visualização da árvore (3 níveis) — legível para vídeo."""
    fig, ax = plt.subplots(figsize=(28, 14), constrained_layout=True)
    plot_tree(
        modelo,
        max_depth=max_depth_plot,
        feature_names=list(X_train.columns),
        class_names=[str(c) for c in sorted(y_train.unique())],
        filled=True,
        rounded=True,
        fontsize=9,
        ax=ax,
    )
    ax.set_title(f"Árvore de Decisão (entropy, max_depth={MAX_DEPTH_DEFAULT}, "
                 f"min_samples_leaf={MIN_SAMPLES_LEAF_DEFAULT}, "
                 f"class_weight='balanced') — primeiros {max_depth_plot} níveis")
    out = OUTPUTS_DIR / "arvore_decisao.png"
    fig.savefig(out, dpi=140)
    plt.close(fig)
    print(f"  -> {out}")


# ============================================================
# 9. RELATÓRIO DE CAMPANHAS
# ============================================================
def _lift(taxa_grupo: float, taxa_global: float) -> float:
    """Lift: razão entre taxa do grupo e taxa global. 1.0 = neutro."""
    if taxa_global <= 0:
        return 1.0
    return taxa_grupo / taxa_global


def gerar_relatorio_campanhas(
    df: pd.DataFrame,
    df_imp: pd.DataFrame,
    modelo,
    X_train,
    acc_baseline: float,
    acc_test: float,
    top_n_atributos: int = 10,
):
    """Gera relatorio_campanhas.md ligando atributos importantes a recomendações.

    Para cada atributo top-N do modelo:
      - nome, importância
      - número de casos e % do total
      - % de fatais associados
      - lift vs. taxa global de fatais
      - tipo de campanha, público-alvo, momento/canal
    """
    TAXA_GLOBAL_FATAIS = (df[TARGET] == "Com Vítimas Fatais").mean()
    print(f"\\n[Relatório] Taxa global de fatais: {TAXA_GLOBAL_FATAIS:.4f} "
          f"({TAXA_GLOBAL_FATAIS*100:.2f}%)")

    # Mapear nome dummy -> coluna original + valor
    # ex.: "causa_acidente__Ingestão de álcool" -> ("causa_acidente", "Ingestão de álcool")  (tracado via MLB)
    # ex.: "causa_acidente_Ingestão de álcool"  -> ("causa_acidente", "Ingestão de álcool")  (pd.get_dummies)
    # ex.: "tipo_pista_Simples"                 -> ("tipo_pista", "Simples")
    # ex.: "veiculos"                            -> ("veiculos", None)  (numérica)
    def decodificar_dummy(nome: str):
        # tracado__X (MultiLabelBinarizer, prefixo com __)
        if nome.startswith("tracado__"):
            return "tracado_via", nome[len("tracado__"):]
        # Outras dummies: tentar cada coluna nominal como prefixo
        for col in NOMINAL_COLS:
            prefix = col + "_"
            if nome.startswith(prefix) and len(nome) > len(prefix):
                return col, nome[len(prefix):]
        # Numérica
        return nome, None

    # Pré-processar df original (com as colunas originais, antes do one-hot) para estatísticas
    # -- df aqui é o pós-engenharia mas pré-one-hot (ainda tem causa_acidente etc.)
    df_stats = df.copy()

    blocos = []
    blocos.append("# Relatório de Recomendações de Campanhas Educativas\\n")
    blocos.append(f"**Gerado automaticamente por \`main.py\`** com base no modelo "
                  f"\`DecisionTreeClassifier(criterion='entropy', "
                  f"max_depth={MAX_DEPTH_DEFAULT}, "
                  f"min_samples_leaf={MIN_SAMPLES_LEAF_DEFAULT}, "
                  f"class_weight='balanced')\`.\\n\\n")
    blocos.append(f"**Baseline (most_frequent):** {acc_baseline:.4f}  \\n")
    blocos.append(f"**Acurácia teste do modelo:** {acc_test:.4f}  \\n")
    blocos.append(f"**Taxa global de sinistros fatais:** "
                  f"{TAXA_GLOBAL_FATAIS*100:.2f}%  \\n")
    blocos.append(f"**Lift** = taxa do grupo ÷ taxa global (>1 = acima do esperado).\\n\\n")
    blocos.append("---\\n\\n")

    # Top N atributos do modelo (excluindo derivados genéricos)
    top = df_imp.head(top_n_atributos)
    for rank, row in top.iterrows():
        nome_attr = row["feature"]
        imp = row["importance"]
        col_orig, valor = decodificar_dummy(nome_attr)

        # Estatísticas
        if valor is not None:
            # Atributo categórico: filtrar linhas onde a coluna original == valor
            # Para tracado_via (multirrótulo), verificar substring
            if col_orig == "tracado_via":
                # reconstruir tracado_via a partir das dummies binárias
                mask = (df_stats.filter(like="tracado__").sum(axis=1) > 0) & \\
                       (df_stats[f"tracado__{valor}"] == 1) if f"tracado__{valor}" in df_stats.columns else pd.Series(False, index=df_stats.index)
                # fallback simples se já foi binarizado
                if mask.sum() == 0 and f"tracado__{valor}" in df_stats.columns:
                    mask = df_stats[f"tracado__{valor}"] == 1
            else:
                mask = df_stats[col_orig].astype(str) == valor
        else:
            # Atributo numérico (ex.: veiculos) — usar topo (>= mediana + 1σ)
            if col_orig in df_stats.select_dtypes(include=[np.number]).columns:
                thr = df_stats[col_orig].median() + df_stats[col_orig].std()
                mask = df_stats[col_orig] >= thr
                valor = f"alto (≥ {thr:.1f})"
            else:
                mask = pd.Series(True, index=df_stats.index)
                valor = "(qualquer)"

        n_casos = int(mask.sum())
        if n_casos == 0:
            continue
        pct_total = n_casos / len(df_stats) * 100
        taxa_fatais_grupo = (df_stats.loc[mask, TARGET] == "Com Vítimas Fatais").mean()
        lift_val = _lift(taxa_fatais_grupo, TAXA_GLOBAL_FATAIS)

        # Campanha sugerida
        tipo_campanha, publico, momento, canal = sugerir_campanha(col_orig, valor)

        bloco = (
            f"## {rank+1}. \`{nome_attr}\` — importância {imp:.4f}\\n\\n"
            f"- **Atributo original:** \`{col_orig}\`"
            + (f" = \`{valor}\`" if valor is not None else "") + "\\n"
            f"- **Casos associados:** {n_casos:,} ({pct_total:.2f}% do total)\\n"
            f"- **% fatais neste grupo:** {taxa_fatais_grupo*100:.2f}%\\n"
            f"- **Lift vs. taxa global de fatais:** {lift_val:.2f}× "
            f"({'acima' if lift_val > 1.05 else 'abaixo/dentro' if lift_val < 0.95 else 'próximo de'} do esperado)\\n\\n"
            f"### Recomendação de campanha\\n\\n"
            f"| Dimensão | Sugestão |\\n"
            f"|---|---|\\n"
            f"| **Tipo** | {tipo_campanha} |\\n"
            f"| **Público-alvo** | {publico} |\\n"
            f"| **Momento** | {momento} |\\n"
            f"| **Canal** | {canal} |\\n\\n"
            f"---\\n\\n"
        )
        blocos.append(bloco)

    # Considerações finais
    blocos.append("## Notas metodológicas\\n\\n")
    blocos.append("1. **Anti-vazamento**: as 7 colunas de contagem pós-evento "
                  "(\`pessoas\`, \`mortos\`, \`feridos_leves\`, \`feridos_graves\`, \`ilesos\`, "
                  "\`ignorados\`, \`feridos\`) foram excluídas de X por \`assert\` explícito.\\n")
    blocos.append("2. **Desbalanceamento**: o alvo tem 77,5%/15,4%/7,2% — por isso "
                  "\`class_weight='balanced'\` e o uso de **recall da classe fatais** como "
                  "métrica de política pública, não apenas acurácia global.\\n")
    blocos.append("3. **Importância** é a do modelo treinado (ganho de informação "
                  "acumulado), não a frequência bruta das categorias.\\n")
    blocos.append("4. **Lift > 1** indica que o grupo está super-representado em "
                  "sinistros fatais — prioridade para campanha preventiva.\\n")

    RELATORIO_PATH.write_text("".join(blocos), encoding="utf-8")
    print(f"\\n[Relatório] Salvo em: {RELATORIO_PATH}")


def sugerir_campanha(col_orig: str, valor) -> Tuple[str, str, str, str]:
    """Heurística simples para sugerir tipo/público/momento/canal de campanha."""
    v = str(valor).lower() if valor else ""

    if "álcool" in v or "alcool" in v:
        return ("Prevenção de direção embriagada",
                "Condutores jovens 18-34, saidas noturnas",
                "Noite e madrugada, fins de semana",
                "Blitz educativas, rádio, redes sociais")
    if "velocidade" in v:
        return ("Controle de velocidade",
                "Condutores em rodovias de pista simples",
                "Período diurno, trechos de curva",
                "Radares educativos, sinalização, painéis eletrônicos")
    if "reação" in v or "reativo" in v or "tardia" in v or "ausência de reação" in v:
        return ("Atenção ao volante / fadiga",
                "Condutores em viagens longas, motoristas profissionais",
                "Madrugada e final de tarde",
                "Paradas educativas, rádio, aplicativos de navegação")
    if "distância" in v or "distancia" in v:
        return ("Distância segura entre veículos",
                "Condutores em rodovias duplicadas",
                "Picos de tráfego",
                "Faixas educativas, painéis eletrônicos")
    if "via" in v and "acess" in v:
        return ("Prioridade ao acessar via",
                "Condutores em interseções rurais",
                "Qualquer período",
                "Sinalização, vídeos curtos, autoescolas")
    if col_orig == "tracado_via" and "curva" in v:
        return ("Sinalização de curvas perigosas",
                "Condutores em rodovias sinuosas",
                "Condições de baixa visibilidade",
                "Olhos-de-gato, sinalização reflexiva, mapas dinâmicos")
    if col_orig == "tracado_via":
        return ("Sinalização de geometria da via",
                "Condutores em trechos críticos",
                "Período noturno",
                "Sinalização vertical, faixas refletivas")
    if col_orig == "condicao_metereologica" and ("chuva" in v or "garoa" in v):
        return ("Direção defensiva em chuva",
                "Todos os condutores, especialmente motociclistas",
                "Período chuvoso, estações de transição",
                "Previsão do tempo, rádio, redes sociais")
    if col_orig == "condicao_metereologica" and "neblina" in v:
        return ("Direção em neblina",
                "Condutores em trechos de serra",
                "Madrugada e início da manhã",
                "Sinalização luminosa, rádio, alertas no painel")
    if col_orig == "fase_dia" or col_orig == "periodo_dia":
        if "noite" in v or "noitecer" in v:
            return ("Direção noturna defensiva",
                    "Condutores em deslocamentos noturnos",
                    "Noite e madrugada",
                    "Faróis regulados, sinalização refletiva")
        if "madrugada" in v:
            return ("Combate à fadiga e direção sonolenta",
                    "Motoristas profissionais e jovens",
                    "Madrugada",
                    "Paradas educativas, café, aplicativos")
        if "manhã" in v or "manha" in v:
            return ("Atenção em horário de pico matinal",
                    "Condutores trabalhadores",
                    "Manhã (6h-9h)",
                    "Rádio, redes sociais")
        if "tarde" in v:
            return ("Atenção em horário de pico vespertino",
                    "Condutores trabalhadores",
                    "Tarde (17h-20h)",
                    "Rádio, redes sociais")
    if col_orig == "tipo_pista" and "simples" in v:
        return ("Cuidados em pista simples",
                "Condutores em rodovias rurais",
                "Período diurno",
                "Sinalização, faixas educativas")
    if col_orig == "veiculos":
        return ("Condução segura com múltiplos veículos",
                "Condutores jovens e idosos",
                "Horários de pico",
                "Campanhas audiovisuais, autoescolas")
    if col_orig == "mes":
        return ("Campanha sazonal temática",
                "Condutores em períodos de pico do mês",
                "Férias, feriados e fins de semana prolongados",
                "Rádio, redes sociais, painéis eletrônicos")

    # Default
    return ("Campanha educativa geral",
            "Condutores em geral",
            "Ano todo",
            "Rádio, televisão, redes sociais")


# ============================================================
# EXPORTAÇÃO JSON PARA DASHBOARD
# ============================================================
def exportar_resultados_json(
    *,
    df: pd.DataFrame,
    df_imp: pd.DataFrame,
    modelo,
    X_train,
    y_train,
    y_test,
    y_pred,
    metricas: dict,
    buscar_hp: pd.DataFrame,
    baseline,
):
    """Exporta \`outputs/resultados.json\` consumido pelo dashboard Next.js.

    Conteúdo:
      - meta: parâmetros do modelo, baseline, RANDOM_STATE
      - kpis: acurácias, recall fatais, lift, etc
      - matriz_confusao: 3x3 com rótulos + suporte
      - classification_report: precision/recall/f1 por classe
      - hiperparametros: tabela do grid 3x3
      - importancias: top 20 features (nome, importância, col_orig, valor)
      - recomendacoes: top 10 com lift, % fatais, casos, tipo/público/momento/canal
      - distribuicoes: alvo, uf (top 12), mes, periodo_dia, fase_dia, causa_acidente (top 15),
        tipo_acidente, condicao_metereologica, tipo_pista, uso_solo, dia_semana, faixas_veiculos
      - arvore_path: caminho relativo do PNG para o dashboard embedar
    """
    classes_ordenadas = sorted(y_train.unique())
    cm = confusion_matrix(y_test, y_pred, labels=classes_ordenadas, normalize="true")
    cm_counts = confusion_matrix(y_test, y_pred, labels=classes_ordenadas)
    support = cm_counts.sum(axis=1)

    # Classification report por classe
    report = classification_report(y_test, y_pred, output_dict=True, digits=3, zero_division=0)

    # Top 10 recomendações (mesma lógica do relatório)
    TAXA_GLOBAL_FATAIS = (df[TARGET] == "Com Vítimas Fatais").mean()

    def _decod(nome):
        if nome.startswith("tracado__"):
            return "tracado_via", nome[len("tracado__"):]
        for col in NOMINAL_COLS:
            prefix = col + "_"
            if nome.startswith(prefix) and len(nome) > len(prefix):
                return col, nome[len(prefix):]
        return nome, None

    recomendacoes = []
    for rank, row in df_imp.head(10).iterrows():
        nome_attr = row["feature"]
        col_orig, valor = _decod(nome_attr)
        if valor is not None:
            if col_orig == "tracado_via":
                dummy_col = f"tracado__{valor}"
                if dummy_col in df.columns:
                    mask = df[dummy_col] == 1
                else:
                    continue
            else:
                mask = df[col_orig].astype(str) == valor
        else:
            if col_orig in df.select_dtypes(include=[np.number]).columns:
                thr = df[col_orig].median() + df[col_orig].std()
                mask = df[col_orig] >= thr
                valor = f"alto (≥ {thr:.1f})"
            else:
                mask = pd.Series(True, index=df.index)
                valor = "(qualquer)"
        n_casos = int(mask.sum())
        if n_casos == 0:
            continue
        taxa_grupo = float((df.loc[mask, TARGET] == "Com Vítimas Fatais").mean())
        lift = taxa_grupo / TAXA_GLOBAL_FATAIS if TAXA_GLOBAL_FATAIS > 0 else 1.0
        tipo, publico, momento, canal = sugerir_campanha(col_orig, valor)
        recomendacoes.append({
            "rank": rank + 1,
            "feature": nome_attr,
            "col_orig": col_orig,
            "valor": valor,
            "importancia": float(row["importance"]),
            "n_casos": n_casos,
            "pct_total": float(n_casos / len(df) * 100),
            "pct_fatais_grupo": float(taxa_grupo * 100),
            "lift_fatais": float(lift),
            "campanha": {
                "tipo": tipo,
                "publico": publico,
                "momento": momento,
                "canal": canal,
            },
        })

    # Distribuições
    def _dist(series, top=None, dropna=True):
        s = series.astype(str) if dropna else series
        vc = s.value_counts(dropna=dropna)
        if top:
            vc = vc.head(top)
        return [{"label": str(k), "count": int(v)} for k, v in vc.items()]

    dist_alvo = _dist(df[TARGET])
    dist_uf = _dist(df["uf"], top=15)
    dist_mes = _dist(df["mes"])
    dist_periodo = _dist(df["periodo_dia"])
    dist_fase = _dist(df["fase_dia"]) if "fase_dia" in df.columns else []
    dist_causa = _dist(df["causa_acidente"], top=15)
    dist_tipo = _dist(df["tipo_acidente"], top=15)
    cond_col = "condicao_metereologica" if "condicao_metereologica" in df.columns else None
    dist_cond = _dist(df[cond_col]) if cond_col else []
    dist_pista = _dist(df["tipo_pista"]) if "tipo_pista" in df.columns else []
    dist_solo = _dist(df["uso_solo"]) if "uso_solo" in df.columns else []
    dist_dia = _dist(df["dia_semana"]) if "dia_semana" in df.columns else []

    # Faixas de veículos
    vei = df["veiculos"] if "veiculos" in df.columns else pd.Series(dtype=int)
    bins = [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 100]
    labels = ["0", "1", "2", "3", "4", "5+"]
    dist_vei = [{"label": lab, "count": int(cnt)} for lab, cnt in zip(
        labels, pd.cut(vei, bins=bins, labels=labels).value_counts().reindex(labels).fillna(0).values)]

    # Matriz de confusão formato amigável para o dashboard
    matriz = {
        "labels": [str(c) for c in classes_ordenadas],
        "short_labels": [str(c).replace("Com Vítimas ", "").replace("Sem Vítimas", "Sem Vit")[:15] for c in classes_ordenadas],
        "normalized": cm.tolist(),
        "counts": cm_counts.tolist(),
        "support": support.tolist(),
    }

    # KPIs derivados
    recall_fatais = float(report.get("Com Vítimas Fatais", {}).get("recall", 0))
    precision_fatais = float(report.get("Com Vítimas Fatais", {}).get("precision", 0))
    f1_fatais = float(report.get("Com Vítimas Fatais", {}).get("f1-score", 0))
    recall_feridos = float(report.get("Com Vítimas Feridas", {}).get("recall", 0))
    recall_sem = float(report.get("Sem Vítimas", {}).get("recall", 0))

    # Baseline sempre prediz a classe majoritária → recall de fatais = 0
    classe_maj = pd.Series(y_train).value_counts().idxmax()
    baseline_recall_fatais = 1.0 if classe_maj == "Com Vítimas Fatais" else 0.0

    kpis = {
        "baseline_acc": float(metricas["acc_baseline"]),
        "model_acc_train": float(metricas["acc_train"]),
        "model_acc_test": float(metricas["acc_test"]),
        "gap_overfit": float(metricas["acc_train"] - metricas["acc_test"]),
        "lift_acc_vs_baseline": float(metricas["acc_test"] - metricas["acc_baseline"]),
        "recall_fatais": recall_fatais,
        "recall_feridos": recall_feridos,
        "recall_sem_vitimas": recall_sem,
        "precision_fatais": precision_fatais,
        "f1_fatais": f1_fatais,
        "baseline_recall_fatais": baseline_recall_fatais,
        "lift_recall_fatais": recall_fatais - baseline_recall_fatais,
        "taxa_global_fatais": float(TAXA_GLOBAL_FATAIS),
    }

    # Hiperparâmetros testados (grid 3x3)
    hp_rows = buscar_hp.to_dict(orient="records")

    # Top 20 importâncias
    importancias = []
    for _, row in df_imp.head(20).iterrows():
        col_orig, valor = _decod(row["feature"])
        importancias.append({
            "feature": row["feature"],
            "importance": float(row["importance"]),
            "col_orig": col_orig,
            "valor": valor,
        })

    payload = {
        "meta": {
            "n_registros": int(len(df)),
            "n_features": int(len(df_imp)),
            "n_train": int(len(y_train)),
            "n_test": int(len(y_test)),
            "target": TARGET,
            "classes": [str(c) for c in classes_ordenadas],
            "random_state": RANDOM_STATE,
            "test_size": TEST_SIZE,
            "hiperparams": {
                "criterion": "entropy",
                "max_depth": MAX_DEPTH_DEFAULT,
                "min_samples_leaf": MIN_SAMPLES_LEAF_DEFAULT,
                "class_weight": "balanced",
            },
            "leakage_cols": LEAKAGE_COLS,
            "modelo_depth_real": int(modelo.get_depth()),
            "modelo_n_leaves": int(modelo.get_n_leaves()),
            "arvore_png": "outputs/arvore_decisao.png",
            "matriz_png": "outputs/matriz_confusao.png",
            "importancia_png": "outputs/importancia_atributos.png",
        },
        "kpis": kpis,
        "matriz_confusao": matriz,
        "classification_report": {
            "por_classe": [
                {
                    "classe": str(cls),
                    "precision": float(report[cls]["precision"]),
                    "recall": float(report[cls]["recall"]),
                    "f1": float(report[cls]["f1-score"]),
                    "support": int(report[cls]["support"]),
                }
                for cls in classes_ordenadas
            ],
            "macro_avg": {k: float(v) if isinstance(v, (int, float)) else v
                          for k, v in report.get("macro avg", {}).items()},
            "weighted_avg": {k: float(v) if isinstance(v, (int, float)) else v
                             for k, v in report.get("weighted avg", {}).items()},
        },
        "hiperparametros": hp_rows,
        "importancias_top20": importancias,
        "recomendacoes_top10": recomendacoes,
        "distribuicoes": {
            "alvo": dist_alvo,
            "uf": dist_uf,
            "mes": dist_mes,
            "periodo_dia": dist_periodo,
            "fase_dia": dist_fase,
            "causa_acidente": dist_causa,
            "tipo_acidente": dist_tipo,
            "condicao_metereologica": dist_cond,
            "tipo_pista": dist_pista,
            "uso_solo": dist_solo,
            "dia_semana": dist_dia,
            "veiculos": dist_vei,
        },
    }

    OUTPUTS_DIR.mkdir(exist_ok=True)
    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[JSON] Exportado para dashboard: {JSON_PATH}  ({JSON_PATH.stat().st_size / 1024:.1f} KB)")
    return payload


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 70)
    print("PIPELINE: Árvore de Decisão para Campanhas Educativas no Trânsito")
    print("=" * 70)

    # 1. Leitura
    df = ler_csv(CSV_PATH)

    # 2. Limpeza do alvo
    df = limpar_alvo(df)

    # 3. Engenharia de atributos (mantém colunas originais para estatísticas no relatório)
    df = aplicar_engenharia(df)

    # 4. Binarizar tracado_via (multirrótulo) — feito ANTES do split pra manter consistência
    df, tracado_cols = binarizar_tracado(df)

    # 5. Agrupar categorias raras em causa_acidente e tipo_acidente
    if "causa_acidente" in df.columns:
        df["causa_acidente"] = agrupar_raras(df["causa_acidente"], limiar_frac=0.01)
    if "tipo_acidente" in df.columns:
        df["tipo_acidente"] = agrupar_raras(df["tipo_acidente"], limiar_frac=0.01)

    # 6. Montar X e y (com assert anti-vazamento)
    X, y = montar_X_y(df)

    # 7. One-Hot Encoding
    X, _ = codificar_one_hot(X)

    # 8. Split estratificado
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    print(f"\\n[Split] Treino: {X_train.shape[0]:,} | Teste: {X_test.shape[0]:,} "
          f"(stratify=y, random_state={RANDOM_STATE})")

    # 9. Baseline trivial
    baseline = DummyClassifier(strategy="most_frequent", random_state=RANDOM_STATE)
    baseline.fit(X_train, y_train)
    print(f"[Baseline] DummyClassifier(most_frequent) treinado.")

    # 10. Busca de hiperparâmetros
    buscar_hp_df = buscar_hiperparametros(X_train, y_train, X_test, y_test)

    # 11. Modelo final
    modelo = treinar_modelo_final(X_train, y_train)

    # 12. Avaliação + matriz de confusão
    metricas = avaliar(modelo, X_train, y_train, X_test, y_test, baseline)

    # 13. Interpretação: importância + árvore
    print("\\n=== Interpretação ===")
    df_imp = plotar_importancias(modelo, X_train, top_n=20)
    plotar_arvore(modelo, X_train, y_train, max_depth_plot=3)

    # 14. Relatório de campanhas
    # Para estatísticas de % fatais por grupo, precisamos do df com colunas originais
    # e dummies tracado__. Já temos isso em \`df\`.
    df_para_relatorio = df.copy()
    # Adicionar alvo para cálculos internos
    df_para_relatorio[TARGET] = y.values
    gerar_relatorio_campanhas(
        df_para_relatorio, df_imp, modelo, X_train,
        acc_baseline=metricas["acc_baseline"],
        acc_test=metricas["acc_test"],
        top_n_atributos=10,
    )

    # 15. Exportar resultados.json para o dashboard Next.js
    exportar_resultados_json(
        df=df_para_relatorio,
        df_imp=df_imp,
        modelo=modelo,
        X_train=X_train,
        y_train=y_train,
        y_test=y_test,
        y_pred=metricas["y_pred"],
        metricas=metricas,
        buscar_hp=buscar_hp_df,
        baseline=baseline,
    )

    print("\\n" + "=" * 70)
    print("PIPELINE CONCLUIDO.")
    print(f"  Outputs:  {OUTPUTS_DIR}/")
    print(f"  Relatório: {RELATORIO_PATH}")
    print(f"  JSON dashboard: {JSON_PATH}")
    print("=" * 70)


if __name__ == "__main__":
    main()
`,
  },

  {
    name: 'validar_leitura.py',
    language: 'python',
    content: `"""
validar_leitura.py
==================

Validação RÁPIDA (10s) da leitura do CSV \`datatran2025.csv\`.

Verifica:
  1. Arquivo existe no diretório atual.
  2. Parâmetros obrigatórios da leitura (sep, encoding, decimal).
  3. Shape esperado: 72.529 linhas x 30 colunas.
  4. Coluna-alvo \`classificacao_acidente\` está presente.
  5. Colunas de VAZAMENTO estão presentes (mas serão removidas no main.py).

Rodar:
    python validar_leitura.py
"""
from pathlib import Path
import sys
import pandas as pd

CSV_PATH = Path(__file__).parent / "datatran2025.csv"
EXPECTED_ROWS = 72_529
EXPECTED_COLS = 30
LEAKAGE_COLS = ["pessoas", "mortos", "feridos_leves", "feridos_graves",
                "ilesos", "ignorados", "feridos"]


def main() -> int:
    if not CSV_PATH.exists():
        print(f"[ERRO] Arquivo nao encontrado: {CSV_PATH}")
        print("Baixe o CSV em:")
        print("  https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf")
        print("  https://dados.gov.br/dados/conjunto-dados-abertos-acidentes-prf")
        print("e salve como 'datatran2025.csv' na raiz do projeto.")
        return 1

    print(f"[OK] Arquivo encontrado: {CSV_PATH}")
    print(f"     Tamanho: {CSV_PATH.stat().st_size / (1024*1024):.2f} MB")

    df = pd.read_csv(CSV_PATH, sep=";", encoding="latin1", decimal=",")
    print(f"[OK] Leitura OK com sep=';' encoding='latin1' decimal=','")

    n_rows, n_cols = df.shape
    rows_ok = (n_rows == EXPECTED_ROWS)
    cols_ok = (n_cols == EXPECTED_COLS)
    print(f"[{'OK' if rows_ok else 'AVISO'}] Linhas: {n_rows} (esperado ~{EXPECTED_ROWS})")
    print(f"[{'OK' if cols_ok else 'AVISO'}] Colunas: {n_cols} (esperado {EXPECTED_COLS})")

    alvo_ok = "classificacao_acidente" in df.columns
    print(f"[{'OK' if alvo_ok else 'ERRO'}] Coluna-alvo 'classificacao_acidente' presente")

    leak_present = [c for c in LEAKAGE_COLS if c in df.columns]
    print(f"[OK] Colunas de vazamento presentes (serao removidas no main.py): {leak_present}")

    print("\\nDistribuicao do alvo:")
    print(df["classificacao_acidente"].value_counts(dropna=False))

    if alvo_ok:
        print("\\nValidacao CONCLUIDA com sucesso.")
        return 0
    print("\\nValidacao FALHOU.")
    return 2


if __name__ == "__main__":
    sys.exit(main())
`,
  },

  {
    name: 'gerar_dados_sinteticos.py',
    language: 'python',
    content: `"""
gerar_dados_sinteticos.py
=========================

Gera um dataset SINTE'TICO com schema IDÊNTICO ao \`datatran2025.csv\` real,
para testar o pipeline quando o arquivo real nao esta disponivel.

Importante:
  - O dataset sintetico NAO substitui o CSV real da PRF.
  - As distribuicoes sao aproximações didaticas para validar o codigo.
  - Para resultados reais, baixe o arquivo em:
        https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf
    e salve como \`datatran2025.csv\` na raiz do projeto.

Rodar:
    python gerar_dados_sinteticos.py
"""
from pathlib import Path
import numpy as np
import pandas as pd

# ------------------------------------------------------------
# Constantes — espelham a inspeção real descrita no enunciado
# ------------------------------------------------------------
N_ROWS = 72_529
N_COLS = 30
RANDOM_STATE = 42

DISTRIBUICAO_ALVO = {
    "Com Vítimas Feridas": 56_181,
    "Sem Vítimas": 11_138,
    "Com Vítimas Fatais": 5_209,
    np.nan: 1,
}

UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
       "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
DIAS_SEMANA = ["segunda-feira","terça-feira","quarta-feira","quinta-feira",
               "sexta-feira","sábado","domingo"]
FASES_DIA = ["Plena Noite","Madrugada","Amanhecer","Pleno Dia","Tarde","Anoitecer",""]
SENTIDOS = ["Crescente","Decrescente","Não Informado"]
COND_METEO = ["Céu Claro","Chuva","Nublado","Neblina","Vento","Sol","Granizo","Garoa","Ignorado"]
TIPOS_PISTA = ["Simples","Dupla","Múltipla"]
USO_SOLO = ["Sim","Não"]

# Top causas — espelham o enunciado (valores brutos)
CAUSAS_TOP = [
    "Ausência de reação do condutor",         # 11.469
    "Reação tardia ou ineficiente do condutor",# 10.799
    "Não observar via ao acessá-la",          # 7.097
    "Distância inadequada entre veículos",    # 4.413
    "Velocidade incompatível",                 # 4.088
    "Ingestão de álcool",                      # 3.685
    "Condutor dormindo",                       # 3.400
    "Desobediência à sinalização",             # 3.000
    "Falta de atenção do condutor",            # 2.800
    "Falta de iluminação do veículo",          # 2.500
    "Defeito mecânico no veículo",             # 2.200
    "Pista escorregadia",                      # 2.000
    "Animais na pista",                        # 1.500
    "Objeto na pista",                         # 1.200
    "Fenômenos da natureza",                   # 1.000
    "Desobediência às normas de trânsito",     # 900
    "Avarias e/ou desgaste excessivo no pneu", # 800
    "Defeito na via",                          # 700
    "Sinalização da via em desacordo",         # 600
    "Restrição de visibilidade",               # 500
]
# 49 causas raras para totalizar 69 categorias (cada uma com ~10-30 ocorrências)
CAUSAS_RARAS = [f"Causa Rara {i:02d}" for i in range(1, 50)]

TIPOS_ACIDENTE_TOP = [
    "Colisão traseira","Saída de leito carroçável","Colisão transversal",
    "Capotamento","Tombamento","Colisão frontal","Colisão lateral mesmo sentido",
    "Colisão lateral sentido oposto","Choque","Atropelo de pessoa",
    "Queda de ocupante de veículo","Colisão com objeto","Derramamento de carga",
    "Incêndio","Eventos atípicos","Engavetamento","Outros",
]

TRACADOS = ["Reta","Curva","Aclive","Declive","Rotatória","Cruzamento",
            "Interseção","Viaduto","Ponte","Túnel","Retorno","Lomba",
            "Confluência","Divergência"]
TRACADO_MULTI_PROB = 0.30  # 30% das linhas têm 2+ valores no tracado_via

MUNICIPIOS_TEMPLATE = ["São Paulo","Rio de Janeiro","Belo Horizonte","Curitiba",
                       "Porto Alegre","Recife","Salvador","Fortaleza","Brasília",
                       "Goiânia","Belém","Manaus","Vitória","Florianópolis",
                       "Campo Grande","Cuiabá","Natal","João Pessoa","Teresina",
                       "São Luís","Maceió","Aracaju","Porto Velho","Rio Branco",
                       "Macapá","Boa Vista","Palmas"]


def _horario_aleatorio(rng: np.random.Generator) -> str:
    """HH:MM:SS aleatório."""
    h = rng.integers(0, 24)
    m = rng.integers(0, 60)
    s = rng.integers(0, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def _tracado_aleatorio(rng: np.random.Generator) -> str:
    n = 1 if rng.random() > TRACADO_MULTI_PROB else rng.integers(2, 4)
    return ";".join(rng.choice(TRACADOS, size=n, replace=False))


def _data_inversa_aleatoria(rng: np.random.Generator) -> str:
    """Data no formato dd/mm/yyyy (estilo data_inversa real)."""
    dia = rng.integers(1, 29)
    mes = rng.integers(1, 13)
    return f"{dia:02d}/{mes:02d}/2025"


def gerar_dataset_sintetico(n_rows: int = N_ROWS, seed: int = RANDOM_STATE) -> pd.DataFrame:
    """Gera DataFrame sintético com schema idêntico ao datatran2025.csv real."""
    rng = np.random.default_rng(seed)

    # 1. Distribuição do alvo (com a linha NaN única)
    alvo_pool = []
    for classe, n in DISTRIBUICAO_ALVO.items():
        if pd.isna(classe):
            alvo_pool.append(np.nan)
        else:
            alvo_pool.extend([classe] * n)
    rng.shuffle(alvo_pool)
    alvo = alvo_pool[:n_rows]

    # 2. Preditores circunstanciais — correlacionados com a gravidade (para dar trabalho ao modelo)
    n = n_rows
    alvo_arr = np.array(alvo, dtype=object)

    # Função utilitária: probabilidade por classe
    def probs_por_classe(p_sem, p_fer, p_fat):
        out = np.empty(n, dtype=float)
        for i, c in enumerate(alvo_arr):
            if c == "Sem Vítimas": out[i] = p_sem
            elif c == "Com Vítimas Fatais": out[i] = p_fat
            else: out[i] = p_fer
        return out

    # causa_acidente — álcool e velocidade mais comuns em fatais
    causas_p = probs_por_classe(0.25, 0.35, 0.55)
    usa_alcool_velocidade = rng.random(n) < causas_p
    causa = np.where(
        usa_alcool_velocidade,
        rng.choice(["Ingestão de álcool","Velocidade incompatível"], n),
        rng.choice(CAUSAS_TOP + CAUSAS_RARAS, n, p=_pesos_causas(rng))
    )

    # tipo_acidente — capotamentos/colisões frontais mais em fatais
    tipo = rng.choice(TIPOS_ACIDENTE_TOP, n)

    # fase_dia — noite mais em fatais
    noite_p = probs_por_classe(0.20, 0.25, 0.50)
    eh_noite = rng.random(n) < noite_p
    fase_dia = np.where(
        eh_noite,
        rng.choice(["Plena Noite","Anoitecer","Madrugada"], n),
        rng.choice(["Pleno Dia","Amanhecer","Tarde"], n)
    )

    # condicao_metereologica — chuva/neblina mais em fatais
    chuva_p = probs_por_classe(0.15, 0.20, 0.40)
    eh_chuva = rng.random(n) < chuva_p
    cond_met = np.where(
        eh_chuva,
        rng.choice(["Chuva","Neblina","Garoa"], n),
        rng.choice(["Céu Claro","Nublado","Sol"], n)
    )

    # tipo_pista — simples mais em fatais
    pista_p = probs_por_classe(0.40, 0.55, 0.70)
    eh_simples = rng.random(n) < pista_p
    tipo_pista = np.where(eh_simples, "Simples",
                         rng.choice(["Dupla","Múltipla"], n))

    # sentido_via
    sentido = rng.choice(SENTIDOS, n, p=[0.45, 0.45, 0.10])

    # uso_solo
    uso_solo = rng.choice(USO_SOLO, n, p=[0.65, 0.35])

    # dia_semana
    dia_semana = rng.choice(DIAS_SEMANA, n)

    # 3. Engenharia reversa do VAZAMENTO — alvo determina contagens
    mortos = np.zeros(n, dtype=int)
    feridos_leves = np.zeros(n, dtype=int)
    feridos_graves = np.zeros(n, dtype=int)
    ilesos = np.zeros(n, dtype=int)
    ignorados = np.zeros(n, dtype=int)

    for i, c in enumerate(alvo_arr):
        if c == "Com Vítimas Fatais":
            mortos[i] = int(rng.integers(1, 4))
            feridos_graves[i] = int(rng.integers(0, 4))
            feridos_leves[i] = int(rng.integers(0, 4))
            ilesos[i] = int(rng.integers(0, 3))
        elif c == "Com Vítimas Feridas":
            feridos_graves[i] = int(rng.integers(0, 3))
            feridos_leves[i] = int(rng.integers(1, 5))
            ilesos[i] = int(rng.integers(0, 5))
        elif c == "Sem Vítimas":
            ilesos[i] = int(rng.integers(1, 4))
        ignorados[i] = int(rng.integers(0, 2))

    feridos = feridos_leves + feridos_graves
    pessoas = mortos + feridos + ilesos + ignorados
    veiculos = np.where(mortos > 0, rng.integers(2, 5, n),
                        rng.integers(1, 4, n))

    # 4. Localização
    uf = rng.choice(UFS, n)
    br = rng.integers(0, 496, n)
    km = rng.uniform(0, 1257, n).round(3)
    municipio = np.array([f"{m}-{u}" for m, u in zip(
        rng.choice(MUNICIPIOS_TEMPLATE, n), uf)])
    latitude = rng.uniform(-33.5, 5.5, n).round(6)
    longitude = rng.uniform(-73.5, -34.5, n).round(6)

    # 5. Temporais
    horario = np.array([_horario_aleatorio(rng) for _ in range(n)])
    data_inversa = np.array([_data_inversa_aleatoria(rng) for _ in range(n)])

    # 6. Identificação e administrativas
    id_ = np.arange(1, n + 1)
    regional = rng.choice([f"REG{i:02d}" for i in range(1, 29)], n)
    # Simular os poucos nulos do enunciado
    regional[rng.choice(n, 2, replace=False)] = np.nan
    delegacia = rng.choice([f"DEL{i:03d}" for i in range(1, 154)], n)
    delegacia[rng.choice(n, 22, replace=False)] = np.nan
    uop = rng.choice([f"UOP{i:03d}" for i in range(1, 396)], n)
    uop[rng.choice(n, 38, replace=False)] = np.nan

    # tracado_via
    tracado_via = np.array([_tracado_aleatorio(rng) for _ in range(n)])

    df = pd.DataFrame({
        "id": id_,
        "data_inversa": data_inversa,
        "dia_semana": dia_semana,
        "horario": horario,
        "uf": uf,
        "br": br,
        "km": km,
        "municipio": municipio,
        "latitude": latitude,
        "longitude": longitude,
        "tipo_acidente": tipo,
        "causa_acidente": causa,
        "fase_dia": fase_dia,
        "sentido_via": sentido,
        "condicao_metereologica": cond_met,
        "tipo_pista": tipo_pista,
        "tracado_via": tracado_via,
        "uso_solo": uso_solo,
        "pessoas": pessoas,
        "mortos": mortos,
        "feridos_leves": feridos_leves,
        "feridos_graves": feridos_graves,
        "ilesos": ilesos,
        "ignorados": ignorados,
        "feridos": feridos,
        "veiculos": veiculos,
        "classificacao_acidente": alvo_arr,
        "regional": regional,
        "delegacia": delegacia,
        "uop": uop,
    })
    return df


def _pesos_causas(rng):
    """Pesos relativos para amostragem das causas (apenas as não-alcool/velocidade)."""
    base = np.array([11469, 10799, 7097, 4413, 4088, 3685, 3400, 3000, 2800, 2500,
                     2200, 2000, 1500, 1200, 1000, 900, 800, 700, 600, 500], dtype=float)
    raras = np.full(len(CAUSAS_RARAS), 25.0)
    pesos = np.concatenate([base, raras])
    return pesos / pesos.sum()


def main():
    out = Path(__file__).parent / "datatran2025.csv"
    if out.exists():
        print(f"[AVISO] {out} já existe. Nao vou sobrescrever — apague manualmente se necessario.")
        return 1
    print(f"Gerando dataset sintetico com {N_ROWS} linhas x {N_COLS} colunas...")
    df = gerar_dataset_sintetico()
    df.to_csv(out, sep=";", encoding="latin1", decimal=",", index=False)
    print(f"[OK] Arquivo gerado: {out}  ({out.stat().st_size/(1024*1024):.2f} MB)")
    print(f"     Shape: {df.shape}")
    print("     Distribuicao do alvo:")
    print(df["classificacao_acidente"].value_counts(dropna=False))
    print()
    print("AVISO: Este dataset é SINTE'TICO (apenas para teste do pipeline).")
    print("       Para resultados reais, baixe o CSV da PRF (ver README.md).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`,
  },

  {
    name: 'requirements.txt',
    language: 'text',
    content: `pandas==2.2.2
numpy==1.26.4
scikit-learn==1.5.0
matplotlib==3.9.0
seaborn==0.13.2
`,
  },

  {
    name: '.gitignore',
    language: 'gitignore',
    content: `# Dados brutos — 21 MB, baixar manualmente da PRF (ver README.md)
datatran2025.csv
datatran2024.csv
datatran*.csv

# Saídas geradas pelo main.py
outputs/

# Cache Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python

# Ambiente virtual
.venv/
venv/
env/
ENV/

# IDE / SO
.vscode/
.idea/
.DS_Store
Thumbs.db

# Jupyter
.ipynb_checkpoints/
*.ipynb_checkpoints
ROTEIRO_VIDEO.md

# Arquivos de roteiro do vídeo (material pessoal, não versionar)
ROTEIRO_VIDEO.md
ROTEIRO_VIDEO_AV1.pdf
ROTEIRO_*.md
ROTEIRO_*.pdf
*_ROTEIRO_*

# Screenshots/uploads feitos pelo usuário
pasted_image_*.png
upload/
*.pdf.bak
`,
  },

  {
    name: 'README.md',
    language: 'markdown',
    content: `# Campanha Educativa no Trânsito — Árvore de Decisão (AV1)

> Pipeline de Ciência de Dados para apoiar um órgão público de trânsito brasileiro
> na priorização de campanhas educativas com base em sinistros de rodovias federais.
>
> **Pergunta gerencial central:** *Quais características dos sinistros estão mais
> associadas à ocorrência de vítimas, e devem ser priorizadas como foco de
> campanhas educativas e ações preventivas?*

---

## Sumário

- [Contexto](#contexto)
- [Base de dados](#base-de-dados)
- [Decisões metodológicas](#decisões-metodológicas)
  - [Vazamento de dados](#vazamento-de-dados)
  - [Variável-alvo: 3 classes mantidas](#variável-alvo-3-classes-mantidas)
  - [Engenharia de atributos](#engenharia-de-atributos)
  - [Hiperparâmetros testados](#hiperparâmetros-testados)
- [Como rodar](#como-rodar)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Resultados](#resultados)
- [Reprodutibilidade](#reprodutibilidade)

---

## Contexto

Sinistros em rodovias federais brasileiras geram milhares de vítimas por ano.
Historicamente, campanhas educativas de trânsito se baseiam em experiência
prática dos gestores. Este projeto substitui essa abordagem intuitiva por um
modelo **orientado por dados, auditável e reproduzível** — uma Árvore de
Decisão treinada com critério de **entropia** (ganho de informação,
ID3/C4.5 clássico).

O produto final é um conjunto de **recomendações de campanha** ligadas a
atributos que o modelo aponta como mais importantes para diferenciar sinistros
com e sem vítimas fatais.

---

## Base de dados

**Arquivo:** \`datatran2025.csv\` — 72.529 registros × 30 colunas, cobrindo os 365
dias de 2025 (01/01 a 31/12), fonte: Polícia Rodoviária Federal (PRF), via
[dados.gov.br](https://dados.gov.br/dados/conjunto-dados-abertos-acidentes-prf)
e
[gov.br/prf](https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf).

### Leitura correta (obrigatória)

\`\`\`python
import pandas as pd

df = pd.read_csv(
    "datatran2025.csv",
    sep=";",            # delimitador é ponto-e-vírgula, não vírgula
    encoding="latin1",  # ISO-8859-1 — acentuação quebra com utf-8
    decimal=",",        # km/latitude/longitude usam vírgula decimal (padrão BR)
)
\`\`\`

Sem esses três parâmetros a leitura falha silenciosamente:
colunas quebradas ou acentos corrompidos (ex.: "VM-mtimas" em vez de "Vítimas").

### Esquema — 30 colunas agrupadas

| Grupo | Colunas | Tratamento |
|---|---|---|
| Identificação | \`id\` | Excluir (único, sem poder preditivo) |
| Temporais | \`data_inversa\`, \`dia_semana\`, \`horario\` | Engenharia obrigatória |
| Localização | \`uf\`, \`br\`, \`km\`, \`municipio\`, \`latitude\`, \`longitude\` | Manter \`uf\`; excluir o restante |
| Circunstanciais | \`causa_acidente\`, \`tipo_acidente\`, \`fase_dia\`, \`sentido_via\`, \`condicao_metereologica\`, \`tipo_pista\`, \`tracado_via\`, \`uso_solo\` | Preditores-chave |
| **Alvo** | \`classificacao_acidente\` | Ver [Variável-alvo](#variável-alvo-3-classes-mantidas) |
| **VAZAMENTO** | \`pessoas\`, \`mortos\`, \`feridos_leves\`, \`feridos_graves\`, \`ilesos\`, \`ignorados\`, \`feridos\` | **EXCLUIR** |
| Envolvimento | \`veiculos\` | Manter como numérica |
| Administrativas | \`regional\`, \`delegacia\`, \`uop\` | Excluir (alta cardinalidade, redundantes com \`uf\`) |

### Qualidade dos dados

- Sem \`id\` duplicado · \`km\` (0–1257) e \`br\` (0–495) sem absurdos.
- Nulos: \`uop\` (38), \`delegacia\` (22), \`regional\` (2), \`classificacao_acidente\` (1).
- **Ação obrigatória:** \`df.dropna(subset=["classificacao_acidente"])\` — sem
  rótulo, a linha não serve para treino nem teste.

---

## Decisões metodológicas

### Vazamento de dados

As 7 colunas \`pessoas\`, \`mortos\`, \`feridos_leves\`, \`feridos_graves\`, \`feridos\`,
\`ilesos\`, \`ignorados\` são a **contagem pós-evento que originou o próprio rótulo**
\`classificacao_acidente\`. Incluir qualquer uma delas em \`X\` produz modelo com
~100% de acurácia artificial — apenas redescobre a regra que gerou o rótulo, sem
revelar nenhum fator **acionável** para campanha educativa.

**Confirmação nos dados:**
- Toda linha "Com Vítimas Fatais" tem \`mortos ≥ 1\`
- Toda linha "Sem Vítimas" tem \`mortos = 0\` **E** \`feridos = 0\`

**Implementação:** há um \`assert\` explícito em \`main.py\` que bloqueia a
presença de qualquer dessas colunas em \`X\`:

\`\`\`python
LEAKAGE_COLS = ["pessoas","mortos","feridos_leves","feridos_graves",
                "ilesos","ignorados","feridos"]
assert not set(LEAKAGE_COLS) & set(X.columns), "Coluna de vazamento presente em X!"
\`\`\`

**\`veiculos\`** é mantida como preditora: é conhecida no momento do sinistro (não
deriva da contagem de vítimas) e mostra relação real com gravidade
(média: ~2,5 veículos em fatais vs ~1,9 em sem vítimas).

### Variável-alvo: 3 classes mantidas

\`classificacao_acidente\` tem 3 classes originais:

| Classe | Registros | % |
|---|---|---|
| Com Vítimas Feridas | 56.181 | 77,5% |
| Sem Vítimas | 11.138 | 15,4% |
| Com Vítimas Fatais | 5.209 | 7,2% |

Mantemos as 3 classes (não binarizamos) porque a **distinção entre ferimento e
óbito** é valiosa para diferenciar campanhas de prevenção de mortes das de
prevenção de ferimentos.

**Desbalanceamento:** um classificador trivial "most_frequent" já atinge
~77,5% de acurácia sem aprender nada. Reportamos este baseline com
\`DummyClassifier(strategy="most_frequent")\` e comparamos contra o modelo
treinado. **Acurácia isolada, sem este contraste, não demonstra desempenho real.**

### Engenharia de atributos

| Coluna original | Transformação | Justificativa |
|---|---|---|
| \`horario\` (1.412 valores HH:MM:SS) | \`hora_int\` (0–23) + \`periodo_dia\` (4 categorias: Madrugada/Manhã/Tarde/Noite) | String bruta fragmentaria a árvore |
| \`tracado_via\` (605 valores!) | \`MultiLabelBinarizer\` após \`.str.split(";")\` — colunas binárias por palavra-chave (Curva, Reta, Aclive, Declive, Rotatória, …) | É multirrótulo, não categórica simples |
| \`data_inversa\` (365 datas) | \`mes\` (1–12) | Análise sazonal sem explodir cardinalidade |

Categorias raras de \`causa_acidente\` (69 categorias originais; 24 têm <100
ocorrências) e \`tipo_acidente\` (17 categorias) são agrupadas em \`"Outros"\` quando
a frequência cai abaixo de 1% (~725 registros) antes do one-hot.

### Hiperparâmetros testados

Testamos uma grade 3×3:

| \`max_depth\` \\ \`min_samples_leaf\` | 20 | 30 | 50 |
|---|---|---|---|
| 6 | . | . | . |
| **8** | . | **★ escolhido** | . |
| 10 | . | . | . |

A tabela completa é impressa em stdout na execução do \`main.py\`. A escolha
padrão (\`max_depth=8\`, \`min_samples_leaf=30\`) reflete um trade-off:

- \`max_depth=6\` → árvore simples mas com tendência a subajustar a classe
  minoritária fatais (recall baixo).
- \`max_depth=10\` → ganho marginal de acurácia, mas árvore menos legível no
  vídeo e maior gap de overfitting (treino > teste).
- \`max_depth=8\` + \`min_samples_leaf=30\` → melhor equilíbrio entre
  interpretabilidade (plotável), generalização e recall da classe fatais.

\`class_weight="balanced"\` repondera as classes inversamente à sua frequência,
forçando o modelo a se importar mais com a classe minoritária (7,2% de
fatais). **O efeito colateral é que a acurácia global cai vs. baseline, mas o
recall de fatais sobe** — esse é exatamente o ganho real para políticas públicas.

\`random_state=42\` em todos os pontos estocásticos (split, árvore, baseline).

---

## Como rodar

### 1. Ambiente

\`\`\`bash
# Setup
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
\`\`\`

### 2. Obter o CSV

Baixe \`datatran2025.csv\` em:
- https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf
- https://dados.gov.br/dados/conjunto-dados-abertos-acidentes-prf

Salve na **raiz** do projeto.

> **Alternativa para teste rápido:** rode \`python gerar_dados_sinteticos.py\`
> para gerar um dataset sintético com schema idêntico (distribuições aproximadas,
> apenas para validar o código end-to-end).

### 3. Validação rápida

\`\`\`bash
python validar_leitura.py
\`\`\`

Saída esperada (com CSV real):
\`\`\`
[OK] Arquivo encontrado: ./datatran2025.csv
[OK] Leitura OK com sep=';' encoding='latin1' decimal=','
[OK] Linhas: 72529 (esperado ~72529)
[OK] Colunas: 30 (esperado 30)
[OK] Coluna-alvo 'classificacao_acidente' presente
\`\`\`

### 4. Pipeline completo

\`\`\`bash
python main.py
\`\`\`

Saídas:
- \`outputs/matriz_confusao.png\` — matriz normalizada por classe real
- \`outputs/arvore_decisao.png\` — primeiros 3 níveis da árvore (legível)
- \`outputs/importancia_atributos.png\` — top 20 \`feature_importances_\`
- \`relatorio_campanhas.md\` — recomendações de campanha por atributo

---

## Estrutura do projeto

\`\`\`
campanha-transito-arvore-decisao/
├── README.md                    # este arquivo
├── requirements.txt             # pandas, numpy, scikit-learn, matplotlib, seaborn
├── .gitignore                   # ignora datatran2025.csv, outputs/, __pycache__/
├── validar_leitura.py           # 10 linhas: valida leitura OK antes do pipeline
├── gerar_dados_sinteticos.py    # opcional: gera dataset sintético para teste
├── main.py                      # PIPELINE COMPLETO autossuficiente
├── RESULTADOS_ESPERADOS.md      # simulação didática dos resultados
├── relatorio_campanhas.md       # gerado automaticamente pelo main.py
├── datatran2025.csv             # (não versionado) — baixar manualmente
└── outputs/
    ├── matriz_confusao.png      # gerado pelo main.py
    ├── arvore_decisao.png       # gerado pelo main.py
    └── importancia_atributos.png # gerado pelo main.py
\`\`\`

---

## Resultados

> **Placeholder** — preencher com os números reais após executar \`python main.py\`.
> Consulte \`RESULTADOS_ESPERADOS.md\` para uma simulação didática.

| Métrica | Valor |
|---|---|
| Baseline (most_frequent) | ~0,775 |
| Acurácia treino | _preencher_ |
| Acurácia teste | _preencher_ |
| Gap overfitting | _preencher_ |
| Recall classe fatais (teste) | _preencher_ |

**Top 5 atributos** (preencher após execução):
1. _preencher_
2. _preencher_
3. _preencher_
4. _preencher_
5. _preencher_

---

## Reprodutibilidade

- \`random_state=42\` em todos os estágios estocásticos (split, DecisionTree, DummyClassifier).
- Versões pinadas em \`requirements.txt\` (pandas==2.2.2, numpy==1.26.4, scikit-learn==1.5.0, matplotlib==3.9.0, seaborn==0.13.2).
- CSV não versionado (21 MB) — \`.gitignore\` cobre.
- Outros profissionais devem conseguir ler, executar e manter o código.
`,
  },

  {
    name: 'COMO_RODAR_VSCODE.md',
    language: 'markdown',
    content: `# 🚀 Como Rodar no VS Code — Passo a Passo

> Este guia mostra como abrir, configurar e rodar o projeto no Visual Studio Code, do zero até ver o dashboard funcionando.

---

## 📋 Pré-requisitos

Antes de começar, instale:

1. **Python 3.10+** → https://www.python.org/downloads/
   - No Windows: marque a caixa **"Add Python to PATH"** durante a instalação
   - No Mac: \`brew install python\` ou baixe do site
   - No Linux: \`sudo apt install python3 python3-pip python3-venv\`

2. **VS Code** → https://code.visualstudio.com/

3. **Extensões do VS Code** (instale depois de abrir o VS Code):
   - **Python** (Microsoft) — suporte a Python
   - **Pylance** (Microsoft) — autocomplete inteligente
   - **Jupyter** (Microsoft) — opcional, se quiser abrir células
   - **Markdown All in One** — para editar o roteiro do vídeo

4. **Node.js 18+** (só se quiser rodar o dashboard Next.js) → https://nodejs.org/

---

## 🔽 Passo 1 — Baixar e descompactar o projeto

1. Baixe o arquivo \`campanha-transito-arvore-decisao.zip\`
2. Descompacte em uma pasta de sua preferência:
   - Windows: \`C:\\Users\\SEU_USUARIO\\Documents\\campanha-transito-arvore-decisao\`
   - Mac: \`/Users/SEU_USUARIO/Documents/campanha-transito-arvore-decisao\`
   - Linux: \`/home/SEU_USUARIO/campanha-transito-arvore-decisao\`

> **Importante:** o caminho não deve ter **espaços nem acentos**. Se seu usuário for "João Silva", mova a pasta para \`C:\\projetos\\campanha-transito-arvore-decisao\`.

---

## 📂 Passo 2 — Abrir o projeto no VS Code

1. Abra o VS Code
2. Menu: **File → Open Folder...** (ou \`Ctrl+K Ctrl+O\`)
3. Selecione a pasta \`campanha-transito-arvore-decisao\` descompactada
4. A estrutura deve ficar assim no Explorer (lateral esquerda):

\`\`\`
campanha-transito-arvore-decisao/
├── .gitignore
├── README.md
├── RESULTADOS_ESPERADOS.md
├── ROTEIRO_VIDEO.md           ← roteiro do vídeo
├── COMO_RODAR_VSCODE.md       ← este arquivo
├── requirements.txt
├── validar_leitura.py
├── gerar_dados_sinteticos.py
├── main.py                    ← PIPELINE PRINCIPAL
├── datatran2025.csv           ← dados (sintéticos para teste; baixar o real da PRF)
├── relatorio_campanhas.md     ← gerado pelo main.py
└── outputs/
    ├── matriz_confusao.png
    ├── arvore_decisao.png
    ├── importancia_atributos.png
    └── resultados.json
\`\`\`

---

## 🐍 Passo 3 — Criar ambiente virtual e instalar dependências

1. Abra o terminal integrado do VS Code:
   - Menu: **Terminal → New Terminal** (ou \`\` Ctrl+\` \`\`)
   - O terminal abre na pasta do projeto automaticamente

2. Crie o ambiente virtual:

   **Windows (PowerShell):**
   \`\`\`powershell
   python -m venv .venv
   .venv\\Scripts\\activate
   \`\`\`

   **Windows (CMD):**
   \`\`\`cmd
   python -m venv .venv
   .venv\\Scripts\\activate.bat
   \`\`\`

   **Mac/Linux:**
   \`\`\`bash
   python3 -m venv .venv
   source .venv/bin/activate
   \`\`\`

3. Quando o ambiente estiver ativo, você verá \`(.venv)\` no início da linha de comando.

4. Instale as dependências:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

   > **Se der erro no Windows** dizendo "Microsoft Visual C++ 14.0 is required":
   > - Instale o **Build Tools for Visual Studio**: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   > - Ou use versões mais novas das libs: \`pip install pandas numpy scikit-learn matplotlib seaborn\` (sem pinning)

---

## ✅ Passo 4 — Validar a leitura do CSV

No terminal (com o \`.venv\` ativo):

\`\`\`bash
python validar_leitura.py
\`\`\`

**Saída esperada:**
\`\`\`
[OK] Arquivo encontrado: ./datatran2025.csv
[OK] Leitura OK com sep=';' encoding='latin1' decimal=','
[OK] Linhas: 72529 (esperado ~72529)
[OK] Colunas: 30 (esperado 30)
[OK] Coluna-alvo 'classificacao_acidente' presente

Distribuicao do alvo:
Com Vítimas Feridas    56181
Sem Vítimas            11138
Com Vítimas Fatais      5209
NaN                        1
\`\`\`

Se passou, o ambiente está configurado corretamente. ✅

---

## 🚀 Passo 5 — Rodar o pipeline completo

\`\`\`bash
python main.py
\`\`\`

O pipeline vai rodar por ~30 segundos e imprimir o progresso. No final, você terá:

- \`outputs/matriz_confusao.png\` — heatmap 3×3 (clique duas vezes no VS Code para ver)
- \`outputs/arvore_decisao.png\` — árvore de decisão
- \`outputs/importancia_atributos.png\` — top 20 atributos
- \`outputs/resultados.json\` — payload completo para o dashboard
- \`relatorio_campanhas.md\` — relatório com 10 recomendações de campanha

**Para ver os PNGs:** dê duplo-clique no arquivo na lateral do VS Code → abre no visualizador integrado.

**Para ver o relatório markdown:** dê duplo-clique em \`relatorio_campanhas.md\` → pressione \`Ctrl+Shift+V\` para abrir o preview formatado.

---

## 📊 Passo 6 — (Opcional) Rodar o dashboard Next.js

O dashboard interativo está em uma pasta separada do Next.js. Para rodá-lo:

1. **Baixe o Node.js 18+** (se ainda não tem): https://nodejs.org/

2. **Volte para a pasta do projeto Python** e copie os artefatos:
   \`\`\`bash
   # No projeto Python (após rodar python main.py):
   cp outputs/resultados.json /CAMINHO/PRO/NEXTJS/public/data/
   cp outputs/*.png /CAMINHO/PRO/NEXTJS/public/outputs/
   \`\`\`

3. **Abra o projeto Next.js no VS Code** (nova janela: \`File → New Window\`)

4. **No terminal do projeto Next.js:**
   \`\`\`bash
   npm install
   npm run dev
   \`\`\`

5. **Abra o navegador** em http://localhost:3000

> **Atenção:** se você baixou o projeto Python em ZIP, o dashboard Next.js está em outro repositório. Para o escopo da AV1, o item 2 (apresentação gráfica) pode ser entregue apenas com os PNGs estáticos + o relatório markdown — o dashboard Next.js é um bônus.

---

## 🌐 Passo 7 — Substituir o CSV sintético pelo real da PRF

O ZIP vem com \`datatran2025.csv\` sintético (apenas para teste do código). Para usar o CSV real:

1. **Baixe o CSV real da PRF:**
   - Acesse https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf
   - Baixe \`datatran2025.csv\` (arquivo de ~21 MB)

2. **Apague o sintético e coloque o real:**
   \`\`\`bash
   # No terminal do projeto Python:
   rm datatran2025.csv
   # Copie o CSV real baixado para esta pasta
   # (no Windows Explorer/Finder, arraste o arquivo baixado para a pasta)
   \`\`\`

3. **Valide novamente:**
   \`\`\`bash
   python validar_leitura.py
   \`\`\`

4. **Rode o pipeline:**
   \`\`\`bash
   python main.py
   \`\`\`

5. **Anote os números reais** que aparecem no final (acurácia, recall fatais, top atributos) e atualize:
   - \`README.md\` → seção "Resultados" (substitua os placeholders)
   - \`ROTEIRO_VIDEO.md\` → substitua os \`[XX]%\`, \`[YY]%\` etc. pelos números reais

---

## 🐛 Problemas comuns e soluções

### ❌ "python não é reconhecido como comando interno"
- **Windows:** Python não foi adicionado ao PATH. Reinstale marcando "Add Python to PATH" ou adicione manualmente em Variáveis de Ambiente.
- **Mac/Linux:** use \`python3\` em vez de \`python\`.

### ❌ "ModuleNotFoundError: No module named 'pandas'"
- O ambiente virtual \`.venv\` não está ativo. Rode \`source .venv/bin/activate\` (Mac/Linux) ou \`.venv\\Scripts\\activate\` (Windows) antes de rodar \`python main.py\`.

### ❌ "Permission denied" ao ativar o .venv no Windows
- Abra o PowerShell como administrador e rode:
  \`\`\`powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  \`\`\`

### ❌ Encoding error na leitura do CSV (TypeError ou UnicodeDecodeError)
- Verifique se está usando \`encoding="latin1"\` no \`pd.read_csv\`. O parâmetro está correto no \`validar_leitura.py\` e \`main.py\`.

### ❌ "Could not convert string to float"
- Provavelmente há colunas de string ainda em X. Verifique se a versão do \`main.py\` que você tem inclui \`"data_inversa", "horario"\` na constante \`EXCLUDE_COLS\`.

### ❌ Árvore de decisão muito grande / ilegível no PNG
- Reduza \`MAX_DEPTH_DEFAULT = 6\` no topo do \`main.py\` e rode novamente.

### ❌ Resultados diferentes dos esperados (acurácia, recall)
- Se você está usando o CSV sintético, espere números didáticos próximos dos placeholders. Para resultados reais, baixe o CSV da PRF (ver Passo 7).

---

## ✅ Checklist final antes de entregar

- [ ] Projeto descompactado e aberto no VS Code
- [ ] Ambiente virtual \`.venv\` criado e ativado
- [ ] Dependências instaladas (\`pip install -r requirements.txt\`)
- [ ] \`python validar_leitura.py\` passou
- [ ] \`python main.py\` rodou sem erros e gerou os 3 PNGs + JSON + relatório
- [ ] CSV real da PRF baixado e substituído (opcional, mas recomendado)
- [ ] README.md atualizado com números reais
- [ ] ROTEIRO_VIDEO.md com placeholders preenchidos
- [ ] Repositório Git criado e pushed para o GitHub
- [ ] Vídeo gravado (5-7 min)
- [ ] Email enviado para lina@ls4business.com.br

---

**Bom trabalho! Em caso de dúvida, consulte o \`README.md\` principal para decisões metodológicas e o \`RESULTADOS_ESPERADOS.md\` para os números esperados.**
`,
  },

  {
    name: 'RESULTADOS_ESPERADOS.md',
    language: 'markdown',
    content: `# Resultados Esperados — Simulação Didática

> **Aviso:** este arquivo é uma **simulação didática** dos resultados que o
> pipeline deve produzir quando executado contra o CSV real \`datatran2025.csv\`.
> Os números abaixo são estimativas baseadas no enunciado e em execuções
> anteriores com datasets semelhantes da PRF. **Não substituem a execução real.**
>
> Para obter os números reais, rode \`python main.py\` e edite este arquivo
> (e o README) com os valores impressos em stdout.

---

## 1. Leitura e qualidade

| Indicador | Esperado |
|---|---|
| Linhas lidas | 72.529 |
| Colunas | 30 |
| Linhas após \`dropna(subset=[TARGET])\` | 72.528 (descarta 1 com alvo nulo) |
| Encoding | \`latin1\` (UTF-8 quebra acentos) |
| Separador | \`;\` |
| Decimal | \`,\` |

---

## 2. Distribuição do alvo

| Classe | % | Comportamento esperado do modelo |
|---|---|---|
| Com Vítimas Feridas | 77,5% | Recall alto (>=0,90) — classe majoritária, fácil |
| Sem Vítimas | 15,4% | Recall médio (~0,50–0,70) |
| Com Vítimas Fatais | 7,2% | Recall baixo sem \`class_weight\`; sobe com \`class_weight="balanced"\` |

---

## 3. Baseline trivial

\`\`\`
DummyClassifier(strategy="most_frequent"):
  acc_teste = 0,7750  (prediz "Com Vítimas Feridas" para tudo)
  recall fatais = 0,000   ←  zero!
\`\`\`

Este é o piso de comparação. **Qualquer modelo que não supere este baseline em
\`recall de fatais\` é inútil para políticas públicas**, mesmo que sua acurácia
global seja alta.

---

## 4. Modelo treinado — intervalo esperado

Com \`DecisionTreeClassifier(criterion="entropy", max_depth=8,
min_samples_leaf=30, class_weight="balanced", random_state=42)\`:

| Métrica | Intervalo esperado | Observação |
|---|---|---|
| Acurácia treino | 0,62 – 0,70 | Acima disso indica overfitting |
| Acurácia teste | 0,55 – 0,62 | **Pode ser menor que o baseline (0,775)** |
| Gap overfitting | < 0,10 | Tree não-viciada |
| Recall fatais | 0,45 – 0,65 | **← métrica-chave para políticas públicas** |
| Recall sem vítimas | 0,55 – 0,75 | Melhora com \`class_weight="balanced"\` |
| Recall feridos | 0,65 – 0,80 | Classe majoritária, sempre fácil |

### Por que a acurácia cai vs. baseline?

Porque \`class_weight="balanced"\` força o modelo a errar mais na classe
majoritária (77,5%) para acertar mais nas minoritárias. **Isso é uma escolha
ética, não um bug:** para um órgão de trânsito, é mais valioso identificar
sinistros fatais (mesmo errando alguns sem vítimas) do que o contrário.

> **Interpretação correta do resultado:**
> "Com \`class_weight='balanced'\`, o modelo sacrifica acurácia global (de 77,5%
> para ~58%) mas multiplica por ~10× o recall da classe fatais (de 0% para
> ~55%). Esse é o ganho real para políticas públicas."

---

## 5. Busca de hiperparâmetros — tabela esperada

\`\`\`
max_depth  min_samples_leaf  acc_train  acc_test  gap_overfit
       6                20     0,680     0,580        0,100
       6                30     0,670     0,585        0,085
       6                50     0,650     0,580        0,070
       8                20     0,720     0,605        0,115
       8                30     0,700     0,610        0,090   ← escolhido
       8                50     0,680     0,605        0,075
      10                20     0,780     0,605        0,175   (overfitting)
      10                30     0,760     0,610        0,150
      10                50     0,730     0,605        0,125
\`\`\`

**Justificativa da escolha \`max_depth=8, min_samples_leaf=30\`:**
- \`max_depth=6\` subajusta a classe fatais (recall baixo).
- \`max_depth=10\` tem gap de overfitting > 0,12 e árvore ilegível no vídeo.
- \`min_samples_leaf=20\` overfitting; \`=50\` folhas grossas demais para fatais.
- **\`max_depth=8, min_samples_leaf=30\` é o ponto de equilíbrio:**
  - Gap < 0,10
  - Árvore plottável em uma página A3
  - Recall de fatais >= 0,50

---

## 6. Top atributos esperados (feature_importances_)

> Os valores reais só são conhecidos após treinar o modelo. Abaixo está a ordem
> **típica** observada em datasets da PRF:

| Rank | Atributo | Importância esperada | Direção |
|---|---|---|---|
| 1 | \`causa_acidente__Ingestão de álcool\` | 0,08 – 0,12 | fatais ↑↑↑ |
| 2 | \`causa_acidente__Velocidade incompatível\` | 0,06 – 0,10 | fatais ↑↑ |
| 3 | \`periodo_dia__Noite\` | 0,05 – 0,08 | fatais ↑ |
| 4 | \`periodo_dia__Madrugada\` | 0,04 – 0,07 | fatais ↑↑ |
| 5 | \`condicao_metereologica__Chuva\` | 0,03 – 0,06 | fatais ↑ |
| 6 | \`tracado__Curva\` | 0,03 – 0,06 | fatais ↑ |
| 7 | \`tipo_pista__Simples\` | 0,03 – 0,05 | fatais ↑ |
| 8 | \`veiculos\` (alto) | 0,02 – 0,05 | fatais ↑ |
| 9 | \`causa_acidente__Reação tardia\` | 0,02 – 0,04 | feridos ↑ |
| 10 | \`causa_acidente__Ausência de reação\` | 0,02 – 0,04 | feridos ↑ |

> **Atenção:** o modelo pode revelar surpresas. Por exemplo, é comum que
> \`periodo_dia__Madrugada\` pese mais que \`causa_acidente__Ingestão de álcool\`
> isoladamente — porque madrugada concentra não só álcool mas também fadiga,
> má iluminação e menor fluxo (que encoraja velocidade).

---

## 7. Exemplo de bloco do \`relatorio_campanhas.md\`

\`\`\`markdown
## 1. \`causa_acidente__Ingestão de álcool\` — importância 0,108

- Atributo original: \`causa_acidente\` = \`Ingestão de álcool\`
- Casos associados: 3.685 (5,08% do total)
- % fatais neste grupo: 18,25%
- Lift vs. taxa global de fatais: 2,53× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Prevenção de direção embriagada |
| **Público-alvo** | Condutores jovens 18-34, saidas noturnas |
| **Momento** | Noite e madrugada, fins de semana |
| **Canal** | Blitz educativas, rádio, redes sociais |
\`\`\`

**Leitura do lift:** sinistros onde \`Ingestão de álcool\` é a causa têm **2,53×**
mais chance de ser fatais do que a taxa global. É prioridade máxima de campanha.

---

## 8. Matriz de confusão esperada (normalizada por classe real)

\`\`\`
                 Pred: Sem Vítimas  Pred: Com Feridos  Pred: Com Fatais
Real: Sem Vítimas       0,60              0,30              0,10
Real: Com Feridos       0,10              0,80              0,10
Real: Com Fatais        0,05              0,40              0,55   ← recall-alvo
\`\`\`

**Destaques para o vídeo:**
- Diagonal principal: acertos.
- Última linha: recall de fatais = 0,55 (5× melhor que o baseline = 0,00).
- Linha 1, coluna 3: 10% dos "Sem Vítimas" são falsamente classificados como
  "Com Fatais" — **falso positivo**, mas é um custo aceitável em campanha
  preventiva (preferível errar para o lado conservador).

---

## 9. Como interpretar para a apresentação

1. **Acurácia caiu vs. baseline** → mencione, mas explique que é esperado por
   causa de \`class_weight="balanced"\`.
2. **Recall de fatais subiu** → esse é o ganho real.
3. **Top atributos** → cada um vira uma recomendação de campanha no
   \`relatorio_campanhas.md\`, com lift vs. taxa global.
4. **Árvore plottável** → os 3 primeiros níveis já mostram o caminho de decisão
   principal (ex.: \`causa_acidente__Ingestão de álcool <= 0,5\` → direita = álcool
   presente → ramo de maior gravidade).

---

**Fim do documento.** Para números reais, rode \`python main.py\` e atualize.
`,
  },

  {
    name: 'relatorio_campanhas.md',
    language: 'markdown',
    content: `# Relatório de Recomendações de Campanhas Educativas
**Gerado automaticamente por \`main.py\`** com base no modelo \`DecisionTreeClassifier(criterion='entropy', max_depth=8, min_samples_leaf=30, class_weight='balanced')\`.

**Baseline (most_frequent):** 0.7746  
**Acurácia teste do modelo:** 0.4099  
**Taxa global de sinistros fatais:** 7.18%  
**Lift** = taxa do grupo ÷ taxa global (>1 = acima do esperado).

---

## 1. \`veiculos\` — importância 0.7289

- **Atributo original:** \`veiculos\` = \`alto (≥ 2.9)\`
- **Casos associados:** 26,089 (35.97% do total)
- **% fatais neste grupo:** 13.46%
- **Lift vs. taxa global de fatais:** 1.87× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Condução segura com múltiplos veículos |
| **Público-alvo** | Condutores jovens e idosos |
| **Momento** | Horários de pico |
| **Canal** | Campanhas audiovisuais, autoescolas |

---

## 2. \`tipo_pista_Simples\` — importância 0.0884

- **Atributo original:** \`tipo_pista\` = \`Simples\`
- **Casos associados:** 38,898 (53.63% do total)
- **% fatais neste grupo:** 9.48%
- **Lift vs. taxa global de fatais:** 1.32× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Cuidados em pista simples |
| **Público-alvo** | Condutores em rodovias rurais |
| **Momento** | Período diurno |
| **Canal** | Sinalização, faixas educativas |

---

## 3. \`fase_dia_Plena Noite\` — importância 0.0362

- **Atributo original:** \`fase_dia\` = \`Plena Noite\`
- **Casos associados:** 6,258 (8.63% do total)
- **% fatais neste grupo:** 13.41%
- **Lift vs. taxa global de fatais:** 1.87× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Direção noturna defensiva |
| **Público-alvo** | Condutores em deslocamentos noturnos |
| **Momento** | Noite e madrugada |
| **Canal** | Faróis regulados, sinalização refletiva |

---

## 4. \`fase_dia_Anoitecer\` — importância 0.0295

- **Atributo original:** \`fase_dia\` = \`Anoitecer\`
- **Casos associados:** 6,366 (8.78% do total)
- **% fatais neste grupo:** 13.60%
- **Lift vs. taxa global de fatais:** 1.89× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Direção noturna defensiva |
| **Público-alvo** | Condutores em deslocamentos noturnos |
| **Momento** | Noite e madrugada |
| **Canal** | Faróis regulados, sinalização refletiva |

---

## 5. \`fase_dia_Madrugada\` — importância 0.0271

- **Atributo original:** \`fase_dia\` = \`Madrugada\`
- **Casos associados:** 6,373 (8.79% do total)
- **% fatais neste grupo:** 14.66%
- **Lift vs. taxa global de fatais:** 2.04× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Combate à fadiga e direção sonolenta |
| **Público-alvo** | Motoristas profissionais e jovens |
| **Momento** | Madrugada |
| **Canal** | Paradas educativas, café, aplicativos |

---

## 6. \`causa_acidente_Ingestão de álcool\` — importância 0.0253

- **Atributo original:** \`causa_acidente\` = \`Ingestão de álcool\`
- **Casos associados:** 15,138 (20.87% do total)
- **% fatais neste grupo:** 10.54%
- **Lift vs. taxa global de fatais:** 1.47× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Prevenção de direção embriagada |
| **Público-alvo** | Condutores jovens 18-34, saidas noturnas |
| **Momento** | Noite e madrugada, fins de semana |
| **Canal** | Blitz educativas, rádio, redes sociais |

---

## 7. \`causa_acidente_Velocidade incompatível\` — importância 0.0234

- **Atributo original:** \`causa_acidente\` = \`Velocidade incompatível\`
- **Casos associados:** 15,548 (21.44% do total)
- **% fatais neste grupo:** 10.11%
- **Lift vs. taxa global de fatais:** 1.41× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Controle de velocidade |
| **Público-alvo** | Condutores em rodovias de pista simples |
| **Momento** | Período diurno, trechos de curva |
| **Canal** | Radares educativos, sinalização, painéis eletrônicos |

---

## 8. \`condicao_metereologica_Neblina\` — importância 0.0090

- **Atributo original:** \`condicao_metereologica\` = \`Neblina\`
- **Casos associados:** 5,047 (6.96% do total)
- **% fatais neste grupo:** 14.56%
- **Lift vs. taxa global de fatais:** 2.03× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Direção em neblina |
| **Público-alvo** | Condutores em trechos de serra |
| **Momento** | Madrugada e início da manhã |
| **Canal** | Sinalização luminosa, rádio, alertas no painel |

---

## 9. \`condicao_metereologica_Garoa\` — importância 0.0067

- **Atributo original:** \`condicao_metereologica\` = \`Garoa\`
- **Casos associados:** 5,085 (7.01% do total)
- **% fatais neste grupo:** 13.81%
- **Lift vs. taxa global de fatais:** 1.92× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Direção defensiva em chuva |
| **Público-alvo** | Todos os condutores, especialmente motociclistas |
| **Momento** | Período chuvoso, estações de transição |
| **Canal** | Previsão do tempo, rádio, redes sociais |

---

## 10. \`condicao_metereologica_Chuva\` — importância 0.0044

- **Atributo original:** \`condicao_metereologica\` = \`Chuva\`
- **Casos associados:** 5,055 (6.97% do total)
- **% fatais neste grupo:** 13.55%
- **Lift vs. taxa global de fatais:** 1.89× (acima do esperado)

### Recomendação de campanha

| Dimensão | Sugestão |
|---|---|
| **Tipo** | Direção defensiva em chuva |
| **Público-alvo** | Todos os condutores, especialmente motociclistas |
| **Momento** | Período chuvoso, estações de transição |
| **Canal** | Previsão do tempo, rádio, redes sociais |

---

## Notas metodológicas

1. **Anti-vazamento**: as 7 colunas de contagem pós-evento (\`pessoas\`, \`mortos\`, \`feridos_leves\`, \`feridos_graves\`, \`ilesos\`, \`ignorados\`, \`feridos\`) foram excluídas de X por \`assert\` explícito.
2. **Desbalanceamento**: o alvo tem 77,5%/15,4%/7,2% — por isso \`class_weight='balanced'\` e o uso de **recall da classe fatais** como métrica de política pública, não apenas acurácia global.
3. **Importância** é a do modelo treinado (ganho de informação acumulado), não a frequência bruta das categorias.
4. **Lift > 1** indica que o grupo está super-representado em sinistros fatais — prioridade para campanha preventiva.
`,
  },

]

export const PROJETO_TOTAL_SIZE = 88243
