"""
validar_leitura.py
==================

Validação RÁPIDA (10s) da leitura do CSV `datatran2025.csv`.

Verifica:
  1. Arquivo existe no diretório atual.
  2. Parâmetros obrigatórios da leitura (sep, encoding, decimal).
  3. Shape esperado: 72.529 linhas x 30 colunas.
  4. Coluna-alvo `classificacao_acidente` está presente.
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

    print("\nDistribuicao do alvo:")
    print(df["classificacao_acidente"].value_counts(dropna=False))

    if alvo_ok:
        print("\nValidacao CONCLUIDA com sucesso.")
        return 0
    print("\nValidacao FALHOU.")
    return 2


if __name__ == "__main__":
    sys.exit(main())
