"""Ката-группа: ровно 3 человека из одного клуба = одна команда.

Если в клубе 4+ заявленных в ту же категорию — следующие полные тройки
этого же клуба (команда 2, 3, …). Остаток 1–2 человека — не команда
(team_number сбрасывается), в жеребьёвку не входят.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Optional

KATA_GROUP_MARKERS = ("ката-группа", "ката группа")
KATA_GROUP_TEAM_SIZE = 3


def is_kata_group_category(category_name: Optional[str]) -> bool:
    name = (category_name or "").strip().lower().replace("ё", "е")
    return any(m in name for m in KATA_GROUP_MARKERS)


def _club_key(club_name: Optional[str], region: Optional[str] = None) -> str:
    c = (club_name or "").strip()
    if c:
        return c
    r = (region or "").strip()
    return r or "Без клуба"


def assign_kata_group_teams(db, tournament_id, region_lookup: Optional[dict] = None) -> dict:
    """Пронумеровать только полные тройки по клубу.

    Внутри (discipline, gender, category_name, club): сортировка по ФИО,
    куски по 3 → team_number «1», «2», …; хвост 1–2 → team_number = None.
    """
    from app.models.athlete import Athlete, Registration

    if region_lookup is None:
        region_lookup = {}

    rows = (
        db.query(Registration, Athlete)
        .join(Athlete, Registration.athlete_id == Athlete.id)
        .filter(Registration.tournament_id == tournament_id)
        .order_by(Athlete.last_name, Athlete.first_name, Athlete.middle_name, Registration.id)
        .all()
    )

    buckets: dict[tuple, list] = defaultdict(list)
    for reg, athlete in rows:
        if reg.discipline != "kata" or not is_kata_group_category(reg.category_name):
            continue
        region = region_lookup.get(athlete.club_name) if athlete.club_name else None
        key = (
            reg.discipline,
            athlete.gender or "",
            (reg.category_name or "").strip(),
            _club_key(athlete.club_name, region),
        )
        buckets[key].append(reg)

    updated = 0
    teams = 0
    leftovers = 0
    for members in buckets.values():
        full_count = (len(members) // KATA_GROUP_TEAM_SIZE) * KATA_GROUP_TEAM_SIZE
        for i in range(0, full_count, KATA_GROUP_TEAM_SIZE):
            chunk = members[i : i + KATA_GROUP_TEAM_SIZE]
            team_no = str(i // KATA_GROUP_TEAM_SIZE + 1)
            teams += 1
            for reg in chunk:
                if reg.team_number != team_no:
                    reg.team_number = team_no
                    updated += 1
        for reg in members[full_count:]:
            leftovers += 1
            if reg.team_number is not None:
                reg.team_number = None
                updated += 1

    return {
        "updated": updated,
        "categories": len({(d, g, c) for (d, g, c, _club) in buckets.keys()}),
        "teams": teams,
        "people": sum(len(v) for v in buckets.values()),
        "leftovers": leftovers,
    }


def team_display_label(team_number: str, club_name: Optional[str], region: Optional[str]) -> str:
    """Команда Алтайского края 1 — регион предпочтительнее названия клуба."""
    org = (region or "").strip() or (club_name or "").strip() or "без клуба"
    return f"Команда {org} {team_number}"


def collapse_kata_group_for_draw(participants: list[dict]) -> list[dict]:
    """Свернуть только полные тройки (ровно 3) одного клуба для жеребьёвки."""
    by_team: dict[tuple, list] = defaultdict(list)
    for p in participants:
        reg = p.get("_reg")
        team_no = (getattr(reg, "team_number", None) if reg is not None else None) or p.get("team_number")
        if not team_no:
            continue
        region = (p.get("region") or "").strip()
        club = _club_key(p.get("club_name"), region)
        key = (str(team_no), club)
        by_team[key].append(p)

    collapsed = []
    for key, members in by_team.items():
        if len(members) != KATA_GROUP_TEAM_SIZE:
            if len(members) > KATA_GROUP_TEAM_SIZE:
                members = members[:KATA_GROUP_TEAM_SIZE]
            else:
                continue
        lead = members[0]
        names = [m.get("full_name") or "" for m in members]
        team_no, club = key
        region = (lead.get("region") or "").strip()
        collapsed.append({
            **{k: v for k, v in lead.items() if k != "_reg"},
            "registration_id": lead["registration_id"],
            "full_name": team_display_label(team_no, club, region),
            "club_name": club,
            "region": region or lead.get("region"),
            "team_number": team_no,
            "team_member_ids": [m["registration_id"] for m in members],
            "team_member_names": names,
            "rank_sort_order": min(
                (m.get("rank_sort_order") for m in members if m.get("rank_sort_order") is not None),
                default=None,
            ),
            "_regs": [m["_reg"] for m in members if "_reg" in m],
            "_reg": lead.get("_reg"),
        })
    collapsed.sort(key=lambda p: (
        (p.get("region") or p.get("club_name") or ""),
        int(p["team_number"]) if str(p.get("team_number") or "").isdigit() else 999,
    ))
    return collapsed


def apply_team_seeds(team_participants: Iterable[dict]) -> None:
    """Проставить одинаковый seed/subgroup всем членам команды после жеребьёвки."""
    for p in team_participants:
        seed = p.get("seed")
        subgroup = p.get("subgroup")
        regs = p.get("_regs") or []
        if p.get("_reg") and p["_reg"] not in regs:
            regs = [p["_reg"], *regs]
        for reg in regs:
            if reg is None:
                continue
            reg.seed = seed
            reg.subgroup = subgroup
