// Arquivo único: RESULTADOS_ESPERADOS.md — disponível para download separado

export const RESULTADOS_ESPERADOS_CONTENT = `# Resultados Esperados — Simulação Didática

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
`

export const RESULTADOS_ESPERADOS_SIZE = 7081
