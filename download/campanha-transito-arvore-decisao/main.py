"""
main.py
=======

Pipeline de ponta a ponta para construir um modelo de Árvore de Decisão
apoiando campanhas educativas de trânsito a partir de `datatran2025.csv`.

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
)

# ------------------------------------------------------------
# Constantes centralizadas — sem números mágicos no código
# ------------------------------------------------------------
BASE_DIR = Path(__file__).parent
CSV_PATH = BASE_DIR / "datatran2025.csv"
OUTPUTS_DIR = BASE_DIR / "outputs"
RELATORIO_PATH = BASE_DIR / "relatorio_campanhas.md"

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
    + ["data_inversa", "horario"]  # já derivadas em `mes` e `hora_int`/`periodo_dia`
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
            f"Arquivo nao encontrado: {path}\n"
            "Baixe o CSV em:\n"
            "  https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf\n"
            "ou gere dados sinteticos para teste:\n"
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
    print("\n=== Busca de hiperparametros ===")
    print(df.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print(f"\nEscolha padrão: max_depth={MAX_DEPTH_DEFAULT}, "
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
    print(f"\n[Modelo Final] Treinado com criterion='entropy', "
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

    print("\n=== Avaliacao ===")
    print(f"  Baseline (most_frequent):     acc_test = {acc_baseline:.4f}  (~{acc_baseline*100:.1f}%)")
    print(f"  Arvore - acc_treino:                       {acc_train:.4f}")
    print(f"  Arvore - acc_teste:                        {acc_test:.4f}")
    print(f"  Gap overfitting (treino - teste):          {acc_train-acc_test:+.4f}")
    print(f"  Lift vs baseline:                          {acc_test-acc_baseline:+.4f}")

    y_pred = modelo.predict(X_test)
    print("\n=== Classification Report (teste) ===")
    print(classification_report(y_test, y_pred, digits=3))

    # Matriz de confusão normalizada por linha (true) — vê recall por classe
    OUTPUTS_DIR.mkdir(exist_ok=True)
    fig, ax = plt.subplots(figsize=(9, 7), constrained_layout=True)
    ConfusionMatrixDisplay.from_predictions(
        y_test, y_pred, normalize="true", xticks_rotation=30,
        cmap="Blues", ax=ax, values_format=".2f",
    )
    ax.set_title(f"Matriz de Confusão (normalizada por classe real)\n"
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
    print(f"\n[Relatório] Taxa global de fatais: {TAXA_GLOBAL_FATAIS:.4f} "
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
    blocos.append("# Relatório de Recomendações de Campanhas Educativas\n")
    blocos.append(f"**Gerado automaticamente por `main.py`** com base no modelo "
                  f"`DecisionTreeClassifier(criterion='entropy', "
                  f"max_depth={MAX_DEPTH_DEFAULT}, "
                  f"min_samples_leaf={MIN_SAMPLES_LEAF_DEFAULT}, "
                  f"class_weight='balanced')`.\n\n")
    blocos.append(f"**Baseline (most_frequent):** {acc_baseline:.4f}  \n")
    blocos.append(f"**Acurácia teste do modelo:** {acc_test:.4f}  \n")
    blocos.append(f"**Taxa global de sinistros fatais:** "
                  f"{TAXA_GLOBAL_FATAIS*100:.2f}%  \n")
    blocos.append(f"**Lift** = taxa do grupo ÷ taxa global (>1 = acima do esperado).\n\n")
    blocos.append("---\n\n")

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
                mask = (df_stats.filter(like="tracado__").sum(axis=1) > 0) & \
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
            f"## {rank+1}. `{nome_attr}` — importância {imp:.4f}\n\n"
            f"- **Atributo original:** `{col_orig}`"
            + (f" = `{valor}`" if valor is not None else "") + "\n"
            f"- **Casos associados:** {n_casos:,} ({pct_total:.2f}% do total)\n"
            f"- **% fatais neste grupo:** {taxa_fatais_grupo*100:.2f}%\n"
            f"- **Lift vs. taxa global de fatais:** {lift_val:.2f}× "
            f"({'acima' if lift_val > 1.05 else 'abaixo/dentro' if lift_val < 0.95 else 'próximo de'} do esperado)\n\n"
            f"### Recomendação de campanha\n\n"
            f"| Dimensão | Sugestão |\n"
            f"|---|---|\n"
            f"| **Tipo** | {tipo_campanha} |\n"
            f"| **Público-alvo** | {publico} |\n"
            f"| **Momento** | {momento} |\n"
            f"| **Canal** | {canal} |\n\n"
            f"---\n\n"
        )
        blocos.append(bloco)

    # Considerações finais
    blocos.append("## Notas metodológicas\n\n")
    blocos.append("1. **Anti-vazamento**: as 7 colunas de contagem pós-evento "
                  "(`pessoas`, `mortos`, `feridos_leves`, `feridos_graves`, `ilesos`, "
                  "`ignorados`, `feridos`) foram excluídas de X por `assert` explícito.\n")
    blocos.append("2. **Desbalanceamento**: o alvo tem 77,5%/15,4%/7,2% — por isso "
                  "`class_weight='balanced'` e o uso de **recall da classe fatais** como "
                  "métrica de política pública, não apenas acurácia global.\n")
    blocos.append("3. **Importância** é a do modelo treinado (ganho de informação "
                  "acumulado), não a frequência bruta das categorias.\n")
    blocos.append("4. **Lift > 1** indica que o grupo está super-representado em "
                  "sinistros fatais — prioridade para campanha preventiva.\n")

    RELATORIO_PATH.write_text("".join(blocos), encoding="utf-8")
    print(f"\n[Relatório] Salvo em: {RELATORIO_PATH}")


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
    print(f"\n[Split] Treino: {X_train.shape[0]:,} | Teste: {X_test.shape[0]:,} "
          f"(stratify=y, random_state={RANDOM_STATE})")

    # 9. Baseline trivial
    baseline = DummyClassifier(strategy="most_frequent", random_state=RANDOM_STATE)
    baseline.fit(X_train, y_train)
    print(f"[Baseline] DummyClassifier(most_frequent) treinado.")

    # 10. Busca de hiperparâmetros
    buscar_hiperparametros(X_train, y_train, X_test, y_test)

    # 11. Modelo final
    modelo = treinar_modelo_final(X_train, y_train)

    # 12. Avaliação + matriz de confusão
    metricas = avaliar(modelo, X_train, y_train, X_test, y_test, baseline)

    # 13. Interpretação: importância + árvore
    print("\n=== Interpretação ===")
    df_imp = plotar_importancias(modelo, X_train, top_n=20)
    plotar_arvore(modelo, X_train, y_train, max_depth_plot=3)

    # 14. Relatório de campanhas
    # Para estatísticas de % fatais por grupo, precisamos do df com colunas originais
    # e dummies tracado__. Já temos isso em `df`.
    df_para_relatorio = df.copy()
    # Adicionar alvo para cálculos internos
    df_para_relatorio[TARGET] = y.values
    gerar_relatorio_campanhas(
        df_para_relatorio, df_imp, modelo, X_train,
        acc_baseline=metricas["acc_baseline"],
        acc_test=metricas["acc_test"],
        top_n_atributos=10,
    )

    print("\n" + "=" * 70)
    print("PIPELINE CONCLUIDO.")
    print(f"  Outputs:  {OUTPUTS_DIR}/")
    print(f"  Relatório: {RELATORIO_PATH}")
    print("=" * 70)


if __name__ == "__main__":
    main()
