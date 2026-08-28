# Relatório de Recomendações de Campanhas Educativas
**Gerado automaticamente por `main.py`** com base no modelo `DecisionTreeClassifier(criterion='entropy', max_depth=8, min_samples_leaf=30, class_weight='balanced')`.

**Baseline (most_frequent):** 0.7746  
**Acurácia teste do modelo:** 0.4099  
**Taxa global de sinistros fatais:** 7.18%  
**Lift** = taxa do grupo ÷ taxa global (>1 = acima do esperado).

---

## 1. `veiculos` — importância 0.7289

- **Atributo original:** `veiculos` = `alto (≥ 2.9)`
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

## 2. `tipo_pista_Simples` — importância 0.0884

- **Atributo original:** `tipo_pista` = `Simples`
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

## 3. `fase_dia_Plena Noite` — importância 0.0362

- **Atributo original:** `fase_dia` = `Plena Noite`
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

## 4. `fase_dia_Anoitecer` — importância 0.0295

- **Atributo original:** `fase_dia` = `Anoitecer`
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

## 5. `fase_dia_Madrugada` — importância 0.0271

- **Atributo original:** `fase_dia` = `Madrugada`
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

## 6. `causa_acidente_Ingestão de álcool` — importância 0.0253

- **Atributo original:** `causa_acidente` = `Ingestão de álcool`
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

## 7. `causa_acidente_Velocidade incompatível` — importância 0.0234

- **Atributo original:** `causa_acidente` = `Velocidade incompatível`
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

## 8. `condicao_metereologica_Neblina` — importância 0.0090

- **Atributo original:** `condicao_metereologica` = `Neblina`
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

## 9. `condicao_metereologica_Garoa` — importância 0.0067

- **Atributo original:** `condicao_metereologica` = `Garoa`
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

## 10. `condicao_metereologica_Chuva` — importância 0.0044

- **Atributo original:** `condicao_metereologica` = `Chuva`
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

1. **Anti-vazamento**: as 7 colunas de contagem pós-evento (`pessoas`, `mortos`, `feridos_leves`, `feridos_graves`, `ilesos`, `ignorados`, `feridos`) foram excluídas de X por `assert` explícito.
2. **Desbalanceamento**: o alvo tem 77,5%/15,4%/7,2% — por isso `class_weight='balanced'` e o uso de **recall da classe fatais** como métrica de política pública, não apenas acurácia global.
3. **Importância** é a do modelo treinado (ganho de informação acumulado), não a frequência bruta das categorias.
4. **Lift > 1** indica que o grupo está super-representado em sinistros fatais — prioridade para campanha preventiva.
