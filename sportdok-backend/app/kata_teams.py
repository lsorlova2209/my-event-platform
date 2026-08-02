"""Командные категории: тройки/четвёрки из одного клуба.

- Ката-группа: ровно 3 человека.
- Командное кумитэ («командные соревнования»): 3 или 4 человека.
Остаток, который нельзя уложить в допустимый размер — вне команды
(team_number = None), в жеребьёвку не входит.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Optional, Sequence

KATA_GROUP_MARKERS = ("ката-группа", "ката группа")
KUMITE_TEAM_CATEGORY = "командные соревнования"
KUMITE_DISCIPLINES = {"kumite_ok", "kumite_pk", "kumite_sz"}


def is_kata_group_category(category_name: Optional[str]) -> bool:
    name = (category_name or "").strip().lower().replace("ё", "е")
    return any(m in name for m in KATA_GROUP_MARKERS)


def is_kumite_team_category(discipline: Optional[str], category_name: Optional[str]) -> bool:
    if (discipline or "") not in KUMITE_DISCIPLINES:
        return False
    return (category_name or "").strip().lower() == KUMITE_TEAM_CATEGORY


def is_club_team_category(discipline: Optional[str], category_name: Optional[str]) -> bool:
    if discipline == "kata" and is_kata_group_category(category_name):
        return True
    return is_kumite_team_category(discipline, category_name)


def allowed_team_sizes(discipline: Optional[str], category_name: Optional[str]) -> tuple[int, ...]:
    if is_kumite_team_category(discipline, category_name):
        return (3, 4)
    if discipline == "kata" and is_kata_group_category(category_name):
        return (3,)
    return ()


def pack_team_sizes(n: int, allowed: Sequence[int]) -> list[int]:
    """Максимум людей в команды размеров из allowed; остаток отбрасывается."""
    if n <= 0 or not allowed:
        return []
    allowed = tuple(sorted(set(int(x) for x in allowed if int(x) > 0), reverse=True))
    best_s = 0
    best_counts = None
    # counts[i] = сколько команд размера allowed[i]
    from itertools import product

    maxes = [n // s + 1 for s in allowed]
    for combo in product(*[range(m) for m in maxes]):
        total = sum(c * s for c, s in zip(combo, allowed))
        if total <= n and total > best_s:
            best_s = total
            best_counts = combo
    if not best_counts or best_s == 0:
        return []
    sizes: list[int] = []
    for count, size in zip(best_counts, allowed):
        sizes.extend([size] * count)
    # сначала более крупные команды
    sizes.sort(reverse=True)
    return sizes


def _club_key(club_name: Optional[str], region: Optional[str] = None) -> str:
    c = (club_name or "").strip()
    if c:
        return c
    r = (region or "").strip()
    return r or "Без клуба"


def assign_club_teams(db, tournament_id, region_lookup: Optional[dict] = None) -> dict:
    """Пронумеровать команды ката-группы и командного кумитэ по клубу."""
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
    size_by_bucket: dict[tuple, tuple[int, ...]] = {}
    for reg, athlete in rows:
        sizes = allowed_team_sizes(reg.discipline, reg.category_name)
        if not sizes:
            continue
        region = region_lookup.get(athlete.club_name) if athlete.club_name else None
        key = (
            reg.discipline,
            athlete.gender or "",
            (reg.category_name or "").strip(),
            _club_key(athlete.club_name, region),
        )
        buckets[key].append(reg)
        size_by_bucket[key] = sizes

    updated = 0
    teams = 0
    leftovers = 0
    for key, members in buckets.items():
        sizes = pack_team_sizes(len(members), size_by_bucket[key])
        idx = 0
        team_no = 0
        for size in sizes:
            team_no += 1
            chunk = members[idx : idx + size]
            idx += size
            teams += 1
            num = str(team_no)
            for reg in chunk:
                if reg.team_number != num:
                    reg.team_number = num
                    updated += 1
        for reg in members[idx:]:
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


# Обратная совместимость со старыми импортами
def assign_kata_group_teams(db, tournament_id, region_lookup: Optional[dict] = None) -> dict:
    return assign_club_teams(db, tournament_id, region_lookup)


def team_display_label(team_number: str, club_name: Optional[str], region: Optional[str]) -> str:
    org = (region or "").strip() or (club_name or "").strip() or "без клуба"
    return f"Команда {org} {team_number}"


def collapse_club_teams_for_draw(
    participants: list[dict],
    allowed_sizes: Sequence[int] = (3,),
) -> list[dict]:
    """Свернуть полные команды (размер из allowed_sizes) для жеребьёвки."""
    allowed = set(int(x) for x in allowed_sizes)
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
        n = len(members)
        if n not in allowed:
            # если почему-то больше — обрежем до максимального допустимого
            max_ok = max((s for s in allowed if s <= n), default=0)
            if max_ok == 0:
                continue
            members = members[:max_ok]
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


def collapse_kata_group_for_draw(participants: list[dict]) -> list[dict]:
    return collapse_club_teams_for_draw(participants, allowed_sizes=(3,))


def collapse_kumite_team_for_draw(participants: list[dict]) -> list[dict]:
    return collapse_club_teams_for_draw(participants, allowed_sizes=(3, 4))


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
