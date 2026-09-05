"""
Gera o PDF do roteiro de vídeo AV1 — versão didática e detalhada.

Saída: /home/z/my-project/download/ROTEIRO_VIDEO_AV1.pdf
"""
import os
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether,
    Table, TableStyle, Image, HRFlowable, Flowable,
)
from reportlab.pdfgen import canvas

# ============================================================
# Fontes — usar DejaVu (Latin + acentos PT-BR)
# ============================================================
FONT_DIR_DEJAVU = "/usr/share/fonts/truetype/dejavu"
FONT_DIR_LIB = "/usr/share/fonts/truetype/liberation"

dejavu_sans = f"{FONT_DIR_DEJAVU}/DejaVuSans.ttf"
dejavu_sans_bold = f"{FONT_DIR_DEJAVU}/DejaVuSans-Bold.ttf"
# Sem itálico no DejaVu Sans — usar o próprio bold/normal como fallback
dejavu_italic = f"{FONT_DIR_DEJAVU}/DejaVuSans.ttf"
dejavu_bold_italic = f"{FONT_DIR_DEJAVU}/DejaVuSans-Bold.ttf"

# Registrar fontes
pdfmetrics.registerFont(TTFont('DejaVu', dejavu_sans))
pdfmetrics.registerFont(TTFont('DejaVu-Bold', dejavu_sans_bold))
pdfmetrics.registerFont(TTFont('DejaVu-Italic', dejavu_italic))
pdfmetrics.registerFont(TTFont('DejaVu-BoldItalic', dejavu_bold_italic))

# Mapeamento de famílias (permite <b>, <i> dentro de Paragraph)
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily('DejaVu',
    normal='DejaVu',
    bold='DejaVu-Bold',
    italic='DejaVu-Italic',
    boldItalic='DejaVu-BoldItalic',
)

# ============================================================
# Paleta — derivada do palette.cascade
# ============================================================
PAGE_BG       = colors.HexColor('#FFFFFF')
TEXT_PRIMARY  = colors.HexColor('#181715')
TEXT_MUTED    = colors.HexColor('#6b6862')
ACCENT        = colors.HexColor('#94771d')   # dourado
ACCENT_2      = colors.HexColor('#0f1c2e')   # azul escuro
ACCENT_3      = colors.HexColor('#9b544d')   # vermelho terroso
SEM_SUCCESS   = colors.HexColor('#45845a')
SEM_WARNING   = colors.HexColor('#a38549')
SEM_INFO      = colors.HexColor('#4a6b8b')
CARD_BG       = colors.HexColor('#f7f5f0')
TABLE_STRIPE  = colors.HexColor('#faf8f3')
BORDER        = colors.HexColor('#d9d4c6')

# Cores por bloco (para a barra lateral de cada bloco)
BLOCO_COLORS = [
    colors.HexColor('#4a6b8b'),  # Bloco 1 - azul
    colors.HexColor('#94771d'),  # Bloco 2 - dourado
    colors.HexColor('#45845a'),  # Bloco 3 - verde
    colors.HexColor('#7b64be'),  # Bloco 4 - roxo
    colors.HexColor('#a38549'),  # Bloco 5 - amarelo
    colors.HexColor('#9b544d'),  # Bloco 6 - vermelho
    colors.HexColor('#605840'),  # Bloco 7 - marrom
]

# ============================================================
# Estilos
# ============================================================
ss = getSampleStyleSheet()

style_h1 = ParagraphStyle(
    'H1', parent=ss['Heading1'],
    fontName='DejaVu-Bold', fontSize=20, leading=26,
    textColor=ACCENT_2, spaceBefore=0, spaceAfter=14,
    alignment=TA_LEFT,
)
style_h2 = ParagraphStyle(
    'H2', parent=ss['Heading2'],
    fontName='DejaVu-Bold', fontSize=15, leading=20,
    textColor=ACCENT_2, spaceBefore=16, spaceAfter=8,
)
style_h3 = ParagraphStyle(
    'H3', parent=ss['Heading3'],
    fontName='DejaVu-Bold', fontSize=12, leading=16,
    textColor=ACCENT, spaceBefore=10, spaceAfter=4,
)
style_body = ParagraphStyle(
    'Body', parent=ss['Normal'],
    fontName='DejaVu', fontSize=10.5, leading=15.5,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=4,
    alignment=TA_JUSTIFY,
)
style_body_left = ParagraphStyle(
    'BodyLeft', parent=style_body,
    alignment=TA_LEFT,
)
style_muted = ParagraphStyle(
    'Muted', parent=style_body,
    fontSize=9.5, textColor=TEXT_MUTED, leading=13,
)
style_fala = ParagraphStyle(
    'Fala', parent=style_body,
    fontName='DejaVu', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY,
    leftIndent=14, rightIndent=8,
    spaceBefore=3, spaceAfter=6,
    borderColor=ACCENT, borderWidth=0, borderPadding=0,
)
style_mostrar = ParagraphStyle(
    'Mostrar', parent=style_body,
    fontName='DejaVu', fontSize=9.5, leading=13.5,
    textColor=TEXT_MUTED, leftIndent=10,
    spaceBefore=2, spaceAfter=4,
)
style_kpi = ParagraphStyle(
    'Kpi', parent=style_body,
    fontName='DejaVu-Bold', fontSize=11, leading=14,
    textColor=ACCENT, alignment=TA_CENTER,
)
style_kpi_label = ParagraphStyle(
    'KpiLabel', parent=style_body,
    fontName='DejaVu', fontSize=8.5, leading=11,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
)
style_tempo = ParagraphStyle(
    'Tempo', parent=style_body,
    fontName='DejaVu-Bold', fontSize=10, leading=13,
    textColor=ACCENT, alignment=TA_CENTER,
)

# ============================================================
# Helpers
# ============================================================
class BlocoHeader(Flowable):
    """Faixa colorida com número do bloco + título + tempo."""
    def __init__(self, num, titulo, tempo, color, width=170*mm, height=14*mm):
        Flowable.__init__(self)
        self.num = num
        self.titulo = titulo
        self.tempo = tempo
        self.color = color
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        # Fundo claro
        c.setFillColor(CARD_BG)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        # Barra colorida lateral
        c.setFillColor(self.color)
        c.rect(0, 0, 8*mm, self.height, fill=1, stroke=0)
        # Número do bloco (círculo)
        c.setFillColor(self.color)
        c.circle(18*mm, self.height/2, 5*mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont('DejaVu-Bold', 12)
        c.drawCentredString(18*mm, self.height/2 - 4, str(self.num))
        # Título
        c.setFillColor(ACCENT_2)
        c.setFont('DejaVu-Bold', 12)
        c.drawString(28*mm, self.height/2 + 1, self.titulo)
        # Tempo (direita)
        c.setFillColor(TEXT_MUTED)
        c.setFont('DejaVu', 9)
        c.drawRightString(self.width - 4*mm, self.height/2 - 3, self.tempo)


def kpi_table(items):
    """Tabela de KPIs: items = [(valor, label), ...]"""
    data = [[Paragraph(v, style_kpi) for v, _ in items],
            [Paragraph(l, style_kpi_label) for _, l in items]]
    n = len(items)
    col_w = 170*mm / n
    t = Table(data, colWidths=[col_w]*n, rowHeights=[10*mm, 8*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def info_box(texto, bg=CARD_BG, border=BORDER, icon_color=ACCENT):
    """Caixa de destaque para dicas/avisos."""
    p = Paragraph(texto, ParagraphStyle(
        'Box', parent=style_body, fontSize=10, leading=14,
        textColor=TEXT_PRIMARY, leftIndent=4, rightIndent=4,
    ))
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBEFORE', (0, 0), (0, -1), 3, icon_color),
    ]))
    return t


def fala_block(texto):
    """Bloco de fala com aspas tipográficas."""
    p = Paragraph(f'<font color="#94771d" face="DejaVu-Bold">"</font>{texto}<font color="#94771d" face="DejaVu-Bold">"</font>', style_fala)
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#faf8f3')),
        ('LINEBEFORE', (0, 0), (0, -1), 2.5, ACCENT),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def mostrar_block(texto):
    """Bloco 'o que mostrar na tela'."""
    icon = Paragraph(
        f'<font color="#6b6862" face="DejaVu-Bold" size="9">MOSTRAR NA TELA:</font><br/>{texto}',
        style_mostrar
    )
    t = Table([[icon]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0eee8')),
        ('LINEBEFORE', (0, 0), (0, -1), 2, TEXT_MUTED),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def divider():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=8, spaceAfter=8)


# ============================================================
# Corpo do documento
# ============================================================
def build_story():
    s = []

    # ─────────── Página 1: introdução ───────────
    s.append(Paragraph('Roteiro do Vídeo — AV1', style_h1))
    s.append(Paragraph(
        'Árvore de Decisão para Campanhas Educativas no Trânsito',
        ParagraphStyle('Sub', parent=style_h2, fontSize=13, textColor=ACCENT, spaceAfter=10)
    ))

    s.append(info_box(
        '<b>Como usar este roteiro.</b> Este roteiro está <b>alinhado à tela do dashboard</b> — cada bloco descreve '
        'exatamente o que deve aparecer na tela e o que deve ser falado. Os números já estão preenchidos com os valores '
        'reais do dashboard (acurácia 41%, recall fatais 75.2%, lift 751.8×, precision 21.2%, recall sem vítimas 56.1%, '
        'gap +0.010). Basta seguir a ordem dos blocos, do topo ao rodapé do dashboard.',
        bg=colors.HexColor('#fff8e6'), border=colors.HexColor('#d4a056'), icon_color=colors.HexColor('#d4a056')
    ))
    s.append(Spacer(1, 6))

    # KPIs do roteiro
    s.append(kpi_table([
        ('6 min', 'Duração alvo'),
        ('7', 'Blocos'),
        ('5–7 min', 'Faixa aceita'),
        ('1080p', 'Resolução'),
    ]))
    s.append(Spacer(1, 10))

    s.append(Paragraph('Cronograma geral — do topo ao rodapé do dashboard', style_h3))
    cron = [
        ['Bloco', 'Tempo', 'Conteúdo'],
        ['1', '0:00 – 0:30', 'Abertura — Hero do dashboard'],
        ['2', '0:30 – 1:30', 'Painel de contexto + 6 KPIs'],
        ['3', '1:30 – 2:30', 'Anti-vazamento de dados'],
        ['4', '2:30 – 3:30', 'Matriz de confusão + classification report'],
        ['5', '3:30 – 4:30', 'Top 20 atributos + árvore de decisão'],
        ['6', '4:30 – 6:00', 'Recomendações de campanha'],
        ['7', '6:00 – 7:00', 'Distribuições + hiperparâmetros + encerramento'],
    ]
    cron_t = Table(cron, colWidths=[15*mm, 30*mm, 125*mm])
    cron_t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_2),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVu-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVu'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
    ]))
    s.append(cron_t)
    s.append(PageBreak())

    # ─────────── Blocos 1-7 — alinhados EXATAMENTE à tela do dashboard ───────────
    blocos = [
        # Bloco 1 — Abertura (Hero visível)
        {
            'num': 1, 'titulo': 'Abertura — contexto e pergunta', 'tempo': '0:00 – 0:30',
            'color': BLOCO_COLORS[0],
            'mostrar': (
                'Tela do navegador aberta em <font face="DejaVu-Bold">http://localhost:3000/#hero</font>, no VS Code. '
                'Mostrar o topo do dashboard: ícone vermelho + título <b>"Campanhas Educativas no Trânsito · Dashboard"</b> + '
                'subtítulo <b>"Árvore de Decisão (entropy) · 72.528 sinistros PRF"</b>. '
                'Menu de navegação com 5 abas: Visão geral, Matriz, Atributos, Campanhas, Método.'
            ),
            'fala': (
                'Olá. Este é o dashboard do nosso trabalho de Árvore de Decisão para apoiar campanhas educativas no trânsito. '
                'A base é da Polícia Rodoviária Federal — <b>72.528 sinistros</b> analisados com critério de entropia, '
                'o mesmo ganho de informação do ID3 clássico.<br/><br/>'
                'A pergunta gerencial que guiou todo o projeto é: <b>quais características dos sinistros estão mais '
                'associadas à ocorrência de vítimas fatais, e devem ser priorizadas em campanhas preventivas?</b> '
                'Vou percorrer o dashboard do topo até o rodapé, explicando cada decisão.'
            ),
            'dica': 'Fale devagar. A primeira frase define o tom. Mostre o navegador inteiro, não só o dashboard.',
        },

        # Bloco 2 — Hero: painel de contexto + KPIs
        {
            'num': 2, 'titulo': 'Painel de contexto e KPIs', 'tempo': '0:30 – 1:30',
            'color': BLOCO_COLORS[1],
            'mostrar': (
                'Rolar devagar para baixo, mostrando na ordem:<br/>'
                '1. O rótulo <b>"PAINEL DE APOIO À DECISÃO · AV1"</b><br/>'
                '2. O título <b>"Campanhas Educativas no Trânsito"</b><br/>'
                '3. As 3 tags coloridas de classes: <b>Vermelha "Com Vítimas Fatais"</b>, <b>Amarela "Com Vítimas Feridas"</b>, <b>Verde "Sem Vítimas"</b><br/>'
                '4. A primeira linha de 3 KPIs: <b>Acurácia — Teste: 41.0%</b> (Baseline 77.5%, delta -0.365 em vermelho) · '
                '<b>Recall — Fatais: 75.2%</b> (Baseline 0.0%, lift +0.752 em verde) · <b>Lift Fatais: 751.8×</b><br/>'
                '5. A segunda linha: <b>Precisão — Fatais: 21.2%</b> · <b>Recall — Sem Vítimas: 56.1%</b> · <b>Gap Overfitting: +0.010</b>'
            ),
            'fala': (
                'Aqui no topo vem o painel de contexto. As três tags coloridas representam as classes do nosso alvo: '
                '<b>vermelho para fatais</b>, <b>amarelo para feridos</b> e <b>verde para sem vítimas</b>. '
                'A distribuição é desbalanceada — 77,5% feridos, 15,4% sem vítimas e só 7,2% fatais.<br/><br/>'
                'Agora os KPIs. Vejam o primeiro card: <b>acurácia de teste de 41%</b>, contra baseline de 77,5%. '
                'Parece pior, mas é proposital. O segundo card mostra o porquê: <b>recall de fatais saltou para 75,2%</b>, '
                'contra <b>zero do baseline</b>. Em políticas públicas, encontrar os sinistros fatais vale mais do que '
                'acertar o total.<br/><br/>'
                'O terceiro card mostra o lift: <b>751 vezes</b> mais recall de fatais que o baseline. Os outros três KPIs '
                'completam o diagnóstico: precisão de fatais 21,2%, recall de sem vítimas 56,1% e gap de overfitting '
                'de apenas 0,010 — sinal de que o modelo generaliza bem.'
            ),
            'dica': 'Aponte o mouse para cada card conforme fala dele. Pare 1 segundo em cada número.',
        },

        # Bloco 3 — Anti-vazamento
        {
            'num': 3, 'titulo': 'Anti-vazamento de dados', 'tempo': '1:30 – 2:30',
            'color': BLOCO_COLORS[2],
            'mostrar': (
                'Continuar rolar para baixo até a seção <b>"Anti-vazamento de dados"</b> (card com ícone de escudo amarelo). '
                'Mostrar as 7 colunas listadas como tags: <font face="DejaVu-Bold">pessoas</font>, <font face="DejaVu-Bold">mortos</font>, '
                '<font face="DejaVu-Bold">feridos_leves</font>, <font face="DejaVu-Bold">feridos_graves</font>, '
                '<font face="DejaVu-Bold">ilesos</font>, <font face="DejaVu-Bold">ignorados</font>, <font face="DejaVu-Bold">feridos</font>. '
                'Mostrar também o trecho do código com o <font face="DejaVu-Bold">assert not set(LEAKAGE_COLS) &amp; set(X.columns)</font>.'
            ),
            'fala': (
                'Esta é a parte mais crítica de rigor metodológico. As <b>sete colunas destacadas aqui</b> — pessoas, mortos, '
                'feridos_leves, feridos_graves, ilesos, ignorados e feridos — <b>são a contagem pós-evento que originou o '
                'próprio rótulo</b>. Se eu as incluísse como preditores, o modelo atingiria quase 100% de acurácia artificial, '
                'apenas redescobrindo a regra que gerou o rótulo.<br/><br/>'
                'Por isso, no código, há um <font face="DejaVu-Bold">assert</font> explícito que <b>bloqueia a presença</b> '
                'dessas colunas em X. Se outro profissional tentar adicioná-las no futuro, o pipeline quebra imediatamente. '
                'Essa é uma proteção metodológica permanente — nada de fator acionável para campanha pode vir dessas colunas.'
            ),
            'dica': 'Aponte para cada uma das 7 tags enquanto fala "pessoas, mortos, feridos_leves..." — fica visualmente claro.',
        },

        # Bloco 4 — Matriz de confusão + Classification Report
        {
            'num': 4, 'titulo': 'Matriz de confusão e métricas', 'tempo': '2:30 – 3:30',
            'color': BLOCO_COLORS[3],
            'mostrar': (
                'Rolar até a seção <b>"Matriz de Confusão (normalizada por classe real)"</b>. '
                'Passar o mouse na célula <b>última linha, primeira coluna</b> (Fatais reais × Fatais preditos) — tooltip mostra <b>75.2%</b>. '
                'Depois rolar para a tabela <b>"Classification Report (teste)"</b> mostrando precision/recall/F1/suporte por classe.'
            ),
            'fala': (
                'Esta é a matriz de confusão. Cada linha é uma classe real, cada coluna é uma classe predita. '
                'A diagonal principal mostra os acertos. Olhem a <b>última linha, classe "Com Vítimas Fatais"</b>: '
                'o modelo acerta <b>75,2%</b> dos casos fatais — isso contra <b>zero do baseline</b>. '
                'Sim, ele erra mais nos sem vítimas, mas em políticas públicas preferimos o falso positivo ao falso negativo.<br/><br/>'
                'A tabela ao lado confirma as métricas: para a classe fatais, <b>precision de 21,2%</b>, <b>recall de 75,2%</b> '
                'e <b>F1 de 0,330</b>. O macro-average cai porque as três classes são tratadas com o mesmo peso, mas o macro '
                'recall sobe — sinal de que o modelo aprende a distinguir as três classes, não apenas a majoritária.'
            ),
            'dica': 'Use o cursor para traçar a diagonal da matriz. Pausa de 1 segundo ao citar "75,2%".',
        },

        # Bloco 5 — Top 20 atributos + Árvore
        {
            'num': 5, 'titulo': 'Atributos mais importantes', 'tempo': '3:30 – 4:30',
            'color': BLOCO_COLORS[4],
            'mostrar': (
                'Rolar até a seção <b>"Top 20 Atributos — feature_importances_"</b>. '
                'Passar o mouse sobre as 3 primeiras barras (no topo) para mostrar os tooltips com nome e importância. '
                'Cores: <b>vermelho</b>=veículos, <b>laranja</b>=causa_acidente, <b>amarelo</b>=tipo_acidente, '
                '<b>verde</b>=tipo_pista, <b>ciano</b>=tracado_via, <b>azul</b>=fase_dia, <b>roxo</b>=periodo_dia, '
                '<b>rosa</b>=condicao_metereologica. '
                'Depois rolar para a <b>preview da Árvore de Decisão</b> (primeiros 3 níveis).'
            ),
            'fala': (
                'Aqui está o coração do trabalho: <b>os 20 atributos que mais contribuem para reduzir a entropia do alvo</b>, '
                'medidos pelo ganho de informação acumulado em cada split da árvore — não pela frequência bruta.<br/><br/>'
                'No topo aparecem os principais, com suas importâncias numéricas ao lado. As cores indicam a coluna original: '
                'vermelho para veículos, laranja para causa do acidente, roxo para período do dia, e assim por diante. '
                'Logo abaixo temos a <b>preview da árvore de decisão</b> — primeiros 3 níveis. As cores mais saturadas '
                'indicam nós mais puros, e o caminho da raiz até qualquer folha é uma regra interpretável por humanos.'
            ),
            'dica': 'Aponte para a primeira barra e segure 1 segundo antes de falar "veículos". Clique em "Ampliar" para abrir o modal da árvore full.',
        },

        # Bloco 6 — Recomendações de Campanha
        {
            'num': 6, 'titulo': 'Recomendações de campanha', 'tempo': '4:30 – 6:00',
            'color': BLOCO_COLORS[5],
            'mostrar': (
                'Rolar até a seção <b>"Recomendações de Campanha — Top 10 Atributos"</b>. '
                'Mostrar os cards (2 colunas). Em cada card destacar: <b>nº do rank</b>, <b>nome do atributo</b>, '
                '<b>badge de lift colorido</b> (vermelho para lift maior que 2×, laranja para maior que 1,5×), '
                '<b>3 mini-stats</b> (Casos, % Fatais, Importância), e as 4 dimensões: <b>Tipo, Público, Momento, Canal</b>.'
            ),
            'fala': (
                'Para cada um dos 10 atributos mais importantes, gerei automaticamente um card de recomendação de campanha. '
                'Vejam o primeiro: o atributo <b>veículos alto</b> aparece em cerca de 36% dos sinistros, e <b>13,5% desses '
                'casos são fatais</b> — um <b>lift de 1,87 vezes</b> acima da taxa global de 7,2%. '
                'Isso significa: sinistros com mais veículos envolvidos têm quase o dobro de chance de serem fatais.<br/><br/>'
                'Cada card traz quatro dimensões acionáveis: <b>tipo de campanha</b> (por exemplo, prevenção de direção '
                'embriagada), <b>público-alvo</b> (condutores jovens 18-34 em saídas noturnas), <b>momento</b> '
                '(noite e madrugada, fins de semana) e <b>canal</b> (blitz educativas, rádio, redes sociais). '
                'Essa ligação direta entre atributo do modelo e ação concreta é o que torna o trabalho acionável '
                'para o órgão de trânsito — cada recomendação tem número que a sustenta.'
            ),
            'dica': 'Ao citar lift 1,87×, mostre o badge vermelho no canto superior direito do card. Pausa de 1 segundo.',
        },

        # Bloco 7 — Distribuições + encerramento
        {
            'num': 7, 'titulo': 'Distribuições e encerramento', 'tempo': '6:00 – 7:00',
            'color': BLOCO_COLORS[6],
            'mostrar': (
                'Rolar até a seção <b>"Distribuições da Base de Sinistros"</b>. Clicar em algumas tabs: '
                '<b>"Alvo"</b> (pie chart 3 classes), <b>"UF (Top 15)"</b> (bar horizontal), <b>"Mês"</b> (line chart sazonal), '
                '<b>"Causa (Top 15)"</b>. Depois rolar até o rodapé, mostrar o <b>"Busca de Hiperparâmetros — Grid 3×3"</b> '
                'e voltar ao topo (Hero) para encerrar.'
            ),
            'fala': (
                'Por fim, as distribuições da base. Aqui vemos a <b>distribuição do alvo</b> em pizza — fica visível o '
                'desbalanceamento de 77,5/15,4/7,2%. Na tab <b>UF</b>, os estados com mais sinistros. Na tab <b>Mês</b>, '
                'a sazonalidade — picos em férias e feriados. E na tab <b>Causa</b>, as 15 causas mais frequentes.<br/><br/>'
                'Abaixo, a <b>tabela do grid 3×3 de hiperparâmetros</b> testados: max_depth em 6, 8 e 10, cruzado com '
                'min_samples_leaf em 20, 30 e 50. A escolha padrão, em azul, é <b>max_depth=8 e min_samples_leaf=30</b> — '
                'melhor equilíbrio entre interpretabilidade e generalização.<br/><br/>'
                'Em resumo: entregamos um <b>pipeline reproduzível</b>, com código versionado, anti-vazamento explícito, '
                'baseline de comparação, grid de hiperparâmetros, matriz de confusão interpretável e um '
                '<b>relatório automático de recomendações de campanha</b>. Tudo está no repositório do GitHub. '
                'Obrigado.'
            ),
            'dica': 'Clique em cada tab rapidamente (1 seg cada) só para mostrar que existe. Não precisa explicar todas.',
        },
    ]

    for b in blocos:
        # Header do bloco
        s.append(BlocoHeader(b['num'], b['titulo'], b['tempo'], b['color']))
        s.append(Spacer(1, 4))
        # O que mostrar
        s.append(mostrar_block(b['mostrar']))
        s.append(Spacer(1, 4))
        # Fala
        s.append(fala_block(b['fala']))
        s.append(Spacer(1, 4))
        # Dica prática
        s.append(info_box(
            f'<b>Dica do roteiro:</b> {b["dica"]}',
            bg=colors.HexColor('#eef5ee'), border=colors.HexColor('#45845a'), icon_color=SEM_SUCCESS
        ))
        s.append(Spacer(1, 14))

    # ─────────── Página final: KPIs reais do dashboard + checklist ───────────
    s.append(PageBreak())
    s.append(Paragraph('KPIs do dashboard — valores reais', style_h2))
    s.append(Paragraph(
        'Estes são os números exibidos no dashboard do vídeo. Use esta tabela como referência rápida '
        'durante a gravação — cada KPI aparece na seção "Hero" do dashboard, na ordem abaixo.',
        style_body
    ))
    s.append(Spacer(1, 4))

    ph = [
        ['KPI', 'Valor', 'Baseline', 'Interpretação'],
        ['Acurácia — Teste', '41.0%', '77.5%', 'Aparente retrocesso é proposital (class_weight=balanced)'],
        ['Recall — Fatais', '75.2%', '0.0%', 'GANHO REAL: identifica 75% dos sinistros fatais'],
        ['Lift Fatais (×)', '751.8×', '—', 'Recall de fatais é 751× maior que o baseline trivial'],
        ['Precisão — Fatais', '21.2%', '—', 'De cada 5 alertas de fatal, 1 é verdadeiro'],
        ['F1 — Fatais', '0.330', '—', 'Equilíbrio precision/recall para a classe minoritária'],
        ['Recall — Sem Vítimas', '56.1%', '—', 'Acerta pouco mais da metade dos sem vítimas'],
        ['Recall — Feridos', '34.8%', '—', 'A classe majoritária é sacrificada de propósito'],
        ['Gap Overfitting', '+0.010', '—', 'Modelo generaliza bem (gap < 0.10 é saudável)'],
        ['Taxa global de fatais', '7.18%', '—', 'Taxa base: 7,18% dos sinistros são fatais'],
    ]
    ph_t = Table(ph, colWidths=[40*mm, 22*mm, 22*mm, 86*mm])
    ph_t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_2),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVu-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVu'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    s.append(ph_t)

    s.append(Spacer(1, 16))
    s.append(Paragraph('Checklist final de gravação', style_h2))

    s.append(Paragraph('<b>Antes de gravar</b>', style_h3))
    for item in [
        'Dashboard aberto no navegador em <font face="DejaVu-Bold">http://localhost:3000/#hero</font> com zoom 110%',
        'VS Code minimizado (não precisa aparecer no vídeo, só o dashboard)',
        'Microfone testado (grave 30 seg de teste e ouça)',
        'Notificações desligadas (Slack, email, WhatsApp)',
        'Ambiente silencioso (sem ar condicionado barulhento, sem gente passando)',
        'Roteiro impresso ou em segundo monitor (não ler da mesma tela que grava)',
        'Mouse com cursor grande (facilita ver onde está apontando)',
    ]:
        s.append(Paragraph(f'<font color="#45845a">□</font>  {item}', style_body_left))

    s.append(Spacer(1, 8))
    s.append(Paragraph('<b>Depois de gravar</b>', style_h3))
    for item in [
        'Edição feita (corte respirações longas, "ééé...", "hum...")',
        'Legendas geradas (acessibilidade +)',
        'Exportação em 1080p MP4, 30fps, bitrate 5–8 Mbps (arquivo final ~150–300 MB)',
        'Upload concluído e link testado em janela anônima',
        'Link incluído no email final para <font face="DejaVu-Bold">lina@ls4business.com.br</font>',
    ]:
        s.append(Paragraph(f'<font color="#45845a">□</font>  {item}', style_body_left))

    s.append(Spacer(1, 14))
    s.append(info_box(
        '<b>Hospedagem recomendada:</b> YouTube não listado (faça upload, marque como "Não listado", copie o link). '
        'Alternativa: Google Drive (compartilhe com "qualquer pessoa com o link"). '
        'Não envie o arquivo MP4 por email — é muito grande.',
        bg=colors.HexColor('#eef2f7'), border=SEM_INFO, icon_color=SEM_INFO
    ))

    return s


# ============================================================
# Header/Footer em cada página
# ============================================================
def add_page_chrome(canv, doc):
    canv.saveState()
    w, h = A4
    # Header
    canv.setFont('DejaVu', 8)
    canv.setFillColor(TEXT_MUTED)
    canv.drawString(20*mm, h - 12*mm, 'Roteiro do Vídeo · AV1 · Árvore de Decisão')
    canv.drawRightString(w - 20*mm, h - 12*mm, 'Campanhas Educativas no Trânsito')
    # Linha do header
    canv.setStrokeColor(BORDER)
    canv.setLineWidth(0.4)
    canv.line(20*mm, h - 14*mm, w - 20*mm, h - 14*mm)
    # Footer
    canv.setFillColor(TEXT_MUTED)
    canv.setFont('DejaVu', 8)
    canv.drawString(20*mm, 12*mm, 'Roteiro V1.0 · 2025')
    canv.drawRightString(w - 20*mm, 12*mm, f'Página {canv.getPageNumber()}')
    canv.line(20*mm, 14*mm, w - 20*mm, 14*mm)
    canv.restoreState()


# ============================================================
# Main
# ============================================================
def main():
    out_body = '/home/z/my-project/scripts/roteiro_body.pdf'

    doc = SimpleDocTemplate(
        out_body,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=22*mm,
        bottomMargin=20*mm,
        title='Roteiro do Vídeo — AV1 Árvore de Decisão',
        author='Z.ai',
        subject='Roteiro completo de vídeo para gravação da AV1',
        creator='Z.ai PDF Skill (Report)',
    )
    story = build_story()
    doc.build(story, onFirstPage=add_page_chrome, onLaterPages=add_page_chrome)
    print(f'[OK] Corpo do PDF gerado: {out_body}')

    # Cover gerada via ReportLab (mesmo pagesize do corpo, evita mismatch)
    from reportlab.pdfgen import canvas as rl_canvas

    cover_pdf = '/home/z/my-project/scripts/roteiro_cover.pdf'
    c = rl_canvas.Canvas(cover_pdf, pagesize=A4)
    W, H = A4  # 595.276 × 841.890
    # Fundo
    c.setFillColor(colors.HexColor('#0f1c2e'))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Grade sutil (grid)
    c.setStrokeColor(colors.Color(1, 1, 1, alpha=0.04))
    c.setLineWidth(0.4)
    for x in range(0, int(W), 50):
        c.line(x, 0, x, H)
    for y in range(0, int(H), 50):
        c.line(0, y, W, y)
    # Linhas top e bottom
    c.setStrokeColor(colors.HexColor('#d4a056'))
    c.setLineWidth(1.5)
    margin_x = 80
    c.line(margin_x, H - 80, W - margin_x, H - 80)  # topo
    c.line(margin_x, 80, W - margin_x, 80)  # base
    # Label "AV1 · Roteiro de Vídeo"
    c.setFillColor(colors.HexColor('#d4a056'))
    c.setFont('DejaVu-Bold', 9)
    c.drawCentredString(W/2, H/2 + 130, 'A V 1   ·   R O T E I R O   D E   V Í D E O')
    # Título principal
    c.setFillColor(colors.white)
    c.setFont('DejaVu-Bold', 26)
    c.drawCentredString(W/2, H/2 + 70, 'Árvore de Decisão para')
    c.drawCentredString(W/2, H/2 + 40, 'Campanhas Educativas no Trânsito')
    # Subtítulo
    c.setFillColor(colors.HexColor('#a8b5c8'))
    c.setFont('DejaVu', 11)
    subtitle_lines = [
        'Roteiro alinhado à tela do dashboard — cada bloco descreve',
        'o que mostrar e o que falar, com números reais já preenchidos',
        '(acurácia 41%, recall fatais 75.2%, lift 751.8×).',
    ]
    for i, line in enumerate(subtitle_lines):
        c.drawCentredString(W/2, H/2 - 10 - i*16, line)
    # Blocos meta
    c.setFillColor(colors.HexColor('#d4a056'))
    c.setFont('DejaVu-Bold', 8)
    c.drawCentredString(W/2, H/2 - 100, 'B A S E')
    c.setFillColor(colors.white)
    c.setFont('DejaVu', 12)
    c.drawCentredString(W/2, H/2 - 118, '72.529 sinistros PRF · 2025')
    c.setFillColor(colors.HexColor('#d4a056'))
    c.setFont('DejaVu-Bold', 8)
    c.drawCentredString(W/2, H/2 - 145, 'A L G O R I T M O')
    c.setFillColor(colors.white)
    c.setFont('DejaVu', 12)
    c.drawCentredString(W/2, H/2 - 163, 'DecisionTree · criterion=entropy')
    # Footer
    c.setFillColor(colors.HexColor('#a8b5c8'))
    c.setFont('DejaVu', 8)
    c.drawString(margin_x, 50, 'ROTEIRO V1.0')
    c.drawRightString(W - margin_x, 50, 'ENTREGA AV1 · 2025')
    c.save()
    print(f'[OK] Cover gerada via ReportLab: {cover_pdf}')

    # Merge cover + body
    import pypdf
    out_final = '/home/z/my-project/download/ROTEIRO_VIDEO_AV1.pdf'

    merger = pypdf.PdfWriter()
    merger.append(cover_pdf)
    merger.append(out_body)

    # Metadados
    merger.add_metadata({
        '/Title': 'Roteiro do Vídeo — AV1 Árvore de Decisão',
        '/Author': 'Z.ai',
        '/Subject': 'Roteiro completo de vídeo para gravação da AV1',
        '/Creator': 'Z.ai PDF Skill (Report)',
    })

    with open(out_final, 'wb') as f:
        merger.write(f)

    size_kb = os.path.getsize(out_final) / 1024
    print(f'[OK] PDF final: {out_final} ({size_kb:.1f} KB)')


if __name__ == '__main__':
    main()
