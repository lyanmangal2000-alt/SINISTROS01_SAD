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
        '<b>Como usar este roteiro.</b> A coluna "FALAR" tem o texto literal que deve ser narrado, '
        'exatamente como está escrito — pausas e ênfases já estão marcadas. A coluna "MOSTRAR" '
        'indica o que deve aparecer na tela em cada momento. Os números entre colchetes '
        '<b>[XX]%</b> devem ser preenchidos com os valores reais que aparecem no terminal após '
        'rodar <font face="DejaVu-Bold">python main.py</font> com o CSV real da PRF.',
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

    s.append(Paragraph('Cronograma geral', style_h3))
    cron = [
        ['Bloco', 'Tempo', 'Conteúdo'],
        ['1', '0:00 – 0:30', 'Contexto e pergunta gerencial'],
        ['2', '0:30 – 1:30', 'Base de dados + vazamento'],
        ['3', '1:30 – 2:30', 'Engenharia de atributos'],
        ['4', '2:30 – 3:30', 'Algoritmo e hiperparâmetros'],
        ['5', '3:30 – 5:00', 'Resultados: baseline × modelo'],
        ['6', '5:00 – 6:30', 'Atributos importantes e campanhas'],
        ['7', '6:30 – 7:00', 'Encerramento'],
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

    # ─────────── Blocos 1-7 ───────────
    blocos = [
        # Bloco 1
        {
            'num': 1, 'titulo': 'Contexto e pergunta gerencial', 'tempo': '0:00 – 0:30',
            'color': BLOCO_COLORS[0],
            'mostrar': 'Tela cheia do dashboard aberto no Hero (KPIs visíveis no topo). Alternativa: slide inicial com o título do trabalho.',
            'fala': (
                'Sinistros em rodovias federais brasileiras geram milhares de vítimas todos os anos. '
                'Historicamente, as campanhas educativas de trânsito são definidas pela experiência prática dos gestores. '
                'Nosso trabalho substitui essa abordagem intuitiva por um modelo <b>orientado por dados, auditável e reproduzível</b>.<br/><br/>'
                'A pergunta gerencial que nos guia é: <b>quais características dos sinistros estão mais associadas à ocorrência de vítimas, '
                'e devem ser priorizadas como foco de campanhas educativas?</b> Para respondê-la, construímos uma Árvore de Decisão '
                'treinada com critério de entropia — equivalente ao ID3 clássico.'
            ),
            'dica': 'Fale devagar nesta abertura. A primeira frase define o tom do vídeo inteiro.',
        },
        # Bloco 2
        {
            'num': 2, 'titulo': 'Base de dados e vazamento', 'tempo': '0:30 – 1:30',
            'color': BLOCO_COLORS[1],
            'mostrar': 'No VS Code, abrir o arquivo <font face="DejaVu-Bold">main.py</font> e rolar até a constante <font face="DejaVu-Bold">LEAKAGE_COLS</font> (linha ~74). Destacar a linha do <font face="DejaVu-Bold">assert not set(LEAKAGE_COLS) &amp; set(X.columns)</font>.',
            'fala': (
                'A base veio da Polícia Rodoviária Federal, via dados.gov.br: <b>72.529 registros × 30 colunas</b>, '
                'cobrindo os 365 dias de 2025. A leitura exigiu três parâmetros específicos: separador ponto-e-vírgula, '
                'encoding latin1 e vírgula decimal — sem eles a acentuação corrompe.<br/><br/>'
                'Mas o ponto mais crítico de rigor metodológico está aqui. <b>As sete colunas</b> '
                '<font face="DejaVu-Bold">pessoas</font>, <font face="DejaVu-Bold">mortos</font>, <font face="DejaVu-Bold">feridos_leves</font>, '
                '<font face="DejaVu-Bold">feridos_graves</font>, <font face="DejaVu-Bold">ilesos</font>, <font face="DejaVu-Bold">ignorados</font> e '
                '<font face="DejaVu-Bold">feridos</font> <b>são a contagem pós-evento que originou o próprio rótulo</b>. '
                'Incluir qualquer uma delas produziria um modelo com aproximadamente 100% de acurácia artificial — '
                'apenas redescobrindo a regra que gerou o rótulo, sem revelar nenhum fator acionável para campanha.<br/><br/>'
                'Por isso, no código, há um <font face="DejaVu-Bold">assert</font> explícito que <b>bloqueia a presença</b> dessas colunas em X. '
                'Se outro profissional tentar adicioná-las no futuro, o pipeline quebra imediatamente, sinalizando o erro. '
                'Essa é uma proteção metodológica permanente.'
            ),
            'dica': 'Aponte o cursor do mouse para a linha do assert quando mencioná-la. Mantenha o cursor parado enquanto explica.',
        },
        # Bloco 3
        {
            'num': 3, 'titulo': 'Engenharia de atributos', 'tempo': '1:30 – 2:30',
            'color': BLOCO_COLORS[2],
            'mostrar': 'No VS Code, mostrar a função <font face="DejaVu-Bold">aplicar_engenharia</font> (linha ~180) e depois a função <font face="DejaVu-Bold">binarizar_tracado</font> (usa MultiLabelBinarizer).',
            'fala': (
                'Três transformações de engenharia foram necessárias antes do treinamento.<br/><br/>'
                '<b>Primeira:</b> a coluna <font face="DejaVu-Bold">tracado_via</font> tinha <b>605 valores compostos</b> — '
                'por exemplo, a string <font face="DejaVu-Bold">Reta;Declive</font> em uma única célula. '
                'Não é categórica simples, é <b>multirrótulo</b>. Usei o <font face="DejaVu-Bold">MultiLabelBinarizer</font> '
                'para decompô-la em colunas binárias, uma por palavra-chave: <font face="DejaVu-Bold">tracado__Reta</font>, '
                '<font face="DejaVu-Bold">tracado__Curva</font>, <font face="DejaVu-Bold">tracado__Aclive</font> e assim por diante.<br/><br/>'
                '<b>Segunda:</b> <font face="DejaVu-Bold">horario</font>, com 1.412 valores no formato HH:MM:SS, virou '
                '<font face="DejaVu-Bold">hora_int</font> (0 a 23) e <font face="DejaVu-Bold">periodo_dia</font> em quatro categorias: '
                'Madrugada, Manhã, Tarde e Noite. Isso reduz a cardinalidade sem perder a informação sazonal.<br/><br/>'
                '<b>Terceira:</b> <font face="DejaVu-Bold">data_inversa</font>, com 365 datas únicas, virou <font face="DejaVu-Bold">mes</font> '
                '(1 a 12) para análise sazonal sem explodir a dimensionalidade.<br/><br/>'
                'Por fim, <b>causas raras abaixo de 1%</b> — aquelas com menos de 725 ocorrências — foram agrupadas em '
                '<font face="DejaVu-Bold">Outros</font> antes do one-hot encoding. Isso evita que a árvore aprenda regras para '
                'categorias com 2 ou 3 amostras, o que geraria overfitting.'
            ),
            'dica': 'Use os dedos para contar as três transformações. Ajudou quem está assistindo a acompanhar.',
        },
        # Bloco 4
        {
            'num': 4, 'titulo': 'Algoritmo e hiperparâmetros', 'tempo': '2:30 – 3:30',
            'color': BLOCO_COLORS[3],
            'mostrar': 'Voltar ao dashboard e rolar até a seção "Busca de Hiperparâmetros". Destacar a linha <font face="DejaVu-Bold">max_depth=8, min_samples_leaf=30</font> em azul.',
            'fala': (
                'Usei o <font face="DejaVu-Bold">DecisionTreeClassifier</font> do scikit-learn com '
                '<font face="DejaVu-Bold">criterion="entropy"</font> — exatamente o critério de impureza baseado em '
                '<b>ganho de informação</b> pedido no enunciado, equivalente prático ao ID3 e C4.5 clássicos.<br/><br/>'
                'Para os hiperparâmetros, testei um <b>grid 3 por 3</b>: <font face="DejaVu-Bold">max_depth</font> em 6, 8 e 10, '
                'cruzado com <font face="DejaVu-Bold">min_samples_leaf</font> em 20, 30 e 50. A tabela completa está aqui no dashboard. '
                'A escolha padrão foi <font face="DejaVu-Bold">max_depth=8</font> e <font face="DejaVu-Bold">min_samples_leaf=30</font> — '
                'melhor equilíbrio entre uma árvore interpretável, que cabe numa página A3 e pode ser mostrada no vídeo, '
                'e uma generalização que evita overfitting, com gap entre treino e teste abaixo de 0,10.<br/><br/>'
                'E como as classes do alvo são extremamente desbalanceadas — 77,5% feridos, 15,4% sem vítimas e apenas 7,2% fatais — '
                'usei <font face="DejaVu-Bold">class_weight="balanced"</font>. Isso repondera as classes inversamente à sua frequência, '
                'forçando o modelo a se importar mais com a classe minoritária. E o <font face="DejaVu-Bold">random_state=42</font> '
                'garante reprodutibilidade total.'
            ),
            'dica': 'Ao citar "77,5% feridos, 15,4% sem vítimas, 7,2% fatais", segure cada número por 1 segundo. Ajuda a gravar.',
        },
        # Bloco 5
        {
            'num': 5, 'titulo': 'Resultados: baseline × modelo', 'tempo': '3:30 – 5:00',
            'color': BLOCO_COLORS[4],
            'mostrar': 'Dashboard → rolar até a Matriz de Confusão. Passar o mouse em algumas células para mostrar os tooltips. Depois rolar para o Classification Report.',
            'fala': (
                'Primeiro, o <b>baseline trivial</b>: um <font face="DejaVu-Bold">DummyClassifier</font> que sempre prevê a classe '
                'majoritária — "Com Vítimas Feridas" — atinge <b>77,5% de acurácia</b> sem aprender absolutamente nada. '
                'É o piso de comparação. Sem reportar este baseline, qualquer acurácia isolada é enganosa.<br/><br/>'
                'Meu modelo treinado chegou a <b>[XX]% de acurácia global</b> no conjunto de teste. À primeira vista, parece '
                '<b>menor</b> que o baseline. Mas esse aparente retrocesso é deliberado e ético: com '
                '<font face="DejaVu-Bold">class_weight="balanced"</font>, o modelo sacrifica a acurácia global para '
                '<b>subir o recall da classe minoritária — os fatais</b>.<br/><br/>'
                'Olhem a matriz de confusão. A última linha, classe "Com Vítimas Fatais", mostra que o modelo acerta '
                '<b>[YY]% dos casos fatais</b>, contra <b>0% do baseline</b>. Esse é o ganho real para políticas públicas: '
                'identificar sinistros fatais, mesmo errando mais nos sem vítimas.<br/><br/>'
                'O classification report confirma: precision de fatais [ZZ], recall [WW] e F1 [KK]. O macro-average cai porque '
                'as três classes são tratadas com o mesmo peso — e a majoritária perde um pouco — mas o macro recall sobe para '
                '[AA]%, mostrando que o modelo aprende a distinguir as três classes, não apenas a majoritária.'
            ),
            'dica': 'Este é o bloco mais importante. Fale mais devagar e enfatize bem a frase "contra 0% do baseline".',
        },
        # Bloco 6
        {
            'num': 6, 'titulo': 'Atributos importantes e campanhas', 'tempo': '5:00 – 6:30',
            'color': BLOCO_COLORS[5],
            'mostrar': 'Dashboard → seção "Top 20 Atributos". Passar o mouse em algumas barras para mostrar tooltips. Depois rolar para "Recomendações de Campanha".',
            'fala': (
                'Agora, o coração do trabalho: <b>quais atributos o modelo treinado considera mais importantes</b> — '
                'não pela frequência bruta, mas pelo <b>ganho de informação acumulado</b> em cada split da árvore.<br/><br/>'
                'No topo da lista aparecem, em ordem: <b>[atributo 1]</b>, com importância [valor]; '
                '<b>[atributo 2]</b>; <b>[atributo 3]</b>; e assim por diante. Cada cor representa a coluna original — '
                'laranja para causa do acidente, vermelho para número de veículos, roxo para período do dia, etc.<br/><br/>'
                'Para cada um dos 10 atributos mais importantes, gerei automaticamente um bloco de recomendação de campanha. '
                'Vejam, por exemplo, o primeiro: o atributo <font face="DejaVu-Bold">[nome real]</font> aparece em <b>[n]</b> casos, '
                'ou <b>[X]%</b> do total. Desses, <b>[Y]% são fatais</b> — um <b>lift de [Z] vezes</b> comparado à taxa global de 7,2%. '
                'Lift maior que 1 significa que o grupo está super-representado em fatais, e deve ser priorizado.<br/><br/>'
                'Para cada bloco, há quatro dimensões de campanha: <b>tipo</b> (por exemplo, prevenção de direção embriagada), '
                '<b>público-alvo</b> (condutores jovens 18-34 em saídas noturnas), <b>momento</b> (noite e madrugada, fins de semana) '
                'e <b>canal</b> (blitz educativas, rádio, redes sociais). Essa ligação direta entre atributo do modelo e ação concreta '
                'de campanha é o que torna o trabalho acionável para o órgão de trânsito.'
            ),
            'dica': 'Ao citar cada atributo do top 3, pare a fala por 1 segundo. Dá tempo de a câmera focar na barra.',
        },
        # Bloco 7
        {
            'num': 7, 'titulo': 'Encerramento', 'tempo': '6:30 – 7:00',
            'color': BLOCO_COLORS[6],
            'mostrar': 'Vista geral do dashboard rolando de cima a baixo. Voltar ao topo (Hero) e parar.',
            'fala': (
                'Em resumo: entregamos um <b>pipeline reproduzível</b>, com código versionado, anti-vazamento explícito, '
                'baseline de comparação, grid de hiperparâmetros, matriz de confusão interpretável e um '
                '<b>relatório automático de recomendações de campanha</b> com justificativa numérica.<br/><br/>'
                'O dashboard interativo, os três gráficos em PNG, o relatório em markdown e o código completo estão disponíveis '
                'no repositório do GitHub, com README documentando todas as decisões metodológicas.<br/><br/>'
                'A contribuição principal deste trabalho é mostrar que, mesmo com uma técnica clássica como árvore de decisão, '
                'é possível — com rigor metodológico adequado — transformar dados públicos de sinistros em '
                '<b>recomendações concretas e auditáveis</b> para campanhas educativas de trânsito. Obrigado.'
            ),
            'dica': 'Faça uma pausa de 2 segundos antes de "Obrigado". Encerramento limpo.',
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

    # ─────────── Página final: placeholders + checklist ───────────
    s.append(PageBreak())
    s.append(Paragraph('Placeholders a preencher antes de gravar', style_h2))
    s.append(Paragraph(
        'Após rodar <font face="DejaVu-Bold">python main.py</font> com o CSV real, abra '
        '<font face="DejaVu-Bold">outputs/resultados.json</font> (ou leia o terminal) e substitua:',
        style_body
    ))
    s.append(Spacer(1, 4))

    ph = [
        ['Placeholder', 'Significado', 'Onde encontrar'],
        ['[XX]%', 'Acurácia teste do modelo', 'KPI "Acurácia — Teste" no dashboard'],
        ['[YY]%', 'Recall da classe Fatais', 'Classification Report, linha "Com Vítimas Fatais", coluna recall'],
        ['[ZZ]', 'Precision Fatais', 'Classification Report'],
        ['[WW]', 'Recall Fatais (mesmo que YY)', 'Classification Report'],
        ['[KK]', 'F1 Fatais', 'Classification Report'],
        ['[AA]%', 'Macro avg recall', 'Classification Report, linha "Macro avg"'],
        ['[atributo 1], [2], [3]', 'Top 3 features', 'Seção "Top 20 Atributos" no dashboard'],
        ['[valor]', 'Importância do atributo 1', 'Top 20 Atributos (número ao lado da barra)'],
        ['[nome real], [n], [X]%, [Y]%, [Z]', 'Dados do 1º atributo do relatório', 'relatorio_campanhas.md (bloco 1)'],
    ]
    ph_t = Table(ph, colWidths=[45*mm, 55*mm, 70*mm])
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
        'CSV real da PRF baixado e <font face="DejaVu-Bold">python main.py</font> rodou com sucesso',
        'Placeholders do roteiro preenchidos com números reais',
        'Dashboard aberto no navegador com zoom 110%',
        'VS Code aberto no <font face="DejaVu-Bold">main.py</font> com zoom 125%',
        'Microfone testado (grave 30 seg de teste e ouça)',
        'Notificações desligadas (Slack, email, WhatsApp)',
        'Ambiente silencioso (sem ar condicionado barulhento, sem gente passando)',
        'Roteiro impresso ou em segundo monitor (não ler da mesma tela que grava)',
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
        'Roteiro completo e didático para gravação de vídeo de 5 a 7 minutos,',
        'descrevendo o processo de implementação do algoritmo e os',
        'resultados do dashboard.',
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
