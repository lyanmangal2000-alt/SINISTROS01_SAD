# Campanha Educativa no Trânsito — Árvore de Decisão (AV1)

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

**Arquivo:** `datatran2025.csv` — 72.529 registros × 30 colunas, cobrindo os 365
dias de 2025 (01/01 a 31/12), fonte: Polícia Rodoviária Federal (PRF), via
[dados.gov.br](https://dados.gov.br/dados/conjunto-dados-abertos-acidentes-prf)
e
[gov.br/prf](https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf).

### Leitura correta (obrigatória)

```python
import pandas as pd

df = pd.read_csv(
    "datatran2025.csv",
    sep=";",            # delimitador é ponto-e-vírgula, não vírgula
    encoding="latin1",  # ISO-8859-1 — acentuação quebra com utf-8
    decimal=",",        # km/latitude/longitude usam vírgula decimal (padrão BR)
)
```

Sem esses três parâmetros a leitura falha silenciosamente:
colunas quebradas ou acentos corrompidos (ex.: "VM-mtimas" em vez de "Vítimas").

### Esquema — 30 colunas agrupadas

| Grupo | Colunas | Tratamento |
|---|---|---|
| Identificação | `id` | Excluir (único, sem poder preditivo) |
| Temporais | `data_inversa`, `dia_semana`, `horario` | Engenharia obrigatória |
| Localização | `uf`, `br`, `km`, `municipio`, `latitude`, `longitude` | Manter `uf`; excluir o restante |
| Circunstanciais | `causa_acidente`, `tipo_acidente`, `fase_dia`, `sentido_via`, `condicao_metereologica`, `tipo_pista`, `tracado_via`, `uso_solo` | Preditores-chave |
| **Alvo** | `classificacao_acidente` | Ver [Variável-alvo](#variável-alvo-3-classes-mantidas) |
| **VAZAMENTO** | `pessoas`, `mortos`, `feridos_leves`, `feridos_graves`, `ilesos`, `ignorados`, `feridos` | **EXCLUIR** |
| Envolvimento | `veiculos` | Manter como numérica |
| Administrativas | `regional`, `delegacia`, `uop` | Excluir (alta cardinalidade, redundantes com `uf`) |

### Qualidade dos dados

- Sem `id` duplicado · `km` (0–1257) e `br` (0–495) sem absurdos.
- Nulos: `uop` (38), `delegacia` (22), `regional` (2), `classificacao_acidente` (1).
- **Ação obrigatória:** `df.dropna(subset=["classificacao_acidente"])` — sem
  rótulo, a linha não serve para treino nem teste.

---

## Decisões metodológicas

### Vazamento de dados

As 7 colunas `pessoas`, `mortos`, `feridos_leves`, `feridos_graves`, `feridos`,
`ilesos`, `ignorados` são a **contagem pós-evento que originou o próprio rótulo**
`classificacao_acidente`. Incluir qualquer uma delas em `X` produz modelo com
~100% de acurácia artificial — apenas redescobre a regra que gerou o rótulo, sem
revelar nenhum fator **acionável** para campanha educativa.

**Confirmação nos dados:**
- Toda linha "Com Vítimas Fatais" tem `mortos ≥ 1`
- Toda linha "Sem Vítimas" tem `mortos = 0` **E** `feridos = 0`

**Implementação:** há um `assert` explícito em `main.py` que bloqueia a
presença de qualquer dessas colunas em `X`:

```python
LEAKAGE_COLS = ["pessoas","mortos","feridos_leves","feridos_graves",
                "ilesos","ignorados","feridos"]
assert not set(LEAKAGE_COLS) & set(X.columns), "Coluna de vazamento presente em X!"
```

**`veiculos`** é mantida como preditora: é conhecida no momento do sinistro (não
deriva da contagem de vítimas) e mostra relação real com gravidade
(média: ~2,5 veículos em fatais vs ~1,9 em sem vítimas).

### Variável-alvo: 3 classes mantidas

`classificacao_acidente` tem 3 classes originais:

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
`DummyClassifier(strategy="most_frequent")` e comparamos contra o modelo
treinado. **Acurácia isolada, sem este contraste, não demonstra desempenho real.**

### Engenharia de atributos

| Coluna original | Transformação | Justificativa |
|---|---|---|
| `horario` (1.412 valores HH:MM:SS) | `hora_int` (0–23) + `periodo_dia` (4 categorias: Madrugada/Manhã/Tarde/Noite) | String bruta fragmentaria a árvore |
| `tracado_via` (605 valores!) | `MultiLabelBinarizer` após `.str.split(";")` — colunas binárias por palavra-chave (Curva, Reta, Aclive, Declive, Rotatória, …) | É multirrótulo, não categórica simples |
| `data_inversa` (365 datas) | `mes` (1–12) | Análise sazonal sem explodir cardinalidade |

Categorias raras de `causa_acidente` (69 categorias originais; 24 têm <100
ocorrências) e `tipo_acidente` (17 categorias) são agrupadas em `"Outros"` quando
a frequência cai abaixo de 1% (~725 registros) antes do one-hot.

### Hiperparâmetros testados

Testamos uma grade 3×3:

| `max_depth` \ `min_samples_leaf` | 20 | 30 | 50 |
|---|---|---|---|
| 6 | . | . | . |
| **8** | . | **★ escolhido** | . |
| 10 | . | . | . |

A tabela completa é impressa em stdout na execução do `main.py`. A escolha
padrão (`max_depth=8`, `min_samples_leaf=30`) reflete um trade-off:

- `max_depth=6` → árvore simples mas com tendência a subajustar a classe
  minoritária fatais (recall baixo).
- `max_depth=10` → ganho marginal de acurácia, mas árvore menos legível no
  vídeo e maior gap de overfitting (treino > teste).
- `max_depth=8` + `min_samples_leaf=30` → melhor equilíbrio entre
  interpretabilidade (plotável), generalização e recall da classe fatais.

`class_weight="balanced"` repondera as classes inversamente à sua frequência,
forçando o modelo a se importar mais com a classe minoritária (7,2% de
fatais). **O efeito colateral é que a acurácia global cai vs. baseline, mas o
recall de fatais sobe** — esse é exatamente o ganho real para políticas públicas.

`random_state=42` em todos os pontos estocásticos (split, árvore, baseline).

---

## Como rodar

### 1. Ambiente

```bash
# Setup
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Obter o CSV

Baixe `datatran2025.csv` em:
- https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf
- https://dados.gov.br/dados/conjunto-dados-abertos-acidentes-prf

Salve na **raiz** do projeto.

> **Alternativa para teste rápido:** rode `python gerar_dados_sinteticos.py`
> para gerar um dataset sintético com schema idêntico (distribuições aproximadas,
> apenas para validar o código end-to-end).

### 3. Validação rápida

```bash
python validar_leitura.py
```

Saída esperada (com CSV real):
```
[OK] Arquivo encontrado: ./datatran2025.csv
[OK] Leitura OK com sep=';' encoding='latin1' decimal=','
[OK] Linhas: 72529 (esperado ~72529)
[OK] Colunas: 30 (esperado 30)
[OK] Coluna-alvo 'classificacao_acidente' presente
```

### 4. Pipeline completo

```bash
python main.py
```

Saídas:
- `outputs/matriz_confusao.png` — matriz normalizada por classe real
- `outputs/arvore_decisao.png` — primeiros 3 níveis da árvore (legível)
- `outputs/importancia_atributos.png` — top 20 `feature_importances_`
- `relatorio_campanhas.md` — recomendações de campanha por atributo

---

## Estrutura do projeto

```
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
```

---

## Resultados

> **Placeholder** — preencher com os números reais após executar `python main.py`.
> Consulte `RESULTADOS_ESPERADOS.md` para uma simulação didática.

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

- `random_state=42` em todos os estágios estocásticos (split, DecisionTree, DummyClassifier).
- Versões pinadas em `requirements.txt` (pandas==2.2.2, numpy==1.26.4, scikit-learn==1.5.0, matplotlib==3.9.0, seaborn==0.13.2).
- CSV não versionado (21 MB) — `.gitignore` cobre.
- Outros profissionais devem conseguir ler, executar e manter o código.
