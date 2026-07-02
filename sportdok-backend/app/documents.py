import os
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

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


def build_workbook(tournament, summary, categories, team_ranking):
    """
    tournament: {name, location, event_date, registration_closes_at, status}
    summary: {participant_count, category_count, discipline_counts: {discipline: count}}
    categories: [{
        discipline, gender, category_name,
        placements: [{place, full_name, club_name}, ...],  # may be empty
        progress: [str, ...]  # human-readable log lines
    }, ...]
    team_ranking: [{club_name, points}, ...]
    """
    wb = Workbook()

    summary_ws = wb.active
    summary_ws.title = "Сводная справка"
    summary_ws.append(["СпортДок — Сводная справка"])
    summary_ws["A1"].font = Font(bold=True, size=14)
    summary_ws.append([])
    for label, value in [
        ("Турнир", tournament.get("name")),
        ("Место проведения", tournament.get("location")),
        ("Дата турнира", tournament.get("event_date")),
        ("Закрытие заявок", tournament.get("registration_closes_at")),
        ("Статус", tournament.get("status")),
        ("Участников заявлено", summary.get("participant_count")),
        ("Категорий", summary.get("category_count")),
    ]:
        summary_ws.append([label, value])
    summary_ws.append([])
    summary_ws.append(["Дисциплина", "Участников"])
    for discipline, count in summary.get("discipline_counts", {}).items():
        summary_ws.append([DISCIPLINE_LABELS.get(discipline, discipline), count])
    for col, width in zip("AB", (28, 24)):
        summary_ws.column_dimensions[col].width = width

    final_ws = wb.create_sheet("Итоговый протокол")
    row = 1
    for cat in categories:
        if not cat["placements"]:
            continue
        final_ws.cell(row=row, column=1, value=_category_label(cat["discipline"], cat["gender"], cat["category_name"])).font = Font(bold=True, size=12)
        row += 1
        _header_row(final_ws, row, ["Место", "Участник", "Клуб"])
        row += 1
        for p in cat["placements"]:
            final_ws.cell(row=row, column=1, value=p["place"])
            final_ws.cell(row=row, column=2, value=p["full_name"])
            final_ws.cell(row=row, column=3, value=p["club_name"])
            row += 1
        row += 1
    for col, width in zip("ABC", (10, 30, 24)):
        final_ws.column_dimensions[col].width = width

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
    return styles


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


def build_pdf(tournament, summary, categories, team_ranking):
    """Same four sections as build_workbook, laid out as one PDF with page
    breaks between them (PDF has no sheet concept)."""
    styles = _pdf_styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
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

    story.append(PageBreak())
    story.append(Paragraph("Итоговый протокол", styles["Heading2"]))
    any_placements = False
    for cat in categories:
        if not cat["placements"]:
            continue
        any_placements = True
        story.append(Paragraph(_category_label(cat["discipline"], cat["gender"], cat["category_name"]), styles["Heading3"]))
        rows = [["Место", "Участник", "Клуб"]] + [
            [str(p["place"]), p["full_name"], p["club_name"] or ""] for p in cat["placements"]
        ]
        story.append(_make_table(rows, header=True))
    if not any_placements:
        story.append(Paragraph("Итоги пока не определены.", styles["Normal"]))

    story.append(PageBreak())
    story.append(Paragraph("Протокол хода соревнования", styles["Heading2"]))
    any_progress = False
    for cat in categories:
        if not cat["progress"]:
            continue
        any_progress = True
        story.append(Paragraph(_category_label(cat["discipline"], cat["gender"], cat["category_name"]), styles["Heading3"]))
        for line in cat["progress"]:
            story.append(Paragraph(line, styles["Normal"]))
    if not any_progress:
        story.append(Paragraph("Результатов пока нет.", styles["Normal"]))

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
