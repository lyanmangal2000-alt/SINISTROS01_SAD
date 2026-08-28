# Worklog — Projeto: Árvore de Decisão para Campanhas Educativas no Trânsito

---
Task ID: AV1
Agent: Super Z (main agent)
Task: Implementar pipeline de ponta a ponta (leitura, limpeza, engenharia, árvore de decisão com entropia, avaliação e recomendações de campanha) sobre `datatran2025.csv`, entregando repositório Git autossuficiente conforme especificação detalhada do usuário.

Work Log:
- Analisada a especificação completa do prompt (PAPEL, CONTEXTO, 30 colunas, vazamento de 7 colunas, classes 77,5/15,4/7,2%, hiperparâmetros sugeridos, estrutura de entrega).
- Criada estrutura de diretórios em `/home/z/my-project/download/campanha-transito-arvore-decisao/` com subpasta `outputs/`.
- Tentativa de baixar `datatran2025.csv` diretamente da PRF e de dados.gov.br — ambas retornam HTML (página intermediária, não URL direta). Busca web não encontrou mirror público confiável. Decisão: gerar dataset sintético com schema idêntico para validar o pipeline; documentar que o usuário deve baixar o CSV real manualmente.
- Escrito `requirements.txt` com versões pinadas (pandas==2.2.2, numpy==1.26.4, scikit-learn==1.5.0, matplotlib==3.9.0, seaborn==0.13.2).
- Escrito `.gitignore` cobrindo CSV, outputs/, __pycache__/, .venv/, etc.
- Escrito `validar_leitura.py` — 10 verificações em ~60 linhas.
- Escrito `gerar_dados_sinteticos.py` — gera 72.529 linhas com schema idêntico (30 colunas), distribuição do alvo 77,5/15,4/7,2%, correlações plausíveis (álcool/velocidade/noturno → fatais).
- Escrito `main.py` (~730 linhas) — pipeline autossuficiente com:
  * Constantes centralizadas (LEAKAGE_COLS, EXCLUDE_COLS, NOMINAL_COLS, MAX_DEPTH_DEFAULT=8, MIN_SAMPLES_LEAF_DEFAULT=30, RANDOM_STATE=42).
  * Funções com docstrings.
  * `assert` anti-vazamento obrigatório em local visível.
  * Engenharia: horario→hora_int+periodo_dia, data_inversa→mes, tracado_via via MultiLabelBinarizer.
  * Agrupamento de categorias raras (<1%) em causa_acidente/tipo_acidente.
  * One-Hot com drop_first=False (árvores não sofrem com multicolinearidade).
  * Split estratificado 70/30 com random_state=42.
  * Baseline DummyClassifier(most_frequent).
  * Grid 3x3 (max_depth∈{6,8,10} × min_samples_leaf∈{20,30,50}).
  * Modelo final com criterion="entropy", class_weight="balanced".
  * Avaliação: acurácia treino/teste, classification_report(digits=3), matriz_confusao.png normalizada por classe real.
  * feature_importances_ top 20 (importancia_atributos.png).
  * plot_tree(max_depth=3) (arvore_decisao.png).
  * relatorio_campanhas.md com 10 atributos top (nome, importância, n casos, % fatais, lift vs taxa global, tipo/público/momento/canal de campanha).
- Escrito `README.md` documentando: contexto, pergunta gerencial, base de dados (parâmetros de leitura obrigatórios), vazamento (com assert), 3 classes mantidas, engenharia, hiperparâmetros testados, como rodar, estrutura, resultados (placeholder), reprodutibilidade.
- Escrito `RESULTADOS_ESPERADOS.md` com simulação didática (intervalos plausíveis de acurácia/recall, tabela de grid, top atributos esperados, exemplo de bloco de relatório, matriz de confusão esperada).
- Instaladas dependências (PEP 668 impediu instalação com pip normal; versões existentes compatíveis: pandas 2.2.3, numpy 2.1.3, sklearn 1.5.2, matplotlib 3.9.2, seaborn 0.13.2).
- Gerado dataset sintético (16,4 MB) e executado `validar_leitura.py` — passou (72.529×30, encoding OK, alvo presente, vazamento presente mas será removido).
- Executado `main.py` — dois bugs corrigidos iterativamente:
  1. `mes` era numérico (Int64) e `pd.get_dummies` o ignorava, quebrando `prefix=cols_nom` (lista de tamanho 11 vs 10). Fix: converter `mes` para string `"mes_1".."mes_12"` antes do one-hot.
  2. `data_inversa` e `horario` ficavam em X como strings, quebrando o sklearn. Fix: adicionar à lista `EXCLUDE_COLS`.
- Re-executado `main.py` — pipeline OK, 3 PNGs + relatório gerados.
- Bug no relatório: `decodificar_dummy` só casava prefixo `__` (tracado) — dummies como `tipo_pista_Simples` (prefixo `_`) retornavam `(qualquer)` e a estatística saía "100% do total, lift 1.0". Fix: iterar sobre NOMINAL_COLS e cascar prefixo `<col>+"_+"`.
- Melhoria cosmética: `sugerir_campanha` não cobria "Plena Noite", "Anoitecer", "Garoa" — adicionados casos para fase_dia (qualquer valor noturno), garoa agrupada com chuva.
- Re-executado `main.py` — relatório agora com 10 blocos específicos, cada um com tipo/público/momento/canal acionáveis.
- Checklist de aceitação: 22/23 OK. A única "falha" é falso-positivo do check (procura por `max_depth=8` literal, mas o código usa constante `MAX_DEPTH_DEFAULT = 8` — melhor prática).
- Apagado o CSV sintético do diretório de entrega (deve ser baixado pelo usuário ou regenerado com `python gerar_dados_sinteticos.py`).

Stage Summary:
- **Pipeline Python completo e funcional** entregue em `/home/z/my-project/download/campanha-transito-arvore-decisao/`.
- **Arquivos**: README.md, RESULTADOS_ESPERADOS.md, requirements.txt, .gitignore, validar_leitura.py, gerar_dados_sinteticos.py, main.py + outputs/ (3 PNGs) + relatorio_campanhas.md.
- **Validado end-to-end** com dataset sintético de 72.529 linhas — pipeline roda sem erros e gera todos os artefatos esperados.
- **Decisões documentadas**: vazamento (assert + README), 3 classes mantidas, hiperparâmetros (grid 3x3 + justificativa de escolha), class_weight="balanced" (ganho real em recall de fatais, não em acurácia global).
- **Restrição**: o CSV real `datatran2025.csv` não está disponível por URL pública direta; o usuário deve baixá-lo manualmente da PRF ou executar `python gerar_dados_sinteticos.py` para teste rápido.
- **Próximos passos sugeridos ao usuário**: (1) baixar CSV real da PRF, (2) rodar `python validar_leitura.py` para confirmar leitura, (3) rodar `python main.py`, (4) atualizar README.md e RESULTADOS_ESPERADOS.md com números reais, (5) gravar vídeo de 5-7min seguindo o roteiro, (6) publicar no GitHub e enviar para lina@ls4business.com.br.
