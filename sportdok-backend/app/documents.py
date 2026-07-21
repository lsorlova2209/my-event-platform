import os
from datetime import date
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.draw import next_power_of_two, round1_pairs_by_seed

# Base14 PDF fonts (Helvetica etc.) have no Cyrillic glyphs. DejaVu Sans is
# bundled under app/fonts/ (freely licensed, same font matplotlib ships) so
# PDF export works regardless of what fonts happen to be installed on the
# deployment host.
_FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
pdfmetrics.registerFont(TTFont("DejaVuSans", os.path.join(_FONT_DIR, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", os.path.join(_FONT_DIR, "DejaVuSans-Bold.ttf")))

# Командный зачёт points scale - the ТЗ names "Командный зачёт" as a
# required document but doesn't specify a scoring formula (see Приложение
# А, п.7: "прописать в собственном положении о турнире"). Provisional
# scale pending the tournament's official регламент.
TEAM_POINTS = {1: 4, 2: 3, 3: 2, 4: 1}

DISCIPLINE_LABELS = {
    "kata": "Ката",
    "kumite_ok": "Кумитэ ОК",
    "kumite_pk": "Кумитэ ПК",
    "kumite_sz": "Кумитэ СЗ",
}

# This app targets one federation-classified sport only (see CLAUDE.md) - the
# official protocol header names it explicitly, so it's a constant rather
# than a per-tournament field.
SPORT_NAME = "ВСЕСТИЛЕВОЕ КАРАТЭ"
SPORT_CODE = "0900001411Я"

GENDER_SHORT = {"male": "м", "female": "ж"}

# "Вид программы" в официальном протоколе регистрации - короткий код вида
# кумитэ + категория через пробел (напр. "ОК 70"), а не полное название
# дисциплины - сверено с реальным образцом (docs/samples/сетка ... .xlsx,
# лист "Регистрация", колонка K). Ката уже приходит с таким префиксом в
# самом category_name (см. ТЗ 4.3, "ОК-ката-годзю-рю"/"СЗ-ката-соло"),
# поэтому короткий код нужен только для кумитэ.
DISCIPLINE_SHORT = {"kumite_ok": "ОК", "kumite_pk": "ПК", "kumite_sz": "СЗ"}

GENDER_PLURAL = {"male": "Мужчины", "female": "Женщины"}


def _program_type_label(discipline, category_name):
    if discipline == "kata":
        return category_name or ""
    short = DISCIPLINE_SHORT.get(discipline, discipline)
    return f"{short} {category_name}" if category_name else short


def _discipline_group(discipline, category_name):
    """Официальная "группа дисциплин" (Ограниченный контакт/Полный
    контакт/Средства защиты) - образец группирует ката-категории по этому
    же принципу через префикс ОК-ката-.../СЗ-ката-... в category_name
    (см. docs/samples/СВОДНАЯ_СПРАВКА...xlsx), а не отдельным полем."""
    if discipline == "kumite_pk":
        return "Полный контакт"
    if discipline == "kumite_sz":
        return "Средства защиты"
    if discipline == "kata" and (category_name or "").startswith("СЗ"):
        return "Средства защиты"
    return "Ограниченный контакт"


def _dominant_age_group(participants):
    counts = {}
    for p in participants:
        ag = p.get("age_group")
        if ag:
            counts[ag] = counts.get(ag, 0) + 1
    return max(counts, key=counts.get) if counts else None


def _section_age_label(gender, age_group):
    # "Мужчины"/"Женщины" из compute_age_group уже означают взрослую
    # группу 21+ - в официальном образце это подписано как "18+ лет"
    # (см. docs/samples/СВОДНАЯ_СПРАВКА...xlsx, "Мужчины 18+ лет").
    if age_group in ("Мужчины", "Женщины"):
        return f"{age_group} 18+ лет"
    return age_group or GENDER_PLURAL.get(gender, "")


def _fmt_date(value):
    if not value:
        return ""
    if isinstance(value, (date,)):
        return value.strftime("%d.%m.%Y")
    text = str(value)
    try:
        return date.fromisoformat(text[:10]).strftime("%d.%m.%Y")
    except ValueError:
        return text


def _short_name(p):
    last = (p.get("last_name") or "").strip()
    first = (p.get("first_name") or "").strip()
    full = f"{last} {first}".strip()
    if len(full) <= 20 or not first:
        return full
    return f"{last} {first[0]}."


def _competition_level(tournament):
    return (tournament or {}).get("competition_level") or "club"


def _participant_org(p, competition_level="club"):
    if competition_level == "region":
        return (p.get("region") or p.get("club_name") or "").strip()
    return (p.get("club_name") or p.get("region") or "").strip()


def _participant_label(p, competition_level="club", short=False):
    if not p:
        return {"seed": "", "name": "", "text": ""}
    base_name = _short_name(p) if short else (p.get("full_name") or _short_name(p))
    org = _participant_org(p, competition_level)
    name = f"{base_name} ({org})" if org else base_name
    seed = str(p.get("seed") or "")
    text = f"{seed} {name}".strip() if seed else name
    return {"seed": seed, "name": name, "text": text}


def _clip_text(canv, text, max_width):
    if not text:
        return ""
    if canv.stringWidth(text, canv._fontname, canv._fontsize) <= max_width:
        return text
    ellipsis = "..."
    clipped = text
    while clipped and canv.stringWidth(clipped + ellipsis, canv._fontname, canv._fontsize) > max_width:
        clipped = clipped[:-1]
    return (clipped + ellipsis) if clipped else ellipsis


def team_standings(placements):
    """placements: [{club_name, place}, ...] across all categories.
    Returns [{club_name, points}, ...] sorted best-first."""
    points_by_club = {}
    for p in placements:
        club = p.get("club_name") or "Без клуба"
        points_by_club[club] = points_by_club.get(club, 0) + TEAM_POINTS.get(p["place"], 0)
    return sorted(
        ({"club_name": club, "points": pts} for club, pts in points_by_club.items()),
        key=lambda e: (-e["points"], e["club_name"])
    )


def _category_label(discipline, gender, category_name):
    gender_label = {"male": "муж.", "female": "жен."}.get(gender, gender or "")
    return " / ".join(part for part in (DISCIPLINE_LABELS.get(discipline, discipline), gender_label, category_name) if part)


def _header_row(ws, row, values):
    for col, value in enumerate(values, start=1):
        cell = ws.cell(row=row, column=col, value=value)
        cell.font = Font(bold=True)


REGISTRATION_PROTOCOL_HEADERS = [
    "№", "№ жребия", "Пол", "Фамилия", "Имя", "Отчество", "Дата рождения",
    "Полных лет", "Разряд, звание", "Точный вес", "Вид программы",
    "Команда", "Регион", "Тренер", "Занятое место"
]


def build_workbook(tournament, summary, categories, team_ranking):
    """
    tournament: {name, location, event_date, registration_closes_at, status}
    summary: {participant_count, category_count, discipline_counts: {discipline: count}}
    categories: [{
        discipline, gender, category_name,
        placements: [{place, full_name, club_name, registration_id}, ...],  # may be empty
        progress: [str, ...],  # human-readable log lines
        participants: [{registration_id, seed, last_name, first_name, middle_name,
                        gender, birth_date, age_years, rank, weight, club_name,
                        region, trainer_name, discipline, category_name}, ...]
    }, ...]
    team_ranking: [{club_name, points}, ...]
    """
    wb = Workbook()
    competition_level = _competition_level(tournament)

    # ─── СВОДНАЯ СПРАВКА ────────────────────────────────────────────────
    # Формат сверен с реальным образцом (docs/samples/СВОДНАЯ_СПРАВКА...
    # xlsx): шапка турнира, число участников/команд, список команд, затем
    # призёры - таблица с местами 1-4 в отдельных колонках (ФИО в одной
    # строке, команда строкой ниже), сгруппированная по группе дисциплин
    # (Ограниченный контакт/Полный контакт/Средства защиты) и по
    # возрастной группе.
    summary_ws = wb.active
    summary_ws.title = "Сводная справка"
    summary_ws.cell(row=4, column=2, value=f'вид спорта "{SPORT_NAME.lower()}"').font = Font(bold=True, size=12)
    summary_ws.merge_cells(start_row=4, start_column=2, end_row=5, end_column=5)
    summary_ws.cell(row=6, column=2, value=f"{tournament.get('location') or ''}          {_fmt_date(tournament.get('event_date'))} г.")
    summary_ws.merge_cells(start_row=6, start_column=2, end_row=6, end_column=5)

    club_names = sorted({
        p["club_name"]
        for cat in categories
        for p in cat["participants"]
        if p.get("club_name")
    })
    summary_ws.cell(row=8, column=1, value="Участники")
    summary_ws.cell(row=8, column=2, value=summary.get("participant_count"))
    summary_ws.cell(row=9, column=1, value="Команды")
    summary_ws.cell(row=9, column=2, value=len(club_names))

    summary_ws.cell(row=11, column=1, value="Команды:").font = Font(bold=True)
    row, col = 11, 2
    for name in club_names:
        summary_ws.cell(row=row, column=col, value=name)
        col += 1
        if col > 5:
            col = 2
            row += 1

    row += 2
    summary_ws.cell(row=row, column=1, value="призёры").font = Font(bold=True)
    for col, label in zip((2, 3, 4, 5), ("1 место", "2 место", "3 место", "4 место")):
        summary_ws.cell(row=row, column=col, value=label).font = Font(bold=True)
    row += 1

    sections = []
    section_index = {}
    for cat in categories:
        key = (_discipline_group(cat["discipline"], cat["category_name"]), _section_age_label(cat["gender"], _dominant_age_group(cat["participants"])))
        if key not in section_index:
            section_index[key] = len(sections)
            sections.append((key, []))
        sections[section_index[key]][1].append(cat)

    for (group_label, age_label), cats in sections:
        summary_ws.cell(row=row, column=1, value=f"Группа дисциплин: {group_label}").font = Font(bold=True)
        summary_ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        row += 1
        summary_ws.cell(row=row, column=1, value=age_label).font = Font(bold=True)
        summary_ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        row += 1
        for cat in cats:
            summary_ws.cell(row=row, column=1, value=_program_type_label(cat["discipline"], cat["category_name"]))
            summary_ws.merge_cells(start_row=row, start_column=1, end_row=row + 1, end_column=1)
            placements_by_place = {p["place"]: p for p in cat["placements"]}
            for place in (1, 2, 3, 4):
                p = placements_by_place.get(place)
                if p:
                    summary_ws.cell(row=row, column=1 + place, value=p["full_name"])
                    summary_ws.cell(row=row + 1, column=1 + place, value=p["club_name"])
            row += 2
    for col, width in zip("ABCDE", (26, 24, 24, 24, 24)):
        summary_ws.column_dimensions[col].width = width

    # ─── ПРОТОКОЛ РЕГИСТРАЦИИ (сетка) ──────────────────────────────────
    # Формат сверен с реальным образцом (docs/samples/сетка ....xlsx, лист
    # "Регистрация"): шапка турнира + категории, спаренная подпись
    # "вид программы/место проведения/дата" под значениями, заголовок
    # "ПРОТОКОЛ РЕГИСТРАЦИИ" вразрядку, затем полный состав участников
    # категории (не только призёры), отсортированный по номеру жребия,
    # с местом для подписи главного судьи/секретаря внизу каждого блока.
    reg_ws = wb.create_sheet("Протокол регистрации")
    row = 1
    for cat in categories:
        if not cat["participants"]:
            continue
        age_label = _section_age_label(cat["gender"], _dominant_age_group(cat["participants"]))
        if cat["discipline"] == "kata":
            program_desc = f"{age_label}  {cat['category_name']}"
        else:
            short = DISCIPLINE_SHORT.get(cat["discipline"], cat["discipline"])
            program_desc = f"{age_label}  {short}-весовая категория {cat['category_name']} кг"

        reg_ws.cell(row=row, column=1, value=f" {tournament.get('name')} {_fmt_date(tournament.get('event_date'))} г.").font = Font(bold=True, size=12)
        reg_ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=15)
        row += 1
        reg_ws.cell(row=row, column=1, value=f"Вид спорта: {SPORT_NAME} (номер-код вида спорта - {SPORT_CODE})")
        reg_ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=15)
        row += 1

        reg_ws.cell(row=row, column=1, value=program_desc)
        reg_ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        reg_ws.cell(row=row, column=7, value=tournament.get("location"))
        reg_ws.merge_cells(start_row=row, start_column=7, end_row=row, end_column=10)
        reg_ws.cell(row=row, column=12, value=_fmt_date(tournament.get("event_date")))
        reg_ws.merge_cells(start_row=row, start_column=12, end_row=row, end_column=14)
        row += 1
        for col, label in ((1, "вид программы"), (7, "место проведения соревнований"), (12, "Дата проведения соревнований")):
            reg_ws.cell(row=row, column=col, value=label).font = Font(italic=True, size=9)
        reg_ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        reg_ws.merge_cells(start_row=row, start_column=7, end_row=row, end_column=10)
        reg_ws.merge_cells(start_row=row, start_column=12, end_row=row, end_column=14)
        row += 1

        title_cell = reg_ws.cell(row=row, column=1, value="П Р О Т О К О Л   Р Е Г И С Т Р А Ц И И")
        title_cell.font = Font(bold=True, size=12)
        title_cell.alignment = Alignment(horizontal="center")
        reg_ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=15)
        row += 1

        reg_headers = REGISTRATION_PROTOCOL_HEADERS.copy()
        reg_headers[11] = "Клуб"
        reg_headers[12] = "Регион"
        _header_row(reg_ws, row, reg_headers)
        for col in range(1, 16):
            reg_ws.cell(row=row, column=col).alignment = Alignment(horizontal="center", wrap_text=True)
        row += 1

        place_by_reg = {p["registration_id"]: p["place"] for p in cat["placements"]}
        ordered = sorted(cat["participants"], key=lambda p: (p["seed"] is None, p["seed"]))
        for i, p in enumerate(ordered, start=1):
            values = [
                i, p.get("seed"), GENDER_SHORT.get(p.get("gender"), p.get("gender")),
                p.get("last_name"), p.get("first_name"), p.get("middle_name"),
                _fmt_date(p.get("birth_date")), p.get("age_years"), p.get("rank"),
                p.get("weight"), _program_type_label(p.get("discipline"), p.get("category_name")),
                p.get("club_name"), p.get("region"), p.get("trainer_name"),
                place_by_reg.get(p["registration_id"]),
            ]
            for col, value in enumerate(values, start=1):
                reg_ws.cell(row=row, column=col, value=value)
            row += 1

        row += 1
        reg_ws.cell(row=row, column=6, value="Главный судья:")
        reg_ws.merge_cells(start_row=row, start_column=6, end_row=row, end_column=7)
        row += 1
        reg_ws.cell(row=row, column=6, value="Главный секретарь:")
        reg_ws.merge_cells(start_row=row, start_column=6, end_row=row, end_column=7)
        row += 3
    for col, width in zip("ABCDEFGHIJKLMNO", (4, 9, 5, 14, 14, 14, 12, 8, 12, 9, 14, 22, 16, 20, 8)):
        reg_ws.column_dimensions[col].width = width

    # ─── ПРОТОКОЛ ХОДА СОРЕВНОВАНИЯ ─────────────────────────────────────
    progress_ws = wb.create_sheet("Протокол хода соревнования")
    row = 1
    for cat in categories:
        if not cat["progress"]:
            continue
        progress_ws.cell(row=row, column=1, value=_category_label(cat["discipline"], cat["gender"], cat["category_name"])).font = Font(bold=True, size=12)
        row += 1
        for line in cat["progress"]:
            progress_ws.cell(row=row, column=1, value=line)
            row += 1
        row += 1
    progress_ws.column_dimensions["A"].width = 90

    # ─── КОМАНДНЫЙ ЗАЧЁТ ────────────────────────────────────────────────
    team_ws = wb.create_sheet("Командный зачёт")
    _header_row(team_ws, 1, ["Клуб", "Очки"])
    for i, t in enumerate(team_ranking, start=2):
        team_ws.cell(row=i, column=1, value=t["club_name"])
        team_ws.cell(row=i, column=2, value=t["points"])
    for col, width in zip("AB", (30, 10)):
        team_ws.column_dimensions[col].width = width

    return wb


def _pdf_styles():
    styles = getSampleStyleSheet()
    for name in ("Normal", "BodyText"):
        styles[name].fontName = "DejaVuSans"
    for name in ("Title", "Heading1", "Heading2", "Heading3"):
        styles[name].fontName = "DejaVuSans-Bold"
    styles["Title"].alignment = 1
    styles.add(_paragraph_style("Center", styles["Normal"], alignment=1))
    styles.add(_paragraph_style("DocTitle", styles["Normal"], fontName="DejaVuSans-Bold", fontSize=13, alignment=1))
    return styles


def _paragraph_style(name, parent, **kwargs):
    return ParagraphStyle(name, parent=parent, **kwargs)


def _make_table(rows, header=False):
    table = Table(rows, hAlign="LEFT")
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "DejaVuSans"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        style.append(("FONTNAME", (0, 0), (-1, 0), "DejaVuSans-Bold"))
        style.append(("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke))
    table.setStyle(TableStyle(style))
    return table


# ─── OFFICIAL PROTOCOL HEADER / FOOTER ─────────────────────────────────────
# Layout copied from the federation's own protocol forms (see docs/samples):
# tournament name, sport line, a 3-column info strip (программа / место /
# дата), the document title, then (after the body) a judge signature block.

def _official_header(styles, tournament, program_label, doc_title):
    info_cell = lambda value, caption: Paragraph(
        f"{value or '—'}<br/><font size=7 color='grey'>{caption}</font>", styles["Center"]
    )
    info_table = Table(
        [[
            info_cell(program_label, "вид программы"),
            info_cell(tournament.get("location"), "место проведения соревнований"),
            info_cell(_fmt_date(tournament.get("event_date")), "дата проведения соревнований"),
        ]],
        colWidths=["34%", "33%", "33%"],
    )
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.grey),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [
        Paragraph(tournament.get("name") or "Турнир", styles["Title"]),
        Paragraph(f"Вид спорта: {SPORT_NAME} (номер-код вида спорта {SPORT_CODE})", styles["Center"]),
        Spacer(1, 0.25 * cm),
        info_table,
        Spacer(1, 0.3 * cm),
        Paragraph(doc_title, styles["DocTitle"]),
        Spacer(1, 0.3 * cm),
    ]


def _signature_block(styles):
    table = Table(
        [
            ["Главный судья:", "", "Главный секретарь:", ""],
        ],
        colWidths=[3.2 * cm, 7 * cm, 3.6 * cm, 7 * cm],
    )
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "DejaVuSans"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEBELOW", (1, 0), (1, 0), 0.5, colors.black),
        ("LINEBELOW", (3, 0), (3, 0), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
    ]))
    return table


# ─── ИТОГОВЫЙ ПРОТОКОЛ (full participant table) ────────────────────────────

_FULL_PROTOCOL_HEADER = [
    "№<br/>п/п", "№<br/>квал", "пол", "Фамилия", "Имя", "Отчество", "Дата<br/>рождения",
    "Полных<br/>лет", "Разряд,<br/>звание", "Вид<br/>программы", "Клуб /<br/>регион", "Тренер", "Занятое<br/>место",
]
_FULL_PROTOCOL_WIDTHS = [0.9, 1.0, 0.8, 2.8, 2.4, 2.6, 2.0, 1.3, 2.0, 2.2, 3.85, 3.85, 1.5]


def _full_protocol_table(cat, tournament):
    place_by_reg = {p["registration_id"]: p["place"] for p in cat["placements"] if p.get("registration_id")}
    header_style = ParagraphStyle("ProtoHeader", fontName="DejaVuSans-Bold", fontSize=7.5, alignment=1, leading=9)
    competition_level = _competition_level(tournament)

    def sort_key(p):
        place = place_by_reg.get(p["registration_id"])
        return (0, place) if place is not None else (1, p.get("seed") or 9999, p.get("last_name") or "")

    participants = sorted(cat["participants"], key=sort_key)
    rows = [[Paragraph(h, header_style) for h in _FULL_PROTOCOL_HEADER]]
    for i, p in enumerate(participants, start=1):
        place = place_by_reg.get(p["registration_id"])
        rows.append([
            str(i),
            str(p["seed"]) if p.get("seed") else "",
            GENDER_SHORT.get(p.get("gender"), p.get("gender") or ""),
            p.get("last_name") or "",
            p.get("first_name") or "",
            p.get("middle_name") or "",
            _fmt_date(p.get("birth_date")),
            str(p.get("age_years") or ""),
            p.get("rank") or "",
            cat["category_name"] or "",
            _participant_org(p, competition_level),
            p.get("trainer_name") or "",
            str(place) if place is not None else "",
        ])

    table = Table(rows, colWidths=[w * cm for w in _FULL_PROTOCOL_WIDTHS], repeatRows=1)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "DejaVuSans"),
        ("FONTNAME", (0, 0), (-1, 0), "DejaVuSans-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (2, -1), "CENTER"),
        ("ALIGN", (6, 0), (7, -1), "CENTER"),
        ("ALIGN", (-1, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return table


# ─── ПРОТОКОЛ ХОДА СОРЕВНОВАНИЯ — ката (round score table) ─────────────────

_KATA_ROUND_TITLES = {"round1": "1-й круг", "round2": "2-й круг", "final": "Финал"}
_KATA_ROUND_ORDER = ["round1", "round2", "final"]


def _kata_rounds_table(cat):
    rounds_present = [r for r in _KATA_ROUND_ORDER if any(s["round_label"] == r for s in cat["kata_scores"])]
    if not rounds_present:
        return None

    score_by_reg_round = {(s["registration_id"], s["round_label"]): s for s in cat["kata_scores"]}
    place_by_reg = {p["registration_id"]: p["place"] for p in cat["placements"] if p.get("registration_id")}

    participants = sorted(
        cat["participants"],
        key=lambda p: (
            place_by_reg.get(p["registration_id"]) is None,
            place_by_reg.get(p["registration_id"], 9999),
            p.get("seed") or 9999,
        ),
    )
    participants = [p for p in participants if any((p["registration_id"], r) in score_by_reg_round for r in rounds_present)]

    header_top = ["№", "Фамилия Имя"]
    header_sub = ["", ""]
    for r in rounds_present:
        header_top += [_KATA_ROUND_TITLES[r], "", "", "", "", ""]
        header_sub += ["1", "2", "3", "4", "5", "Итог"]
    header_top.append("Место")
    header_sub.append("")

    rows = [header_top, header_sub]
    for i, p in enumerate(participants, start=1):
        row = [str(i), _short_name(p)]
        for r in rounds_present:
            s = score_by_reg_round.get((p["registration_id"], r))
            if s:
                row += [
                    f'{s["score_1"]:g}', f'{s["score_2"]:g}', f'{s["score_3"]:g}',
                    f'{s["score_4"]:g}', f'{s["score_5"]:g}', f'{s["total_score"]:g}',
                ]
            else:
                row += ["", "", "", "", "", ""]
        place = place_by_reg.get(p["registration_id"])
        row.append(str(place) if place is not None else "")
        rows.append(row)

    n_round_cols = 6 * len(rounds_present)
    col_widths = [0.8 * cm, 3.6 * cm] + [1.55 * cm] * n_round_cols + [1.2 * cm]
    table = Table(rows, colWidths=col_widths, repeatRows=2)

    style = [
        ("FONTNAME", (0, 0), (-1, -1), "DejaVuSans"),
        ("FONTNAME", (0, 0), (-1, 1), "DejaVuSans-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 1), colors.whitesmoke),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("SPAN", (0, 0), (0, 1)),
        ("SPAN", (1, 0), (1, 1)),
        ("SPAN", (-1, 0), (-1, 1)),
    ]
    col = 2
    for _ in rounds_present:
        style.append(("SPAN", (col, 0), (col + 5, 0)))
        col += 6
    table.setStyle(TableStyle(style))
    return table


# ─── ПРОТОКОЛ ХОДА СОРЕВНОВАНИЯ — кумитэ (bracket tree) ────────────────────

def _bouts_index(bouts):
    index = {}
    for b in bouts:
        if b.get("registration_id_a") and b.get("registration_id_b"):
            index[frozenset((b["registration_id_a"], b["registration_id_b"]))] = b
    return index


def _resolve_match(a, b, bouts_by_pair):
    """a, b: participant dict or None. Returns (winner_or_None, bout_or_None).
    Matching is purely by which two registrations a bout lists, so it works
    regardless of how a round was labelled when the secretary entered it."""
    if a and not b:
        return a, None
    if b and not a:
        return b, None
    if not a and not b:
        return None, None
    bout = bouts_by_pair.get(frozenset((a["registration_id"], b["registration_id"])))
    if bout and bout["status"] == "completed" and bout.get("winner_registration_id"):
        winner = a if bout["winner_registration_id"] == a["registration_id"] else b
        return winner, bout
    return None, bout


def _bracket_rounds(participants, bouts_by_pair):
    """participants: entries with global draw numbers (№ жреб.).
  Within a subgroup, local bracket positions 1..k map to sorted global seeds
  (same logic as federation Excel templates and app/draw.py::subgroup_round1)."""
    sorted_p = sorted((p for p in participants if p.get("seed")), key=lambda p: p["seed"])
    n = len(sorted_p)
    if n == 0:
        return []
    by_local = {i + 1: p for i, p in enumerate(sorted_p)}
    size = next_power_of_two(n)
    pairs = round1_pairs_by_seed(size)

    current = []
    for la, lb in pairs:
        pa, pb = by_local.get(la), by_local.get(lb)
        winner, bout = _resolve_match(pa, pb, bouts_by_pair)
        current.append({"a": pa, "b": pb, "winner": winner, "bout": bout})

    rounds = [current]
    while len(current) > 1:
        nxt = []
        for i in range(0, len(current), 2):
            wa, wb = current[i]["winner"], current[i + 1]["winner"]
            # Byes only exist at the leaf level (padding to a power of two);
            # from round 2 on, a missing side means "not decided yet", not
            # "no opponent" - _resolve_match can't tell those apart, so only
            # call it once both feeder matches have an actual winner, or an
            # undecided semifinal would let the other side prematurely "win".
            winner, bout = _resolve_match(wa, wb, bouts_by_pair) if wa and wb else (None, None)
            nxt.append({"a": wa, "b": wb, "winner": winner, "bout": bout})
        rounds.append(nxt)
        current = nxt
    return rounds


class _BracketDiagram(Flowable):
    """Draws a single-elimination bracket (one tree per subgroup, merging
    into one final box when there are two subgroups, plus a small
    consolation-match box for 3rd place) using plain canvas primitives -
    reportlab has no built-in bracket/tree flowable."""

    BOX_W = 3.2 * cm
    H_GAP = 0.7 * cm
    MAX_ROW_H = 0.85 * cm
    MIN_ROW_H = 0.4 * cm
    GROUP_GAP = 0.6 * cm
    SEED_W = 0.42 * cm

    def __init__(self, rounds_per_group, final_match, bronze_match, avail_width, avail_height, competition_level="club", font_name="DejaVuSans"):
        super().__init__()
        self.rounds_per_group = rounds_per_group
        self.final_match = final_match
        self.bronze_match = bronze_match
        self.competition_level = competition_level
        self.font_name = font_name

        self.leaf_counts = [2 * len(r[0]) for r in rounds_per_group]
        total_leaf_rows = sum(self.leaf_counts) or 1
        n_groups = len(rounds_per_group)
        bronze_rows = 3 if bronze_match else 0

        content_height = total_leaf_rows * self.MAX_ROW_H + max(n_groups - 1, 0) * self.GROUP_GAP
        content_height += bronze_rows * self.MAX_ROW_H
        self.row_h = self.MAX_ROW_H
        if avail_height and content_height > avail_height:
            scale = max(avail_height / content_height, 0.35)
            self.row_h = max(self.MAX_ROW_H * scale, self.MIN_ROW_H)

        max_rounds = max((len(r) for r in rounds_per_group), default=0)
        self.n_cols = 1 + max_rounds + (1 if n_groups > 1 else 0)
        self.box_w, self.h_gap = self.BOX_W, self.H_GAP
        natural_width = self.n_cols * self.box_w + (self.n_cols - 1) * self.h_gap
        if avail_width and natural_width > avail_width:
            scale = max(avail_width / natural_width, 0.5)
            self.box_w *= scale
            self.h_gap *= scale
        self.font_size = 7 if self.box_w > 2.2 * cm else 6

        self.width = self.n_cols * self.box_w + (self.n_cols - 1) * self.h_gap
        self.height = (
            sum(self.leaf_counts) * self.row_h
            + max(n_groups - 1, 0) * self.GROUP_GAP
            + (bronze_rows * self.row_h + 0.4 * cm if bronze_match else 0)
        )
        self.max_rounds = max_rounds

    def wrap(self, avail_width, avail_height):
        return self.width, self.height

    def _box(self, c, y_center, label, bold=False):
        x = c * (self.box_w + self.h_gap)
        y = y_center - self.row_h / 2
        canv = self.canv
        canv.setLineWidth(1.1 if bold else 0.6)
        canv.rect(x, y, self.box_w, self.row_h, stroke=1, fill=0)
        text = label.get("text") if isinstance(label, dict) else str(label or "")
        if text:
            seed = label.get("seed", "") if isinstance(label, dict) else ""
            name = label.get("name", text) if isinstance(label, dict) else text
            seed_w = min(self.SEED_W, self.box_w * 0.22)
            name_x = x + seed_w + 0.08 * cm
            name_w = self.box_w - seed_w - 0.16 * cm
            canv.line(x + seed_w, y, x + seed_w, y + self.row_h)
            canv.setFont(f"{self.font_name}-Bold" if bold else self.font_name, self.font_size)
            if seed:
                canv.drawCentredString(x + seed_w / 2, y_center - self.font_size / 3, seed)
            canv.drawString(name_x, y_center - self.font_size / 3, _clip_text(canv, name, name_w))
        return x, x + self.box_w

    def draw(self):
        top_y = self.height
        group_champion_y = []

        y_cursor = top_y
        for gi, rounds in enumerate(self.rounds_per_group):
            leaf_n = self.leaf_counts[gi]
            ys0, present0 = [], []
            for i in range(leaf_n):
                y_cursor -= self.row_h
                ys0.append(y_cursor + self.row_h / 2)
                match = rounds[0][i // 2]
                slot = match["a"] if i % 2 == 0 else match["b"]
                present0.append(slot is not None)
                if slot is not None:
                    self._box(0, ys0[-1], _participant_label(slot, self.competition_level, short=True))
            if gi < len(self.rounds_per_group) - 1:
                y_cursor -= self.GROUP_GAP

            col_ys, col_present = ys0, present0
            for c in range(1, len(rounds) + 1):
                next_ys = []
                for j, match in enumerate(rounds[c - 1]):
                    ya, pa = col_ys[2 * j], col_present[2 * j]
                    yb, pb = col_ys[2 * j + 1], col_present[2 * j + 1]
                    if pa and pb:
                        py = (ya + yb) / 2
                    elif pa:
                        py = ya
                    else:
                        py = yb
                    next_ys.append(py)
                    x_from = c * (self.box_w + self.h_gap) - self.h_gap
                    x_to = c * (self.box_w + self.h_gap)
                    if pa and pb:
                        canv = self.canv
                        canv.setLineWidth(0.6)
                        mid_x = x_from + self.h_gap / 2
                        canv.line(x_from, ya, mid_x, ya)
                        canv.line(x_from, yb, mid_x, yb)
                        canv.line(mid_x, ya, mid_x, yb)
                        canv.line(mid_x, py, x_to, py)
                    else:
                        canv = self.canv
                        canv.setLineWidth(0.6)
                        canv.line(x_from, py, x_to, py)
                    label = _participant_label(match["winner"], self.competition_level, short=True) if match["winner"] else ""
                    self._box(c, py, label)
                col_ys, col_present = next_ys, [True] * len(next_ys)

            # carry the group champion forward (straight passthrough) if the
            # other group's tree is taller, so the two line up for the final.
            champ_y = col_ys[0] if col_ys else ys0[0]
            champ_label = _participant_label(rounds[-1][0]["winner"], self.competition_level, short=True) if rounds and rounds[-1][0]["winner"] else ""
            for c in range(len(rounds) + 1, self.max_rounds + 1):
                x_from = c * (self.box_w + self.h_gap) - self.h_gap
                x_to = c * (self.box_w + self.h_gap)
                self.canv.setLineWidth(0.6)
                self.canv.line(x_from, champ_y, x_to, champ_y)
                self._box(c, champ_y, champ_label)
            group_champion_y.append(champ_y)

        if self.final_match:
            c = self.max_rounds + 1
            x_from = c * (self.box_w + self.h_gap) - self.h_gap
            x_to = c * (self.box_w + self.h_gap)
            y0, y1 = group_champion_y[0], group_champion_y[-1]
            py = (y0 + y1) / 2
            canv = self.canv
            canv.setLineWidth(0.6)
            mid_x = x_from + self.h_gap / 2
            canv.line(x_from, y0, mid_x, y0)
            canv.line(x_from, y1, mid_x, y1)
            canv.line(mid_x, y0, mid_x, y1)
            canv.line(mid_x, py, x_to, py)
            label = _participant_label(self.final_match["winner"], self.competition_level, short=True) if self.final_match["winner"] else ""
            self._box(c, py, label, bold=True)

        if self.bronze_match:
            self.canv.setFont(self.font_name, self.font_size)
            label_y = y_cursor - 0.55 * cm
            self.canv.drawString(0, label_y, "Матч за 3-е место")
            row_h = self.row_h
            ya = label_y - 0.25 * cm - row_h / 2
            yb = ya - row_h - 0.1 * cm
            a, b, winner = self.bronze_match["a"], self.bronze_match["b"], self.bronze_match["winner"]
            self._box(0, ya, _participant_label(a, self.competition_level, short=True) if a else "")
            self._box(0, yb, _participant_label(b, self.competition_level, short=True) if b else "")
            py = (ya + yb) / 2
            x_from = 1 * (self.box_w + self.h_gap) - self.h_gap
            x_to = 1 * (self.box_w + self.h_gap)
            canv = self.canv
            mid_x = x_from + self.h_gap / 2
            canv.line(x_from, ya, mid_x, ya)
            canv.line(x_from, yb, mid_x, yb)
            canv.line(mid_x, ya, mid_x, yb)
            canv.line(mid_x, py, x_to, py)
            self._box(1, py, _participant_label(winner, self.competition_level, short=True) if winner else "")


def _build_bracket_diagram(cat, avail_width, avail_height):
    participants = cat["participants"]
    if not any(p.get("seed") for p in participants):
        return None

    bouts_by_pair = _bouts_index(cat["bouts"])
    groups = {}
    for p in participants:
        groups.setdefault(p.get("subgroup") or 1, []).append(p)
    group_keys = sorted(groups.keys())
    rounds_per_group = [_bracket_rounds(groups[k], bouts_by_pair) for k in group_keys]
    rounds_per_group = [r for r in rounds_per_group if r]
    if not rounds_per_group:
        return None

    final_match = None
    if len(rounds_per_group) > 1:
        champs = [r[-1][0]["winner"] for r in rounds_per_group]
        final_match = {"a": champs[0], "b": champs[-1], "winner": None}
        if all(champs):
            final_match["winner"], _ = _resolve_match(champs[0], champs[-1], bouts_by_pair)

    by_reg_id = {p["registration_id"]: p for p in participants}
    bronze_bout = next((b for b in cat["bouts"] if b["round_label"] == "bronze"), None)
    bronze_match = None
    if bronze_bout:
        a = by_reg_id.get(bronze_bout["registration_id_a"])
        b = by_reg_id.get(bronze_bout["registration_id_b"])
        winner = None
        if bronze_bout["status"] == "completed" and bronze_bout.get("winner_registration_id"):
            winner_id = bronze_bout["winner_registration_id"]
            winner = a if a and a["registration_id"] == winner_id else b
        bronze_match = {"a": a, "b": b, "winner": winner}

    return _BracketDiagram(
        rounds_per_group, final_match, bronze_match, avail_width, avail_height,
        competition_level=cat.get("competition_level") or "club"
    )


def _results_table(cat, styles):
    if not cat["placements"]:
        return [Paragraph("Результаты пока не определены.", styles["Normal"])]
    org_header = "Регион" if cat.get("competition_level") == "region" else "Клуб"
    rows = [[ "Место", "Фамилия Имя Отчество", org_header ]] + [
        [str(p["place"]), p["full_name"], _participant_org(p, cat.get("competition_level") or "club")] for p in cat["placements"]
    ]
    table = Table(rows, colWidths=[2 * cm, 8 * cm, 6 * cm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "DejaVuSans"),
        ("FONTNAME", (0, 0), (-1, 0), "DejaVuSans-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
    ]))
    return [Paragraph("Результаты", styles["Heading3"]), Spacer(1, 0.15 * cm), table]


def build_pdf(tournament, summary, categories, team_ranking):
    """Two of the four sections (итоговый протокол / протокол хода
    соревнования) are laid out per-category to match the federation's own
    protocol forms (see docs/samples); сводная справка and командный зачёт
    stay as simple summary tables since the samples don't cover those."""
    styles = _pdf_styles()
    page_size = landscape(A4)
    margin = 1.2 * cm
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=page_size, topMargin=margin, bottomMargin=margin, leftMargin=margin, rightMargin=margin)
    avail_width = page_size[0] - 2 * margin
    avail_height = page_size[1] - 2 * margin - 6 * cm  # leave room for header/footer on the tree page

    story = [Paragraph("СпортДок — Итоговые документы", styles["Title"]), Spacer(1, 0.3 * cm)]

    story.append(Paragraph("Сводная справка", styles["Heading2"]))
    info_rows = [
        ["Турнир", tournament.get("name") or ""],
        ["Место проведения", tournament.get("location") or ""],
        ["Дата турнира", tournament.get("event_date") or ""],
        ["Закрытие заявок", tournament.get("registration_closes_at") or ""],
        ["Статус", tournament.get("status") or ""],
        ["Участников заявлено", str(summary.get("participant_count", 0))],
        ["Категорий", str(summary.get("category_count", 0))],
    ]
    story.append(_make_table(info_rows))
    story.append(Spacer(1, 0.3 * cm))
    discipline_rows = [["Дисциплина", "Участников"]] + [
        [DISCIPLINE_LABELS.get(d, d), str(c)] for d, c in summary.get("discipline_counts", {}).items()
    ]
    story.append(_make_table(discipline_rows, header=True))

    for cat in categories:
        program_label = _category_label(cat["discipline"], cat["gender"], cat["category_name"])

        story.append(PageBreak())
        story += _official_header(styles, tournament, program_label, "ИТОГОВЫЙ ПРОТОКОЛ")
        if cat["participants"]:
            story.append(_full_protocol_table(cat, tournament))
        else:
            story.append(Paragraph("Участники не заявлены.", styles["Normal"]))
        story.append(Spacer(1, 1 * cm))
        story.append(_signature_block(styles))

        story.append(PageBreak())
        story += _official_header(styles, tournament, program_label, "ПРОТОКОЛ ХОДА СОРЕВНОВАНИЙ")
        if cat["discipline"] == "kata":
            kata_table = _kata_rounds_table(cat)
            if kata_table:
                story.append(kata_table)
            else:
                story.append(Paragraph("Результаты пока не введены.", styles["Normal"]))
        else:
            diagram = _build_bracket_diagram(cat, avail_width, avail_height)
            if diagram:
                story.append(diagram)
            else:
                story.append(Paragraph("Жеребьёвка ещё не проведена.", styles["Normal"]))
            story.append(Spacer(1, 0.4 * cm))
            story.append(KeepTogether(_results_table(cat, styles)))
        story.append(Spacer(1, 0.6 * cm))
        story.append(_signature_block(styles))

    story.append(PageBreak())
    story.append(Paragraph("Командный зачёт", styles["Heading2"]))
    if team_ranking:
        rows = [["Клуб", "Очки"]] + [[t["club_name"], str(t["points"])] for t in team_ranking]
        story.append(_make_table(rows, header=True))
    else:
        story.append(Paragraph("Данных пока нет.", styles["Normal"]))

    doc.build(story)
    buffer.seek(0)
    return buffer
