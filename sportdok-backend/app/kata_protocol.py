# Scoring rules per ТЗ §5.4 "Протокол ката" / "Шкала оценок ката по кругам".

ROUND_SCALES = {
    "round1": (5.0, 7.0),
    "round2": (6.0, 8.0),
    "final": (7.0, 9.0),
}


def validate_scores(round_label, scores):
    lo, hi = ROUND_SCALES[round_label]
    return len(scores) == 5 and all(lo <= s <= hi for s in scores)


def compute_total(scores):
    """Drops one lowest and one highest of the 5 judge scores, sums the
    remaining 3. Sorting + slicing (rather than filtering by value) keeps
    duplicate scores from being over-dropped."""
    ordered = sorted(scores)
    counted = ordered[1:-1]
    return round(sum(counted), 1), min(counted), max(counted)


def round1_cutoff(participant_count):
    # ТЗ only states ">20" and "<20" branches; treated here as >20 vs <=20.
    return 12 if participant_count > 20 else 8


def rank_participants(entries):
    """entries: [{registration_id, total, lowest_counted, highest_counted}, ...].
    Tie-break order per ТЗ: total, then lowest counted score, then highest
    counted score (all descending - higher is better)."""
    ordered = sorted(entries, key=lambda e: (-e["total"], -e["lowest_counted"], -e["highest_counted"]))
    ranked = []
    place = 0
    for i, e in enumerate(ordered):
        key = (e["total"], e["lowest_counted"], e["highest_counted"])
        prev_key = (ordered[i - 1]["total"], ordered[i - 1]["lowest_counted"], ordered[i - 1]["highest_counted"]) if i else None
        if i == 0 or key != prev_key:
            place = i + 1
        ranked.append({**e, "place": place})
    for e in ranked:
        e["tied"] = sum(1 for o in ranked if o["place"] == e["place"]) > 1
    return ranked


def determine_round_result(round_label, entries):
    """entries: [{registration_id, scores: [5 floats]}, ...].
    Returns {"ranked": [...], "cutoff": int|None, "tie_at_cutoff": bool}.
    tie_at_cutoff means the ТЗ's tie-break chain (total -> lowest counted ->
    highest counted) still can't separate who takes the last advancing
    spot - ТЗ calls for "дополнительное ката" (an extra kata performance)
    to resolve it; this isn't auto-resolved here."""
    scored = []
    for e in entries:
        total, low, high = compute_total(e["scores"])
        scored.append({"registration_id": e["registration_id"], "total": total, "lowest_counted": low, "highest_counted": high})
    ranked = rank_participants(scored)

    if round_label == "round1":
        cutoff = round1_cutoff(len(entries))
    elif round_label == "round2":
        cutoff = 4
    else:
        cutoff = None

    tie_at_cutoff = False
    if cutoff is not None and cutoff < len(ranked):
        boundary_place = ranked[cutoff - 1]["place"]
        tie_at_cutoff = ranked[cutoff]["place"] == boundary_place
        for e in ranked:
            e["advances"] = e["place"] <= cutoff

    return {"ranked": ranked, "cutoff": cutoff, "tie_at_cutoff": tie_at_cutoff}
