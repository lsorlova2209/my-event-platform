"""Ката-группа: максимум 3 человека из одного клуба = одна команда.

Если в клубе больше 3 заявленных в ту же категорию — из остальных
собираются следующие команды этого же клуба (4–6 → команда 2 и т.д.).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Optional

KATA_GROUP_MARKERS = ("ката-группа", "ката группа")
KATA_GROUP_TEAM_SIZE = 3


def is_kata_group_category(category_name: Optional[str]) -> bool:
    name = (category_name or "").strip().lower().replace("ё", "е")
    return any(m in name for m in KATA_GROUP_MARKERS)


def _club_key(club_name: Optional[str]) -> str:
    return (club_name or "").strip() or "Без клуба"


def assign_kata_group_teams(db, tournament_id, region_lookup: Optional[dict] = None) -> dict:
    """Пронумеровать команды в категориях ката-группа по клубу.

    Внутри (discipline, gender, category_name, club) участники сортируются
    по ФИО и режутся тройками: 1–3 → команда «1», 4–6 → «2» и т.д.
    Неполная последняя тройка тоже получает номер (для отображения).

    region_lookup не влияет на состав команд (оставлен для совместимости вызовов).

    Возвращает {updated, categories, teams, people}.
    """
    from app.models.athlete import Athlete, Registration

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
        key = (
            reg.discipline,
            athlete.gender or "",
            (reg.category_name or "").strip(),
            _club_key(athlete.club_name),
        )
        buckets[key].append(reg)

    updated = 0
    teams = 0
    for members in buckets.values():
        for i in range(0, len(members), KATA_GROUP_TEAM_SIZE):
            chunk = members[i : i + KATA_GROUP_TEAM_SIZE]
            team_no = str(i // KATA_GROUP_TEAM_SIZE + 1)
            teams += 1
            for reg in chunk:
                if reg.team_number != team_no:
                    reg.team_number = team_no
                    updated += 1

    return {
        "updated": updated,
        "categories": len({(d, g, c) for (d, g, c, _club) in buckets.keys()}),
        "teams": teams,
        "people": sum(len(v) for v in buckets.values()),
    }


def collapse_kata_group_for_draw(participants: list[dict]) -> list[dict]:
    """Свернуть полные тройки одного клуба в одну запись для жеребьёвки.

    Неполные команды (<3) в жеребьёвку не входят.
    """
    by_team: dict[tuple, list] = defaultdict(list)
    for p in participants:
        reg = p.get("_reg")
        team_no = (getattr(reg, "team_number", None) if reg is not None else None) or p.get("team_number")
        if not team_no:
            continue
        club = _club_key(p.get("club_name"))
        key = (str(team_no), club)
        by_team[key].append(p)

    collapsed = []
    for key, members in by_team.items():
        if len(members) < KATA_GROUP_TEAM_SIZE:
            continue
        members = members[:KATA_GROUP_TEAM_SIZE]
        lead = members[0]
        names = [m.get("full_name") or "" for m in members]
        team_no, club = key
        region = (lead.get("region") or "").strip()
        label_org = f"{club}" + (f" · {region}" if region else "")
        collapsed.append({
            **{k: v for k, v in lead.items() if k != "_reg"},
            "registration_id": lead["registration_id"],
            "full_name": f"Команда {team_no} · {label_org}",
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
        (p.get("club_name") or ""),
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
