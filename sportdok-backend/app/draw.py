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


def split_subgroups(participants):
    """Two subgroups, as even as possible with any extra in group A (ТЗ
    5.3.8). Club-interleaved order first so alternating slots also spreads
    clubs across the two subgroups."""
    ordered = interleave_by_club(participants)
    return ordered[0::2], ordered[1::2]


def seed_kumite_group(participants, high_rank_threshold=HIGH_RANK_THRESHOLD):
    high = sorted(
        (p for p in participants if p.get("rank_sort_order") is not None and p["rank_sort_order"] <= high_rank_threshold),
        key=lambda p: p["rank_sort_order"]
    )
    high_ids = {p["registration_id"] for p in high}
    rest = interleave_by_club([p for p in participants if p["registration_id"] not in high_ids])

    ordered = high + rest
    for i, p in enumerate(ordered):
        p["seed"] = i + 1
    by_seed = {p["seed"]: p for p in ordered}

    n = len(ordered)
    bracket_size = next_power_of_two(n)
    pairs = round1_pairs_by_seed(bracket_size)

    def is_high(p):
        return p["registration_id"] in high_ids

    # Club separation only ever moves non-high-rank athletes: rank separation
    # takes priority on conflict (ТЗ 5.3.3 "сначала разводим по разряду, затем по клубу").
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

    ordered = sorted(by_seed.values(), key=lambda p: p["seed"])
    round1 = [
        {
            "seed_a": seed_a,
            "registration_id_a": (by_seed.get(seed_a) or {}).get("registration_id"),
            "seed_b": seed_b,
            "registration_id_b": (by_seed.get(seed_b) or {}).get("registration_id"),
            "bye": by_seed.get(seed_a) is None or by_seed.get(seed_b) is None
        }
        for seed_a, seed_b in pairs
    ]
    return ordered, round1


def build_category_draw(discipline, participants):
    """participants: list of dicts with registration_id, club_name, rank_sort_order.
    Mutates each dict in place, adding "seed" (and "subgroup" where applicable)."""
    n = len(participants)

    if discipline == "kata":
        return {"system": "kata_order", "participants": order_kata_group(participants)}

    if n == 3:
        matches = round_robin_pairs(participants)
        return {"system": "round_robin", "participants": participants, "matches": matches}

    if n >= 5:
        group_a, group_b = split_subgroups(participants)
        subgroups = []
        for idx, group in enumerate((group_a, group_b), start=1):
            ordered, round1 = seed_kumite_group(group)
            for p in ordered:
                p["subgroup"] = idx
            subgroups.append({"subgroup": idx, "participants": ordered, "round1": round1})
        return {"system": "single_elimination_repechage", "subgroups": subgroups}

    ordered, round1 = seed_kumite_group(participants)
    return {"system": "single_elimination_repechage", "subgroups": [{"subgroup": None, "participants": ordered, "round1": round1}]}
