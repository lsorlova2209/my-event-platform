# ТЗ 4.1 "Возрастная группа": определяется автоматически по дате рождения,
# 6 официальных групп. ТЗ перечисляет сами группы и границы, но не говорит,
# на какую дату считать возраст - здесь используется принятая в российском
# спорте практика "спортивного возраста" (год турнира минус год рождения),
# а не точный возраст на день турнира. Как и другие места в проекте, где ТЗ
# оставляет правило на усмотрение реализации (см. Приложение А), это
# предположение и подлежит подтверждению федерацией.
#
# Младшая группа (10-11, "мальчики/девочки") - только для дисциплины "ката"
# ("последняя - только для дисциплин со словом «ката»"); в кумитэ её нет.

def compute_age_group(birth_date, event_date, gender, discipline):
    if birth_date is None or event_date is None or gender not in ("male", "female"):
        return None

    sport_age = event_date.year - birth_date.year
    male = gender == "male"

    if sport_age < 10:
        return None
    if sport_age <= 11:
        if discipline != "kata":
            return None
        return "Мальчики 10-11" if male else "Девочки 10-11"
    if sport_age <= 13:
        return "Юноши 12-13" if male else "Девушки 12-13"
    if sport_age <= 15:
        return "Юноши 14-15" if male else "Девушки 14-15"
    if sport_age <= 17:
        return "Юниоры 16-17" if male else "Юниорки 16-17"
    if sport_age <= 20:
        return "Юниоры 18-20" if male else "Юниорки 18-20"
    return "Мужчины" if male else "Женщины"
