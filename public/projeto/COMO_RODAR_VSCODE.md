# 🚀 Como Rodar no VS Code — Passo a Passo

> Este guia mostra como abrir, configurar e rodar o projeto no Visual Studio Code, do zero até ver o dashboard funcionando.

---

## 📋 Pré-requisitos

Antes de começar, instale:

1. **Python 3.10+** → https://www.python.org/downloads/
   - No Windows: marque a caixa **"Add Python to PATH"** durante a instalação
   - No Mac: `brew install python` ou baixe do site
   - No Linux: `sudo apt install python3 python3-pip python3-venv`

2. **VS Code** → https://code.visualstudio.com/

3. **Extensões do VS Code** (instale depois de abrir o VS Code):
   - **Python** (Microsoft) — suporte a Python
   - **Pylance** (Microsoft) — autocomplete inteligente
   - **Jupyter** (Microsoft) — opcional, se quiser abrir células
   - **Markdown All in One** — para editar o roteiro do vídeo

4. **Node.js 18+** (só se quiser rodar o dashboard Next.js) → https://nodejs.org/

---

## 🔽 Passo 1 — Baixar e descompactar o projeto

1. Baixe o arquivo `campanha-transito-arvore-decisao.zip`
2. Descompacte em uma pasta de sua preferência:
   - Windows: `C:\Users\SEU_USUARIO\Documents\campanha-transito-arvore-decisao`
   - Mac: `/Users/SEU_USUARIO/Documents/campanha-transito-arvore-decisao`
   - Linux: `/home/SEU_USUARIO/campanha-transito-arvore-decisao`

> **Importante:** o caminho não deve ter **espaços nem acentos**. Se seu usuário for "João Silva", mova a pasta para `C:\projetos\campanha-transito-arvore-decisao`.

---

## 📂 Passo 2 — Abrir o projeto no VS Code

1. Abra o VS Code
2. Menu: **File → Open Folder...** (ou `Ctrl+K Ctrl+O`)
3. Selecione a pasta `campanha-transito-arvore-decisao` descompactada
4. A estrutura deve ficar assim no Explorer (lateral esquerda):

```
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
```

---

## 🐍 Passo 3 — Criar ambiente virtual e instalar dependências

1. Abra o terminal integrado do VS Code:
   - Menu: **Terminal → New Terminal** (ou `` Ctrl+` ``)
   - O terminal abre na pasta do projeto automaticamente

2. Crie o ambiente virtual:

   **Windows (PowerShell):**
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   ```

   **Windows (CMD):**
   ```cmd
   python -m venv .venv
   .venv\Scripts\activate.bat
   ```

   **Mac/Linux:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Quando o ambiente estiver ativo, você verá `(.venv)` no início da linha de comando.

4. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

   > **Se der erro no Windows** dizendo "Microsoft Visual C++ 14.0 is required":
   > - Instale o **Build Tools for Visual Studio**: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   > - Ou use versões mais novas das libs: `pip install pandas numpy scikit-learn matplotlib seaborn` (sem pinning)

---

## ✅ Passo 4 — Validar a leitura do CSV

No terminal (com o `.venv` ativo):

```bash
python validar_leitura.py
```

**Saída esperada:**
```
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
```

Se passou, o ambiente está configurado corretamente. ✅

---

## 🚀 Passo 5 — Rodar o pipeline completo

```bash
python main.py
```

O pipeline vai rodar por ~30 segundos e imprimir o progresso. No final, você terá:

- `outputs/matriz_confusao.png` — heatmap 3×3 (clique duas vezes no VS Code para ver)
- `outputs/arvore_decisao.png` — árvore de decisão
- `outputs/importancia_atributos.png` — top 20 atributos
- `outputs/resultados.json` — payload completo para o dashboard
- `relatorio_campanhas.md` — relatório com 10 recomendações de campanha

**Para ver os PNGs:** dê duplo-clique no arquivo na lateral do VS Code → abre no visualizador integrado.

**Para ver o relatório markdown:** dê duplo-clique em `relatorio_campanhas.md` → pressione `Ctrl+Shift+V` para abrir o preview formatado.

---

## 📊 Passo 6 — (Opcional) Rodar o dashboard Next.js

O dashboard interativo está em uma pasta separada do Next.js. Para rodá-lo:

1. **Baixe o Node.js 18+** (se ainda não tem): https://nodejs.org/

2. **Volte para a pasta do projeto Python** e copie os artefatos:
   ```bash
   # No projeto Python (após rodar python main.py):
   cp outputs/resultados.json /CAMINHO/PRO/NEXTJS/public/data/
   cp outputs/*.png /CAMINHO/PRO/NEXTJS/public/outputs/
   ```

3. **Abra o projeto Next.js no VS Code** (nova janela: `File → New Window`)

4. **No terminal do projeto Next.js:**
   ```bash
   npm install
   npm run dev
   ```

5. **Abra o navegador** em http://localhost:3000

> **Atenção:** se você baixou o projeto Python em ZIP, o dashboard Next.js está em outro repositório. Para o escopo da AV1, o item 2 (apresentação gráfica) pode ser entregue apenas com os PNGs estáticos + o relatório markdown — o dashboard Next.js é um bônus.

---

## 🌐 Passo 7 — Substituir o CSV sintético pelo real da PRF

O ZIP vem com `datatran2025.csv` sintético (apenas para teste do código). Para usar o CSV real:

1. **Baixe o CSV real da PRF:**
   - Acesse https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf
   - Baixe `datatran2025.csv` (arquivo de ~21 MB)

2. **Apague o sintético e coloque o real:**
   ```bash
   # No terminal do projeto Python:
   rm datatran2025.csv
   # Copie o CSV real baixado para esta pasta
   # (no Windows Explorer/Finder, arraste o arquivo baixado para a pasta)
   ```

3. **Valide novamente:**
   ```bash
   python validar_leitura.py
   ```

4. **Rode o pipeline:**
   ```bash
   python main.py
   ```

5. **Anote os números reais** que aparecem no final (acurácia, recall fatais, top atributos) e atualize:
   - `README.md` → seção "Resultados" (substitua os placeholders)
   - `ROTEIRO_VIDEO.md` → substitua os `[XX]%`, `[YY]%` etc. pelos números reais

---

## 🐛 Problemas comuns e soluções

### ❌ "python não é reconhecido como comando interno"
- **Windows:** Python não foi adicionado ao PATH. Reinstale marcando "Add Python to PATH" ou adicione manualmente em Variáveis de Ambiente.
- **Mac/Linux:** use `python3` em vez de `python`.

### ❌ "ModuleNotFoundError: No module named 'pandas'"
- O ambiente virtual `.venv` não está ativo. Rode `source .venv/bin/activate` (Mac/Linux) ou `.venv\Scripts\activate` (Windows) antes de rodar `python main.py`.

### ❌ "Permission denied" ao ativar o .venv no Windows
- Abra o PowerShell como administrador e rode:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

### ❌ Encoding error na leitura do CSV (TypeError ou UnicodeDecodeError)
- Verifique se está usando `encoding="latin1"` no `pd.read_csv`. O parâmetro está correto no `validar_leitura.py` e `main.py`.

### ❌ "Could not convert string to float"
- Provavelmente há colunas de string ainda em X. Verifique se a versão do `main.py` que você tem inclui `"data_inversa", "horario"` na constante `EXCLUDE_COLS`.

### ❌ Árvore de decisão muito grande / ilegível no PNG
- Reduza `MAX_DEPTH_DEFAULT = 6` no topo do `main.py` e rode novamente.

### ❌ Resultados diferentes dos esperados (acurácia, recall)
- Se você está usando o CSV sintético, espere números didáticos próximos dos placeholders. Para resultados reais, baixe o CSV da PRF (ver Passo 7).

---

## ✅ Checklist final antes de entregar

- [ ] Projeto descompactado e aberto no VS Code
- [ ] Ambiente virtual `.venv` criado e ativado
- [ ] Dependências instaladas (`pip install -r requirements.txt`)
- [ ] `python validar_leitura.py` passou
- [ ] `python main.py` rodou sem erros e gerou os 3 PNGs + JSON + relatório
- [ ] CSV real da PRF baixado e substituído (opcional, mas recomendado)
- [ ] README.md atualizado com números reais
- [ ] ROTEIRO_VIDEO.md com placeholders preenchidos
- [ ] Repositório Git criado e pushed para o GitHub
- [ ] Vídeo gravado (5-7 min)
- [ ] Email enviado para lina@ls4business.com.br

---

**Bom trabalho! Em caso de dúvida, consulte o `README.md` principal para decisões metodológicas e o `RESULTADOS_ESPERADOS.md` para os números esperados.**
