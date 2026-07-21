HIGH_RANK_THRESHOLD = 3  # Rank.sort_order <= 3 covers МСМК/МС/КМС/"1 разряд", per ТЗ 5.3.3


def next_power_of_two(n):
    p = 1
    while p < n:
        p *= 2
    return p


def seed_position_order(bracket_size):
    """positions[i] = seed number occupying bracket position (i+1). Standard
    recursive-mirroring seeding table (e.g. size 8 -> [1,8,4,5,2,7,3,6])."""
    positions = [1]
    while len(positions) < bracket_size:
        size = len(positions) * 2
        positions = [v for p in positions for v in (p, size + 1 - p)]
    return positions


def round1_pairs_by_seed(bracket_size):
    if bracket_size <= 1:
        return []
    order = seed_position_order(bracket_size)
    return [(order[i], order[i + 1]) for i in range(0, bracket_size, 2)]


def interleave_by_club(participants):
    """Round-robin participants across clubs so same-club entries spread out
    (ТЗ 5.3.5/5.3.6): once a smaller club's queue empties, the remaining
    larger club(s) fill consecutively."""
    queues = {}
    club_order = []
    for p in participants:
        club = p.get("club_name") or ""
        if club not in queues:
            queues[club] = []
            club_order.append(club)
        queues[club].append(p)
    result = []
    while any(queues[c] for c in club_order):
        for c in club_order:
            if queues[c]:
                result.append(queues[c].pop(0))
    return result


def order_kata_group(participants):
    ordered = interleave_by_club(participants)
    for i, p in enumerate(ordered):
        p["seed"] = i + 1
    return ordered


def round_robin_pairs(participants):
    for i, p in enumerate(participants):
        p["seed"] = i + 1
    return [
        {"registration_id_a": participants[i]["registration_id"], "registration_id_b": participants[j]["registration_id"]}
        for i in range(len(participants))
        for j in range(i + 1, len(participants))
    ]


def subgroup_for_draw_number(seed, participant_count):
    """Excel model (docs/samples): n>=5 splits into odd/even draw numbers."""
    if participant_count < 5 or seed is None:
        return None
    return 1 if seed % 2 == 1 else 2


def _initial_draw_order(participants, high_rank_threshold=HIGH_RANK_THRESHOLD):
    """Assign global draw numbers 1..N (№ жреб.) for the whole category."""
    high = sorted(
        (p for p in participants if p.get("rank_sort_order") is not None and p["rank_sort_order"] <= high_rank_threshold),
        key=lambda p: p["rank_sort_order"]
    )
    high_ids = {p["registration_id"] for p in high}
    rest = interleave_by_club([p for p in participants if p["registration_id"] not in high_ids])
    ordered = high + rest
    for i, p in enumerate(ordered):
        p["seed"] = i + 1
    return ordered, high_ids


def _separate_clubs_global(by_seed, n, high_ids):
    """Club separation for a single bracket (n < 5): seeds 1..n map to bracket positions."""
    bracket_size = next_power_of_two(n)
    pairs = round1_pairs_by_seed(bracket_size)

    def is_high(p):
        return p and p["registration_id"] in high_ids

    for seed_a, seed_b in pairs:
        p_a, p_b = by_seed.get(seed_a), by_seed.get(seed_b)
        if not p_a or not p_b or is_high(p_a) or is_high(p_b):
            continue
        if p_a.get("club_name") and p_a["club_name"] == p_b["club_name"]:
            for other_seed in range(seed_b + 1, n + 1):
                candidate = by_seed.get(other_seed)
                if candidate and not is_high(candidate) and candidate.get("club_name") != p_a.get("club_name"):
                    by_seed[seed_b], by_seed[other_seed] = candidate, p_b
                    candidate["seed"], p_b["seed"] = seed_b, other_seed
                    break


def _separate_clubs_subgroup(participants, high_ids):
    """Club separation within a subgroup using local bracket positions (Excel logic)."""
    sorted_p = sorted(participants, key=lambda p: p["seed"])
    n = len(sorted_p)
    by_local = {i + 1: p for i, p in enumerate(sorted_p)}
    bracket_size = next_power_of_two(n)
    pairs_local = round1_pairs_by_seed(bracket_size)

    def is_high(p):
        return p and p["registration_id"] in high_ids

    for la, lb in pairs_local:
        p_a, p_b = by_local.get(la), by_local.get(lb)
        if not p_a or not p_b or is_high(p_a) or is_high(p_b):
            continue
        if p_a.get("club_name") and p_a["club_name"] == p_b["club_name"]:
            for other_local in range(lb + 1, n + 1):
                candidate = by_local.get(other_local)
                if candidate and not is_high(candidate) and candidate.get("club_name") != p_a.get("club_name"):
                    p_b["seed"], candidate["seed"] = candidate["seed"], p_b["seed"]
                    by_local[lb], by_local[other_local] = candidate, p_b
                    break


def split_subgroups_by_draw_number(participants):
    """Excel: subgroup 1 = odd draw numbers, subgroup 2 = even draw numbers."""
    odds = sorted([p for p in participants if p["seed"] % 2 == 1], key=lambda p: p["seed"])
    evens = sorted([p for p in participants if p["seed"] % 2 == 0], key=lambda p: p["seed"])
    return odds, evens


def subgroup_round1(participants):
    """Round-1 pairings within a subgroup/bracket using local positions 1..k
    mapped to global draw numbers (matches federation Excel templates)."""
    sorted_p = sorted(participants, key=lambda p: p["seed"])
    n = len(sorted_p)
    by_local = {i + 1: p for i, p in enumerate(sorted_p)}
    bracket_size = next_power_of_two(n)
    pairs_local = round1_pairs_by_seed(bracket_size)
    round1 = [
        {
            "seed_a": (by_local.get(la) or {}).get("seed") or la,
            "registration_id_a": (by_local.get(la) or {}).get("registration_id"),
            "seed_b": (by_local.get(lb) or {}).get("seed") or lb,
            "registration_id_b": (by_local.get(lb) or {}).get("registration_id"),
            "bye": by_local.get(la) is None or by_local.get(lb) is None,
        }
        for la, lb in pairs_local
    ]
    return sorted_p, round1


def seed_kumite_group(participants, high_rank_threshold=HIGH_RANK_THRESHOLD):
    """Legacy helper kept for compatibility: single-group draw with global seeds."""
    ordered, high_ids = _initial_draw_order(participants, high_rank_threshold)
    by_seed = {p["seed"]: p for p in ordered}
    _separate_clubs_global(by_seed, len(ordered), high_ids)
    ordered = sorted(by_seed.values(), key=lambda p: p["seed"])
    return subgroup_round1(ordered)


def build_category_draw(discipline, participants):
    """participants: list of dicts with registration_id, club_name, rank_sort_order.
    Mutates each dict in place, adding "seed" (№ жреб., global 1..N) and "subgroup"."""
    n = len(participants)

    if discipline == "kata":
        return {"system": "kata_order", "participants": order_kata_group(participants)}

    if n == 3:
        matches = round_robin_pairs(participants)
        return {"system": "round_robin", "participants": participants, "matches": matches}

    ordered, high_ids = _initial_draw_order(participants)

    if n >= 5:
        group_a, group_b = split_subgroups_by_draw_number(ordered)
        subgroups = []
        for idx, group in enumerate((group_a, group_b), start=1):
            _separate_clubs_subgroup(group, high_ids)
            for p in group:
                p["subgroup"] = idx
            ordered_sub, round1 = subgroup_round1(group)
            subgroups.append({"subgroup": idx, "participants": ordered_sub, "round1": round1})
        flat = [p for sub in subgroups for p in sub["participants"]]
        return {"system": "single_elimination_repechage", "subgroups": subgroups, "participants": flat}

    by_seed = {p["seed"]: p for p in ordered}
    _separate_clubs_global(by_seed, n, high_ids)
    ordered = sorted(by_seed.values(), key=lambda p: p["seed"])
    for p in ordered:
        p["subgroup"] = None
    _, round1 = subgroup_round1(ordered)
    return {
        "system": "single_elimination_repechage",
        "subgroups": [{"subgroup": None, "participants": ordered, "round1": round1}],
        "participants": ordered,
    }
