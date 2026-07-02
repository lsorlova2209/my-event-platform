# Win-condition thresholds per ТЗ §5.4 "Правила завершения боя (кумитэ ОК)".
# Flagged in the spec itself (⚠, Приложение А п.6) as unconfirmed by ФВКР —
# the атанай/мубоби/дзёгай violation system and these thresholds were not
# found in official Минспорт rules. Applied here exactly as specified,
# pending federation confirmation. Only "кумитэ ОК" has an early-stop rule
# in the ТЗ; ПК/СЗ are explicitly left TBD there, so those disciplines
# always fall back to score-at-time-up ("score").

HANSOKU_LEVEL = 3


def points(waza_ari, ippon):
    return waza_ari + ippon * 2


def is_abs_category(category_name):
    return (category_name or "").strip() == "абсолютная категория"


def is_multiple_of_five(category_name):
    digits = "".join(ch for ch in (category_name or "") if ch.isdigit())
    return bool(digits) and int(digits) % 5 == 0


def hansoku_side(lines_a, lines_b):
    if any(level >= HANSOKU_LEVEL for level in lines_a):
        return "a"
    if any(level >= HANSOKU_LEVEL for level in lines_b):
        return "b"
    return None


def determine_winner(discipline, category_name, waza_ari_a, ippon_a, lines_a, waza_ari_b, ippon_b, lines_b):
    """Returns (winner: "a" | "b" | None, method: "hansoku" | "ippon" | "waza_ari" | "score" | "undecided")."""
    dq = hansoku_side(lines_a, lines_b)
    if dq == "a":
        return "b", "hansoku"
    if dq == "b":
        return "a", "hansoku"

    points_a, points_b = points(waza_ari_a, ippon_a), points(waza_ari_b, ippon_b)

    if discipline == "kumite_ok":
        if is_abs_category(category_name):
            ippon_threshold, waza_ari_threshold = 1, 2
        elif is_multiple_of_five(category_name):
            ippon_threshold, waza_ari_threshold = 3, 6
        else:
            ippon_threshold = waza_ari_threshold = None

        if ippon_threshold is not None:
            a_by_ippon, b_by_ippon = ippon_a >= ippon_threshold, ippon_b >= ippon_threshold
            if a_by_ippon and not b_by_ippon:
                return "a", "ippon"
            if b_by_ippon and not a_by_ippon:
                return "b", "ippon"

            a_by_waza, b_by_waza = waza_ari_a >= waza_ari_threshold, waza_ari_b >= waza_ari_threshold
            if a_by_waza and not b_by_waza:
                return "a", "waza_ari"
            if b_by_waza and not a_by_waza:
                return "b", "waza_ari"

    if points_a > points_b:
        return "a", "score"
    if points_b > points_a:
        return "b", "score"
    return None, "undecided"
