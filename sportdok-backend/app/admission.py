"""Мандатный и весовой допуск заявок."""
from typing import Optional

NO_WEIGH_CATEGORIES = {
    "абсолютная категория",
    "двоеборье",
    "командные соревнования",
}

KUMITE_DISCIPLINES = {"kumite_ok", "kumite_pk", "kumite_sz"}


def weigh_required(discipline: str, category_name: Optional[str]) -> bool:
    if discipline == "kata":
        return False
    name = (category_name or "").strip().lower()
    if name in NO_WEIGH_CATEGORIES:
        return False
    return discipline in KUMITE_DISCIPLINES


def default_weigh_status(discipline: str, category_name: Optional[str]) -> Optional[str]:
    return None if weigh_required(discipline, category_name) else "not_required"


def is_registration_draw_ready(reg) -> bool:
    mandate = getattr(reg, "mandate_status", None)
    if mandate is None:
        mandate = getattr(reg, "admission_status", None)
    weigh = getattr(reg, "weigh_status", None)
    if weigh is None and not weigh_required(reg.discipline, reg.category_name):
        weigh = "not_required"
    return mandate == "approved" and weigh in ("approved", "not_required")


def registration_readiness(reg) -> dict:
    mandate = getattr(reg, "mandate_status", None)
    if mandate is None:
        mandate = getattr(reg, "admission_status", None)
    weigh = getattr(reg, "weigh_status", None)
    required = weigh_required(reg.discipline, reg.category_name)
    if weigh is None and not required:
        weigh = "not_required"
    mandate_ok = mandate == "approved"
    weigh_ok = weigh in ("approved", "not_required")
    return {
        "mandate_ok": mandate_ok,
        "weigh_ok": weigh_ok,
        "draw_ready": mandate_ok and weigh_ok,
        "weigh_required": required,
    }
