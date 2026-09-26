"""
gerar_dados_sinteticos.py
=========================

Gera um dataset SINTE'TICO com schema IDÊNTICO ao `datatran2025.csv` real,
para testar o pipeline quando o arquivo real nao esta disponivel.

Importante:
  - O dataset sintetico NAO substitui o CSV real da PRF.
  - As distribuicoes sao aproximações didaticas para validar o codigo.
  - Para resultados reais, baixe o arquivo em:
        https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf
    e salve como `datatran2025.csv` na raiz do projeto.

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
