# Документы на проверку юристу

Файл собирается командой `npm run legal-review` в папке `web` из самих
шаблонов, поэтому не может с ними разойтись. Руками его не правят.

## Что именно нужно проверить

1. **Ссылку на статью закона.** В ваших приказах она стоит первой строкой
   под темой: «В соответствии со статьей 34 Трудового Кодекса РК от 23 ноября
   2015 г. № 414-V». Там, где ниже написано «ссылки нет», её нужно дать –
   реквизиты норм права не выдумываются.
2. **Казахские падежные окончания после дат, чисел и ФИО.** В ваших же
   приказах для разных дат стоят разные окончания («23.06.2026-нан»,
   «04.09.2026-дан», «02.07.2026-ті»), и выбрать их программно нельзя.
   Где мог, я обошёлся оборотами без окончания.
3. **Формулировки распоряжений** в казахской колонке: «жіберілсін»,
   «ауыстырылсын», «белгіленсін», «бұзылсын», «көтермеленсін»,
   «қолданылсын» – сделаны по образцу ваших «қабылдансын» и «тағайындалсын».
4. **Значения выпадающих списков** – основание расторжения, вид взыскания,
   вид поощрения – пока идут по-русски во всех трёх колонках: своих полей
   под перевод у них нет.

`{поле}` – подстановка: система сама поставит туда ФИО, дату или сумму.

Документов: **75**.

---

## Приказ о приёме на работу

Раздел: Отдел кадров. Идентификатор: `hr-hire-order`. Языки: kk, ru, en.

**Источник текста:** ваш файл, взят буквой в букву.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Жұмысқа қабылдау туралы»
- **Қазақша.** ҚР Еңбек Кодексінің 2015 жылғы 23 қарашадағы № 414-V ҚРЗ 34-бабына сәйкес
- **Русский.** «О приеме на работу»
- **Русский.** В соответствии со статьей 34 Трудового Кодекса РК от 23 ноября 2015 г. № 414-V
- **English.** “Employment order”
- **English.** In accordance with Article 34 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V

### Распоряжение

**Қазақша**

- {employee:nom}, {contractDate} жылғы № {contractNumber} еңбек шартына сәйкес {startDate} бастап «{position}» ретінде қабылдансын.

**Русский**

- Принять {employee} в качестве «{position}» с {startDate} в соответствии с Трудовым Договором № {contractNumber} от {contractDate} года.

**English**

- To accept {employee} as a “{position}” from {startDate}, in accordance with the Labor Contract No. {contractNumber} dated {contractDate}.

**Қазақша**

- Негіз: {contractDate} жылғы № {contractNumber} Еңбек шарты.

**Русский**

- Основание: Трудовой договор № {contractNumber} от {contractDate} года.

**English**

- Basis: Employment contract No. {contractNumber} dated {contractDate}.

---

## Приказ о предоставлении ежегодного трудового отпуска

Раздел: Отдел кадров. Идентификатор: `hr-vacation-order`. Языки: kk, ru, en.

**Источник текста:** ваш файл, взят буквой в букву.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Жыл сайынғы еңбек демалысын беру туралы»
- **Қазақша.** ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 87-бабының 2-тармағына сәйкес.
- **Русский.** «О предоставлении ежегодного трудового отпуска»
- **Русский.** В соответствии с пунктом 2 статьи 87 Трудового Кодекса РК от 23 ноября 2015 года №414-V.
- **English.** “On annual vacation leave”
- **English.** In accordance with paragraph 2 of Article 87 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.

### Распоряжение

**Қазақша**

- 1. {employee} {position} {from} бастап {to} қоса алғанда, {workedFrom} – {workedTo} жұмыс кезеңі үшін ұзақтығы {days} ({daysWords}) күнтізбелік күн жыл сайынғы ақылы еңбек демалысын беру.
- 2. Бухгалтерия Қазақстан Республикасының қолданыстағы заңнамасында белгіленген мерзімде және тәртіппен жұмыс істеген кезеңі үшін демалыс күндерін есептесін.
- 3. Негіздеме: {applicationDate} жылғы {employee:nom}ның жеке мәлімдемесі.

**Русский**

- 1. Предоставить ежегодный оплачиваемый трудовой отпуск {position} {employee} продолжительностью {days} ({daysWords}) календарных дней с {from} по {to} включительно, за период работы с {workedFrom} по {workedTo}.
- 2. Бухгалтерии рассчитать отпускные дни за отработанный период работы в срок и в порядке, установленные действующим законодательством Республики Казахстан.
- 3. Основание: личное заявление {employee} от {applicationDate} года.

**English**

- 1. To provide paid annual leave to the {position} {employee}, for the duration of {days} ({daysWords}) calendar days from {from} to {to} inclusive, for the worked period from {workedFrom} till {workedTo}.
- 2. To Accountant Department – to perform payment for the worked period within the time and according to the procedure stated by the current legislation of the Republic of Kazakhstan.
- 3. Basis: personal statement of {employee} dated {applicationDate}.

---

## Приказ о предоставлении отпуска без сохранения заработной платы

Раздел: Отдел кадров. Идентификатор: `hr-unpaid-leave-order`. Языки: kk, ru, en.

**Источник текста:** ваш файл, взят буквой в букву.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Жалақысы сақталмайтын демалысын беру туралы»
- **Қазақша.** Қазақстан Республикасының 2015 жылғы 23 қарашадағы № 414-V Еңбек кодексінің 87-бабының 5-тармағының 1-тармақшасына сәйкес.
- **Русский.** «О предоставлении отпуска без сохранения заработной платы»
- **Русский.** В соответствии с подпунктом 1, пункта 5 статьи 87 Трудового Кодекса РК от 23 ноября 2015 года №414-V.
- **English.** “On granting unpaid leave”
- **English.** In accordance with subparagraph 1, paragraph 5 of Article 87 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.

### Распоряжение

**Қазақша**

- 1. {position} {employee} {from} бастап {days} ({daysWords}) күнтізбелік күн мерзімге ақысыз демалыс беру.
- Негіздеме: {employee:nom}ның {applicationDate} жылғы жеке өтініші.

**Русский**

- 1. Предоставить отпуск без сохранения заработной платы {position} {employee} с {from} сроком на {days} ({daysWords}) календарный день.
- Основание: личное заявление {employee} от {applicationDate} года.

**English**

- 1. To grant unpaid leave to the {position} {employee} from {from}, for a period of {days} ({daysWords}) calendar day(s).
- Basis: Personal request of {employee} dated {applicationDate}.

---

## Приказ о назначении директора

Раздел: Корпоративное управление. Идентификатор: `corporate-director-appointment`. Языки: kk, ru, en.

**Источник текста:** ваш файл, взят буквой в букву.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Директорды тағайындау туралы»
- **Қазақша.** {@company.legalNameKk} қатысушыларының {decisionDate} шешіміне сәйкес.
- **Русский.** «О назначении Директора»
- **Русский.** На основании решения участников {@company.name} от {decisionDate} года.
- **English.** “On the appointment of the Director”
- **English.** Based on the decision of the participants of {@company.legalNameEn} dated {decisionDate}.

### Распоряжение

**Қазақша**

- {employee:nom} {startDate} бастап «{position}» лауазымына барлық коммерциялық, бухгалтерлік және банктік құжаттарға бірінші қол қою құқығымен тағайындалсын.

**Русский**

- Назначить {employee} на должность «{position}» с {startDate} с правом первой подписи на всех коммерческих, бухгалтерских и банковских документах.

**English**

- To appoint {employee} to the position of “{position}” from {startDate}, with the right of first signature on all commercial, accounting and banking documents.

---

## Доверенность

Раздел: Юридический отдел. Идентификатор: `legal-power-single`. Языки: ru, en.

**Источник текста:** ваш файл, взят буквой в букву.

Доверенность: выходит на русском и английском, казахской колонки нет.

---

## Приказ о направлении в командировку

Раздел: Отдел кадров. Идентификатор: `hr-trip-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Іссапарға жіберу туралы»
- **Қазақша.** ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 127-бабына сәйкес.
- **Русский.** «О направлении в командировку»
- **Русский.** В соответствии со статьей 127 Трудового Кодекса РК от 23 ноября 2015 года №414-V.
- **English.** “On business trip assignment”
- **English.** In accordance with Article 127 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.

### Распоряжение

**Қазақша**

- 1. {employee:nom} {position} {from} бастап {to} қоса алғанда {days} ({daysWords}) күнтізбелік күн мерзімге {city} қаласына, {organization}, іссапарға жіберілсін.
- 2. Іссапардың мақсаты: {purpose}.
- 3. Бухгалтерия іссапар шығыстарына аванс шығу күніне дейін берсін.
- 4. Қызметкер оралғаннан кейін белгіленген мерзімде аванстық есеп тапсырсын.
- Негіздеме: бөлім басшысының қызметтік жазбасы.

**Русский**

- 1. Направить {employee}, {position}, в командировку в г. {city}, {organization}, сроком на {days} ({daysWords}) календарных дней с {from} по {to}.
- 2. Цель командировки: {purpose}.
- 3. Бухгалтерии выдать аванс на командировочные расходы до даты выезда.
- 4. Работнику представить авансовый отчёт в установленный срок после возвращения.
- Основание: служебная записка руководителя подразделения.

**English**

- 1. To send {employee}, {position}, on a business trip to {city}, {organization}, for {days} ({daysWords}) calendar days from {from} to {to}.
- 2. Purpose of the trip: {purpose}.
- 3. To Accountant Department – to issue an advance for travel expenses before the departure date.
- 4. The employee shall submit an expense report within the established period after return.
- Basis: memorandum of the head of the department.

---

## Приказ о переводе на другую должность

Раздел: Отдел кадров. Идентификатор: `hr-transfer-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Басқа лауазымға ауыстыру туралы»
- **Қазақша.** ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 45-бабына сәйкес.
- **Русский.** «О переводе на другую должность»
- **Русский.** В соответствии со статьей 45 Трудового Кодекса РК от 23 ноября 2015 года №414-V.
- **English.** “On transfer to another position”
- **English.** In accordance with Article 45 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.

### Распоряжение

**Қазақша**

- 1. {employee:nom} {transferDate} бастап «{positionFrom}» лауазымынан «{position}» лауазымына «{unit}» бөліміне ауыстырылсын.
- 2. Ауыстырылған күннен бастап айына {salary} теңге лауазымдық жалақы белгіленсін.
- 3. Кадр бөлімі ауыстыру туралы жазбаны еңбек кітапшасына және жеке карточкасына енгізсін, бухгалтерия жаңа жалақы бойынша есептесін.
- Негіздеме: {agreementDate} жылғы № {agreementNumber} еңбек шартына қосымша келісім.

**Русский**

- 1. Перевести {employee} с должности «{positionFrom}» на должность «{position}» в подразделение «{unit}» с {transferDate}.
- 2. Установить должностной оклад в размере {salary} тенге в месяц с даты перевода.
- 3. Отделу кадров внести запись о переводе в трудовую книжку и личную карточку работника, бухгалтерии – производить начисление по новому окладу.
- Основание: дополнительное соглашение к трудовому договору от {agreementDate} № {agreementNumber}.

**English**

- 1. To transfer {employee} from the position of “{positionFrom}” to the position of “{position}” in the “{unit}” unit from {transferDate}.
- 2. To set the official salary of {salary} tenge per month from the date of transfer.
- 3. To HR Department – to enter the transfer record in the employment record book and the personal card of the employee; to Accountant Department – to calculate payments at the new salary.
- Basis: supplementary agreement to the employment contract dated {agreementDate} No. {agreementNumber}.

---

## Приказ об изменении оклада

Раздел: Отдел кадров. Идентификатор: `hr-salary-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Лауазымдық жалақыны өзгерту туралы»
- **Қазақша.** ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 46-бабына сәйкес.
- **Русский.** «Об изменении должностного оклада»
- **Русский.** В соответствии со статьей 46 Трудового Кодекса РК от 23 ноября 2015 года №414-V.
- **English.** “On change of the official salary”
- **English.** In accordance with Article 46 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.

### Распоряжение

**Қазақша**

- 1. {employee:nom} {position} {fromDate} бастап айына {salary} теңге лауазымдық жалақы белгіленсін.
- 2. Бухгалтерия осы бұйрықты ескере отырып жалақы есептесін.
- 3. Кадр бөлімі штат кестесіне және қызметкердің жеке карточкасына өзгеріс енгізсін.
- Негіздеме: {agreementDate} жылғы № {agreementNumber} еңбек шартына қосымша келісім.

**Русский**

- 1. Установить {employee}, {position}, должностной оклад в размере {salary} тенге в месяц с {fromDate}.
- 2. Бухгалтерии производить начисление заработной платы с учётом настоящего приказа.
- 3. Отделу кадров внести изменение в штатное расписание и личную карточку работника.
- Основание: дополнительное соглашение к трудовому договору от {agreementDate} № {agreementNumber}.

**English**

- 1. To set for {employee}, {position}, the official salary of {salary} tenge per month from {fromDate}.
- 2. To Accountant Department – to calculate wages taking this order into account.
- 3. To HR Department – to amend the staffing table and the personal card of the employee.
- Basis: supplementary agreement to the employment contract dated {agreementDate} No. {agreementNumber}.

---

## Приказ о расторжении трудового договора

Раздел: Отдел кадров. Идентификатор: `hr-dismissal-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Еңбек шартын бұзу туралы»
- **Қазақша.** ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің {reason}-бабына сәйкес.
- **Русский.** «О расторжении трудового договора»
- **Русский.** В соответствии со статьей {reason} Трудового Кодекса РК от 23 ноября 2015 года №414-V.
- **English.** “On termination of the employment contract”
- **English.** In accordance with Article {reason} of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.

### Распоряжение

**Қазақша**

- 1. «{unit}» бөлімінің {position} {employee:nom} ({reason}) еңбек шарты бұзылсын. Соңғы жұмыс күні – {dismissDate}.
- 2. Бухгалтерия пайдаланылмаған еңбек демалысының {compensationDays} күнтізбелік күні үшін өтемақыны қоса, түпкілікті есеп айырылсын.
- 3. Кадр бөлімі жұмыстан шығарылған күні қызметкерге еңбек кітапшасын және жалақы туралы анықтаманы берсін.
- Негіздеме: {contractDate} жылғы № {contractNumber} еңбек шарты.

**Русский**

- 1. Расторгнуть трудовой договор с {employee}, {position} подразделения «{unit}», {reason}. Последний рабочий день – {dismissDate}.
- 2. Бухгалтерии произвести окончательный расчёт, включая компенсацию за {compensationDays} календарных дней неиспользованного трудового отпуска.
- 3. Отделу кадров выдать работнику трудовую книжку и справку о заработной плате в день увольнения.
- Основание: трудовой договор от {contractDate} № {contractNumber}.

**English**

- 1. To terminate the employment contract with {employee}, {position} of the “{unit}” unit, {reason}. The last working day is {dismissDate}.
- 2. To Accountant Department – to make the final settlement, including {compensationDays} calendar days of compensation for the unused labour leave.
- 3. To HR Department – to hand the employee the employment record book and the salary certificate on the day of dismissal.
- Basis: employment contract dated {contractDate} No. {contractNumber}.

---

## Приказ об отзыве из отпуска

Раздел: Отдел кадров. Идентификатор: `hr-vacation-recall-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Еңбек демалысынан кері шақыру туралы»
- **Русский.** «Об отзыве из трудового отпуска»
- **English.** “On recall from labour leave”

### Распоряжение

**Қазақша**

- 1. {employee:nom} {position} {recallDate} бастап жыл сайынғы ақылы еңбек демалысынан кері шақырылсын. Себебі: {reason}.
- 2. Демалыстың пайдаланылмаған {remainingDays} ({remainingDaysWords}) күнтізбелік күні қызметкермен келісілген мерзімде берілсін.
- 3. Бухгалтерия демалыс ақысын қайта есептесін.
- Негіздеме: қызметкердің {consentDate} жылғы жазбаша келісімі.

**Русский**

- 1. Отозвать {employee}, {position}, из ежегодного оплачиваемого трудового отпуска с {recallDate}. Причина: {reason}.
- 2. Неиспользованную часть отпуска продолжительностью {remainingDays} ({remainingDaysWords}) календарных дней предоставить в согласованный с работником срок.
- 3. Бухгалтерии произвести перерасчёт отпускных выплат.
- Основание: письменное согласие работника от {consentDate}.

**English**

- 1. To recall {employee}, {position}, from the annual paid labour leave from {recallDate}. Reason: {reason}.
- 2. The unused part of the leave of {remainingDays} ({remainingDaysWords}) calendar days shall be granted at a time agreed with the employee.
- 3. To Accountant Department – to recalculate the leave payments.
- Basis: written consent of the employee dated {consentDate}.

---

## Приказ о поощрении (премировании)

Раздел: Отдел кадров. Идентификатор: `hr-bonus-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Қызметкерді көтермелеу туралы»
- **Русский.** «О поощрении работника»
- **English.** “On the incentive award to the employee”

### Распоряжение

**Қазақша**

- 1. {position} {employee:nom} көтермеленсін. Көтермелеу түрі: {kind}. Себебі: {reason}.
- 2. Бухгалтерия {amount} теңге сыйақыны ең жақын жалақы төлемімен бірге төлесін.
- 3. Кадр бөлімі көтермелеу туралы мәліметті қызметкердің жеке карточкасына енгізсін.
- Негіздеме: бөлім басшысының {memoDate} жылғы ұсынысы.

**Русский**

- 1. Поощрить {employee}, {position}. Вид поощрения: {kind}. За {reason}.
- 2. Бухгалтерии выплатить премию в размере {amount} тенге в ближайшую выплату заработной платы.
- 3. Отделу кадров внести сведения о поощрении в личную карточку работника.
- Основание: представление руководителя подразделения от {memoDate}.

**English**

- 1. To award {employee}, {position}. Type of award: {kind}. For {reason}.
- 2. To Accountant Department – to pay the bonus of {amount} tenge together with the nearest salary payment.
- 3. To HR Department – to enter the award record in the personal card of the employee.
- Basis: proposal of the head of the department dated {memoDate}.

---

## Приказ о применении дисциплинарного взыскания

Раздел: Отдел кадров. Идентификатор: `hr-discipline-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** «Тәртіптік жаза қолдану туралы»
- **Қазақша.** ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 64-бабына сәйкес.
- **Русский.** «О применении дисциплинарного взыскания»
- **Русский.** В соответствии со статьей 64 Трудового Кодекса РК от 23 ноября 2015 года №414-V.
- **English.** “On imposing a disciplinary sanction”
- **English.** In accordance with Article 64 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.

### Распоряжение

**Қазақша**

- 1. {position} {employee:nom} {violationDate} жіберген тәртіп бұзушылығы үшін «{penalty}» түріндегі тәртіптік жаза қолданылсын: {violation}.
- 2. Кадр бөлімі қызметкерді осы бұйрықпен қол қойғыза отырып таныстырсын және бұйрықты жеке іс материалдарына тіркесін.
- Негіздеме: қызметкердің {explanationDate} жылғы түсініктемесі, № {actNumber} акт.

**Русский**

- 1. Применить к {employee}, {position}, дисциплинарное взыскание в виде «{penalty}» за нарушение, допущенное {violationDate}: {violation}.
- 2. Отделу кадров ознакомить работника с настоящим приказом под подпись и приобщить приказ к материалам личного дела.
- Основание: объяснительная работника от {explanationDate}, акт № {actNumber}.

**English**

- 1. To impose on {employee}, {position}, a disciplinary sanction in the form of “{penalty}” for the violation committed on {violationDate}: {violation}.
- 2. To HR Department – to acquaint the employee with this order against signature and to attach the order to the personal file.
- Basis: explanatory note of the employee dated {explanationDate}, act No. {actNumber}.

---

## Справка с места работы

Раздел: Отдел кадров. Идентификатор: `hr-work-certificate`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона:** есть, проверить.

### Тема приказа

- **Қазақша.** {employee:nom} {@company.legalNameKk} ұйымында «{unit}» бөлімінде «{position}» лауазымында {startDate} бастап осы уақытқа дейін жұмыс істейтіні туралы осы анықтама берілді.
- **Қазақша.** Анықтама {destination} үшін берілді.
- **Русский.** Настоящая справка выдана в том, что {employee:nom} работает в организации {@company.legalName} в должности «{position}» в подразделении «{unit}» с {startDate} по настоящее время.
- **Русский.** Справка выдана для предъявления: {destination}.
- **English.** This certificate is issued to confirm that {employee} works at {@company.legalNameEn} in the position of “{position}” in the “{unit}” unit from {startDate} to the present time.
- **English.** The certificate is issued for submission to: {destination}.

### Распоряжение

---

## Приказ об утверждении штатного расписания

Раздел: Отдел кадров. Идентификатор: `hr-staffing-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Штат кестесін бекіту туралы»
- **Русский.** «Об утверждении штатного расписания»
- **English.** “On approval of the staffing table”

### Распоряжение

**Қазақша**

- 1. {headcount} штат бірлігі және айлық еңбекақы қоры {payroll} теңге болатын штат кестесі бекітілсін және {effectiveDate} бастап қолданысқа енгізілсін.
- 2. Кадр бөлімі бөлім басшыларын осы бұйрықпен таныстырсын.
- 3. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.
- Негіздеме: осы бұйрыққа № 1 қосымша.

**Русский**

- 1. Утвердить штатное расписание в количестве {headcount} штатных единиц с месячным фондом оплаты труда {payroll} тенге и ввести его в действие с {effectiveDate}.
- 2. Отделу кадров ознакомить руководителей подразделений с настоящим приказом.
- 3. Контроль за исполнением настоящего приказа оставляю за собой.
- Основание: приложение № 1 к настоящему приказу.

**English**

- 1. To approve the staffing table of {headcount} staff units with a monthly payroll of {payroll} tenge and to put it into effect from {effectiveDate}.
- 2. To HR Department – to acquaint the heads of departments with this order.
- 3. I reserve the control over the execution of this order.
- Basis: Annex No. 1 to this order.

---

## Приказ об утверждении графика отпусков

Раздел: Отдел кадров. Идентификатор: `hr-vacation-schedule-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Демалыс кестесін бекіту туралы»
- **Русский.** «Об утверждении графика отпусков»
- **English.** “On approval of the leave schedule”

### Распоряжение

**Қазақша**

- 1. {year} жылға арналған қызметкерлердің жыл сайынғы ақылы еңбек демалыстарының кестесі бекітілсін.
- 2. Кадр бөлімі қызметкерлерді кестемен {noticeDate} мерзіміне дейін қол қойғыза отырып таныстырсын.
- 3. Бөлім басшылары кестенің сақталуын қамтамасыз етсін.
- Негіздеме: осы бұйрыққа № 1 қосымша.

**Русский**

- 1. Утвердить график ежегодных оплачиваемых трудовых отпусков работников на {year} год.
- 2. Отделу кадров ознакомить работников с графиком под подпись в срок до {noticeDate}.
- 3. Руководителям подразделений обеспечить соблюдение графика.
- Основание: приложение № 1 к настоящему приказу.

**English**

- 1. To approve the schedule of annual paid labour leaves of the employees for {year}.
- 2. To HR Department – to acquaint the employees with the schedule against signature by {noticeDate}.
- 3. To the heads of departments – to ensure that the schedule is observed.
- Basis: Annex No. 1 to this order.

---

## Приказ о проведении аттестации работников

Раздел: Отдел кадров. Идентификатор: `hr-attestation-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Қызметкерлерді аттестаттауды өткізу туралы»
- **Русский.** «О проведении аттестации работников»
- **English.** “On conducting the certification of employees”

### Распоряжение

**Қазақша**

- 1. «{unit}» бөлімінің қызметкерлерін аттестаттау {from} бастап {to} аралығында өткізілсін.
- 2. Аттестаттау комиссиясының төрағасы болып {employee:nom} тағайындалсын. Комиссия мүшелері: {members}.
- 3. Кадр бөлімі қызметкерлерді осы бұйрықпен таныстырсын.
- 4. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.

**Русский**

- 1. Провести аттестацию работников подразделения «{unit}» в период с {from} по {to}.
- 2. Назначить председателем аттестационной комиссии {employee}. Члены комиссии: {members}.
- 3. Отделу кадров ознакомить работников с настоящим приказом.
- 4. Контроль за исполнением настоящего приказа оставляю за собой.

**English**

- 1. To conduct the certification of the employees of the “{unit}” unit from {from} to {to}.
- 2. To appoint {employee} as the chairperson of the certification commission. Members: {members}.
- 3. To HR Department – to acquaint the employees with this order.
- 4. I reserve the control over the execution of this order.

---

## Приказ об отзыве доверенности

Раздел: Юридический отдел. Идентификатор: `legal-power-revoke-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Сенімхатты кері қайтарып алу туралы»
- **Русский.** «Об отзыве доверенности»
- **English.** “On revocation of the power of attorney”

### Распоряжение

**Қазақша**

- 1. {employee:nom} атына {powerDate} жылғы № {powerNumber} берілген сенімхаттың күші {revokeDate} бастап жойылсын.
- 2. Заңгер сенімхаттың кері қайтарып алынғаны туралы мүдделі тұлғаларды хабардар етсін.
- 3. Сенімхаттың түпнұсқасы қайтарылсын.
- 4. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.

**Русский**

- 1. Отозвать с {revokeDate} доверенность № {powerNumber} от {powerDate}, выданную на имя {employee}.
- 2. Юристу уведомить заинтересованных лиц об отзыве доверенности.
- 3. Обеспечить возврат оригинала доверенности.
- 4. Контроль за исполнением настоящего приказа оставляю за собой.

**English**

- 1. To revoke from {revokeDate} the power of attorney No. {powerNumber} dated {powerDate}, issued in the name of {employee}.
- 2. To the lawyer – to notify the interested parties of the revocation.
- 3. To ensure the return of the original power of attorney.
- 4. I reserve the control over the execution of this order.

---

## Приказ о создании комиссии

Раздел: Корпоративное управление. Идентификатор: `corporate-commission-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Комиссия құру туралы»
- **Русский.** «О создании комиссии»
- **English.** “On establishing a commission”

### Распоряжение

**Қазақша**

- 1. {subject} комиссиясы құрылсын.
- 2. Комиссия төрағасы болып {employee:nom} тағайындалсын. Комиссия мүшелері: {members}.
- 3. Комиссия жұмысының нәтижелерін {reportDate} мерзіміне дейін ұсынсын.
- 4. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.

**Русский**

- 1. Создать комиссию {subject}.
- 2. Назначить председателем комиссии {employee}. Члены комиссии: {members}.
- 3. Комиссии представить результаты работы в срок до {reportDate}.
- 4. Контроль за исполнением настоящего приказа оставляю за собой.

**English**

- 1. To establish a commission {subject}.
- 2. To appoint {employee} as the chairperson of the commission. Members: {members}.
- 3. The commission shall submit the results of its work by {reportDate}.
- 4. I reserve the control over the execution of this order.

---

## Приказ о праве подписи документов

Раздел: Корпоративное управление. Идентификатор: `corporate-signature-right-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Құжаттарға қол қою құқығы туралы»
- **Русский.** «О праве подписи документов»
- **English.** “On the right to sign documents”

### Распоряжение

**Қазақша**

- 1. {employee:nom}, {position}, {fromDate} бастап {untilDate} аралығында мынадай құжаттарға қол қою құқығы берілсін: {scope}.
- 2. Қол қою үлгісі осы бұйрыққа қоса беріледі.
- 3. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.

**Русский**

- 1. Предоставить {employee}, {position}, право подписи следующих документов: {scope}, в период с {fromDate} по {untilDate}.
- 2. Образец подписи прилагается к настоящему приказу.
- 3. Контроль за исполнением настоящего приказа оставляю за собой.

**English**

- 1. To grant {employee}, {position}, the right to sign the following documents: {scope}, from {fromDate} to {untilDate}.
- 2. The specimen signature is attached to this order.
- 3. I reserve the control over the execution of this order.

---

## Приказ об учётной политике

Раздел: Финансы и бухгалтерия. Идентификатор: `finance-accounting-policy-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Есеп саясатын бекіту туралы»
- **Русский.** «Об утверждении учётной политики»
- **English.** “On approval of the accounting policy”

### Распоряжение

**Қазақша**

- 1. {year} жылға арналған есеп саясаты бекітілсін және {effectiveDate} бастап қолданысқа енгізілсін.
- 2. Бас бухгалтер есеп саясатының сақталуын қамтамасыз етсін.
- 3. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.
- Негіздеме: осы бұйрыққа № 1 қосымша.

**Русский**

- 1. Утвердить учётную политику на {year} год и ввести её в действие с {effectiveDate}.
- 2. Главному бухгалтеру обеспечить соблюдение учётной политики.
- 3. Контроль за исполнением настоящего приказа оставляю за собой.
- Основание: приложение № 1 к настоящему приказу.

**English**

- 1. To approve the accounting policy for {year} and to put it into effect from {effectiveDate}.
- 2. To the chief accountant – to ensure that the accounting policy is observed.
- 3. I reserve the control over the execution of this order.
- Basis: Annex No. 1 to this order.

---

## Приказ о проведении инвентаризации

Раздел: Финансы и бухгалтерия. Идентификатор: `finance-inventory-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Түгендеу жүргізу туралы»
- **Русский.** «О проведении инвентаризации»
- **English.** “On conducting an inventory count”

### Распоряжение

**Қазақша**

- 1. {scope} түгендеуі {from} бастап {to} аралығында жүргізілсін.
- 2. Түгендеу комиссиясының төрағасы болып {employee:nom} тағайындалсын. Комиссия мүшелері: {members}.
- 3. Комиссия түгендеу нәтижелері бойынша акт жасасын.
- 4. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.

**Русский**

- 1. Провести инвентаризацию {scope} в период с {from} по {to}.
- 2. Назначить председателем инвентаризационной комиссии {employee}. Члены комиссии: {members}.
- 3. Комиссии составить акт по результатам инвентаризации.
- 4. Контроль за исполнением настоящего приказа оставляю за собой.

**English**

- 1. To conduct an inventory count of {scope} from {from} to {to}.
- 2. To appoint {employee} as the chairperson of the inventory commission. Members: {members}.
- 3. The commission shall draw up an act on the results of the count.
- 4. I reserve the control over the execution of this order.

---

## Приказ об открытии проекта

Раздел: Проекты. Идентификатор: `projects-open-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Жобаны ашу туралы»
- **Русский.** «Об открытии проекта»
- **English.** “On the opening of the project”

### Распоряжение

**Қазақша**

- 1. «{project}» жобасы {from} бастап {to} аралығында ашылсын. Жоба бюджеті – {budget} теңге.
- 2. Жоба жетекшісі болып {employee:nom} тағайындалсын.
- 3. Жоба жетекшісі жоба жарғысын әзірлесін.
- 4. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.

**Русский**

- 1. Открыть проект «{project}» со сроком выполнения с {from} по {to}. Бюджет проекта – {budget} тенге.
- 2. Назначить руководителем проекта {employee}.
- 3. Руководителю проекта разработать устав проекта.
- 4. Контроль за исполнением настоящего приказа оставляю за собой.

**English**

- 1. To open the project “{project}” with the term from {from} to {to}. The project budget is {budget} tenge.
- 2. To appoint {employee} as the project manager.
- 3. The project manager shall develop the project charter.
- 4. I reserve the control over the execution of this order.

---

## Приказ о назначении ответственного за охрану труда

Раздел: Охрана труда и экология. Идентификатор: `hse-safety-officer-order`. Языки: kk, ru, en.

**Источник текста:** написан по образцу ваших приказов. Проверить полностью.

**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.

### Тема приказа

- **Қазақша.** «Еңбекті қорғау жөніндегі жауапты тұлғаны тағайындау туралы»
- **Русский.** «О назначении ответственного за охрану труда»
- **English.** “On the appointment of the occupational safety officer”

### Распоряжение

**Қазақша**

- 1. {employee:nom}, {position}, {fromDate} бастап еңбекті қорғау жөніндегі жауапты тұлға болып тағайындалсын.
- 2. Жауапты тұлға нұсқамалардың өткізілуін және еңбекті қорғау журналдарының жүргізілуін қамтамасыз етсін.
- 3. Бұйрықтың орындалуын бақылауды өзіме қалдырамын.

**Русский**

- 1. Назначить {employee}, {position}, ответственным за охрану труда с {fromDate}.
- 2. Ответственному обеспечить проведение инструктажей и ведение журналов по охране труда.
- 3. Контроль за исполнением настоящего приказа оставляю за собой.

**English**

- 1. To appoint {employee}, {position}, as the person responsible for occupational safety from {fromDate}.
- 2. The responsible person shall ensure that briefings are held and that the occupational safety logs are kept.
- 3. I reserve the control over the execution of this order.

---

## Трудовой договор

Раздел: Отдел кадров. Идентификатор: `hr-employment-contract`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Жұмыс беруші» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {employee:nom}, бұдан әрі «Қызметкер» деп аталатын, екінші тараптан, төмендегілер туралы келісті:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Работодатель», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {employee:nom}, именуемый(ая) в дальнейшем «Работник», с другой стороны, договорились о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “Employer”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {employee:nom}, hereinafter the “Employee”, on the other part, have agreed as follows:

- **Қазақша.** 1. Жұмыс беруші Қызметкерді {position} лауазымына қабылдайды, ал Қызметкер осы шартта көзделген еңбек міндеттерін орындауға міндеттенеді.
- **Русский.** 1. Работодатель принимает Работника на должность {position}, а Работник обязуется выполнять трудовые обязанности, предусмотренные настоящим договором.
- **English.** 1. The Employer hires the Employee for the position of {position}, and the Employee undertakes to perform the duties set out in this contract.

- **Қазақша.** 2. Жұмысқа кіріскен күн – {startDate}. Шарттың мерзімі: {contractTerm}. Сынақ мерзімі: {probation}.
- **Русский.** 2. Дата начала работы – {startDate}. Срок договора: {contractTerm}. Испытательный срок: {probation}.
- **English.** 2. Start date: {startDate}. Term of the contract: {contractTerm}. Probation period: {probation}.

- **Қазақша.** 3. Қызметкерге ұстап қалуларға дейін айына {salary} ({salaryWords}) теңге мөлшерінде лауазымдық жалақы белгіленеді. Жалақы айына кемінде бір рет төленеді.
- **Русский.** 3. Работнику устанавливается должностной оклад {salary} ({salaryWords}) тенге в месяц до удержаний. Заработная плата выплачивается не реже одного раза в месяц.
- **English.** 3. The Employee is paid a monthly salary of KZT {salary} ({salaryWords}) before deductions. Salary is paid at least once a month.

- **Қазақша.** 4. Жұмыс режимі: {workSchedule}.
- **Русский.** 4. Режим работы: {workSchedule}.
- **English.** 4. Working hours: {workSchedule}.

- **Қазақша.** 5. Қызметкерге ұзақтығы {vacationDays} күнтізбелік күн жыл сайынғы ақы төленетін еңбек демалысы беріледі.
- **Русский.** 5. Работнику предоставляется ежегодный оплачиваемый трудовой отпуск продолжительностью {vacationDays} календарных дней.
- **English.** 5. The Employee is entitled to annual paid leave of {vacationDays} calendar days.

- **Қазақша.** 6. Қызметкер еңбек тәртібін, еңбекті қорғау талаптарын сақтауға және Жұмыс берушінің коммерциялық құпиясын жария етпеуге міндетті.
- **Русский.** 6. Работник обязан соблюдать трудовую дисциплину, требования охраны труда и не разглашать коммерческую тайну Работодателя.
- **English.** 6. The Employee shall observe labour discipline and occupational safety rules and shall not disclose the Employer’s trade secrets.

- **Қазақша.** 7. Шарт бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан. Шартта реттелмеген мәселелер Қазақстан Республикасының еңбек заңнамасымен реттеледі.
- **Русский.** 7. Договор составлен в двух экземплярах равной юридической силы, по одному для каждой Стороны. Вопросы, не урегулированные договором, регулируются трудовым законодательством Республики Казахстан.
- **English.** 7. The contract is made in two counterparts of equal force, one for each Party. Matters not covered here are governed by the labour legislation of the Republic of Kazakhstan.

- **Қазақша.** Қызметкер: ________________ {employee:nom}, ЖСН {iin}
- **Русский.** Работник: ________________ {employee:nom}, ИИН {iin}
- **English.** Employee: ________________ {employee:nom}, IIN {iin}

---

## Дополнительное соглашение к трудовому договору

Раздел: Отдел кадров. Идентификатор: `hr-labour-amendment`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Жұмыс беруші» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {employee:nom}, бұдан әрі «Қызметкер» деп аталатын, екінші тараптан, төмендегілер туралы келісті:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Работодатель», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {employee:nom}, именуемый(ая) в дальнейшем «Работник», с другой стороны, договорились о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “Employer”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {employee:nom}, hereinafter the “Employee”, on the other part, have agreed as follows:

- **Қазақша.** 1. Тараптар {contractDate} № {contractNumber} еңбек шартына мынадай өзгерістер енгізуге келісті: {changes}
- **Русский.** 1. Стороны договорились внести в трудовой договор № {contractNumber} от {contractDate} следующие изменения: {changes}
- **English.** 1. The Parties have agreed to amend employment contract No. {contractNumber} dated {contractDate} as follows: {changes}

- **Қазақша.** 2. Өзгерістер {effectiveDate} бастап қолданылады.
- **Русский.** 2. Изменения применяются с {effectiveDate}.
- **English.** 2. The changes apply from {effectiveDate}.

- **Қазақша.** 3. Еңбек шартының осы келісіммен өзгертілмеген талаптары бұрынғы редакцияда қолданылады.
- **Русский.** 3. Условия трудового договора, не изменённые настоящим соглашением, действуют в прежней редакции.
- **English.** 3. Terms of the employment contract not amended by this agreement remain unchanged.

- **Қазақша.** 4. Келісім еңбек шартының ажырамас бөлігі болып табылады және екі данада жасалды.
- **Русский.** 4. Соглашение является неотъемлемой частью трудового договора и составлено в двух экземплярах.
- **English.** 4. This agreement forms an integral part of the employment contract and is made in two counterparts.

- **Қазақша.** Қызметкер: ________________ {employee:nom}, ЖСН {iin}
- **Русский.** Работник: ________________ {employee:nom}, ИИН {iin}
- **English.** Employee: ________________ {employee:nom}, IIN {iin}

---

## Должностная инструкция

Раздел: Отдел кадров. Идентификатор: `hr-job-description`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** БЕКІТІЛДІ {approvalDate} № {approvalOrder} бұйрығымен
- **Русский.** УТВЕРЖДЕНО приказом от {approvalDate} № {approvalOrder}
- **English.** APPROVED by order No. {approvalOrder} dated {approvalDate}

- **Қазақша.** 1. Жалпы ережелер
- **Русский.** 1. Общие положения
- **English.** 1. General provisions

- **Қазақша.** 1.1. {position} – {unit} қызметкері, {reportsTo} бағынады.
- **Русский.** 1.1. {position} является работником подразделения «{unit}» и подчиняется {reportsTo}.
- **English.** 1.1. The {position} is an employee of the {unit} and reports to {reportsTo}.

- **Қазақша.** 1.2. Біліктілік талаптары: {qualification}
- **Русский.** 1.2. Требования к квалификации: {qualification}
- **English.** 1.2. Qualification requirements: {qualification}

- **Қазақша.** 2. Лауазымдық міндеттер
- **Русский.** 2. Должностные обязанности
- **English.** 2. Duties

- **Қазақша.** 2.1. {duties}
- **Русский.** 2.1. {duties}
- **English.** 2.1. {duties}

- **Қазақша.** 3. Құқықтар
- **Русский.** 3. Права
- **English.** 3. Rights

- **Қазақша.** 3.1. Міндеттерін орындауға қажетті ақпарат пен құжаттарды алуға, жұмысты жетілдіру бойынша ұсыныстар енгізуге құқылы.
- **Русский.** 3.1. Имеет право получать информацию и документы, необходимые для выполнения обязанностей, и вносить предложения по улучшению работы.
- **English.** 3.1. May receive the information and documents needed to perform the duties and propose improvements to the work.

- **Қазақша.** 4. Жауапкершілік
- **Русский.** 4. Ответственность
- **English.** 4. Responsibility

- **Қазақша.** 4.1. Міндеттерін орындамағаны немесе тиісінше орындамағаны үшін Қазақстан Республикасының заңнамасында белгіленген тәртіппен жауап береді.
- **Русский.** 4.1. Несёт ответственность за неисполнение или ненадлежащее исполнение обязанностей в порядке, установленном законодательством Республики Казахстан.
- **English.** 4.1. Is liable for failure to perform or improper performance of the duties as provided by the legislation of the Republic of Kazakhstan.

---

## Соглашение о неразглашении (NDA)

Раздел: Отдел кадров. Идентификатор: `hr-nda`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Жұмыс беруші» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {employee:nom}, бұдан әрі «Қызметкер» деп аталатын, екінші тараптан, төмендегілер туралы келісті:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Работодатель», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {employee:nom}, именуемый(ая) в дальнейшем «Работник», с другой стороны, договорились о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “Employer”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {employee:nom}, hereinafter the “Employee”, on the other part, have agreed as follows:

- **Қазақша.** 1. Қызметкер еңбек міндеттерін орындау кезінде белгілі болған құпия ақпаратты жария етпеуге міндеттенеді. Құпия ақпаратқа мыналар жатады: {confidentialScope}
- **Русский.** 1. Работник обязуется не разглашать конфиденциальную информацию, ставшую ему известной при исполнении трудовых обязанностей. К конфиденциальной информации относятся: {confidentialScope}
- **English.** 1. The Employee undertakes not to disclose confidential information learned in the course of employment. Confidential information includes: {confidentialScope}

- **Қазақша.** 2. Құпия ақпарат тек еңбек міндеттерін орындау үшін пайдаланылады; оны үшінші тұлғаларға беруге Жұмыс берушінің жазбаша келісімімен ғана жол беріледі.
- **Русский.** 2. Конфиденциальная информация используется только для исполнения трудовых обязанностей; передача её третьим лицам допускается лишь с письменного согласия Работодателя.
- **English.** 2. Confidential information may be used only to perform the duties; disclosure to third parties requires the Employer’s written consent.

- **Қазақша.** 3. Еңбек шарты тоқтатылған кезде Қызметкер құпия ақпараты бар барлық материалдарды қайтарады.
- **Русский.** 3. При прекращении трудового договора Работник возвращает все материалы, содержащие конфиденциальную информацию.
- **English.** 3. On termination of employment the Employee returns all materials containing confidential information.

- **Қазақша.** 4. Міндеттеме еңбек шарты қолданылатын бүкіл мерзім ішінде және ол тоқтатылғаннан кейін {termYears} жыл бойы күшінде болады.
- **Русский.** 4. Обязательство действует в течение всего срока трудового договора и {termYears} лет после его прекращения.
- **English.** 4. The obligation remains in force throughout the employment and for {termYears} years after its termination.

- **Қазақша.** 5. Келісімді бұзғаны үшін Қызметкер Қазақстан Республикасының заңнамасына сәйкес жауап береді.
- **Русский.** 5. За нарушение соглашения Работник несёт ответственность в соответствии с законодательством Республики Казахстан.
- **English.** 5. The Employee is liable for breach of this agreement under the legislation of the Republic of Kazakhstan.

- **Қазақша.** Қызметкер: ________________ {employee:nom}, ЖСН {iin}
- **Русский.** Работник: ________________ {employee:nom}, ИИН {iin}
- **English.** Employee: ________________ {employee:nom}, IIN {iin}

---

## Правила трудового распорядка

Раздел: Отдел кадров. Идентификатор: `hr-labour-rules`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** БЕКІТІЛДІ {approvalDate} № {approvalOrder} бұйрығымен
- **Русский.** УТВЕРЖДЕНО приказом от {approvalDate} № {approvalOrder}
- **English.** APPROVED by order No. {approvalOrder} dated {approvalDate}

- **Қазақша.** 1. Жалпы ережелер
- **Русский.** 1. Общие положения
- **English.** 1. General provisions

- **Қазақша.** 1.1. Осы Ережелер Компанияның ішкі еңбек тәртібін белгілейді және барлық қызметкерлер үшін міндетті.
- **Русский.** 1.1. Настоящие Правила устанавливают внутренний трудовой распорядок Компании и обязательны для всех работников.
- **English.** 1.1. These Regulations set the internal labour order of the Company and are binding on all employees.

- **Қазақша.** 2. Жұмыс уақыты
- **Русский.** 2. Рабочее время
- **English.** 2. Working time

- **Қазақша.** 2.1. Жұмыс аптасы: {workWeek}.
- **Русский.** 2.1. Рабочая неделя: {workWeek}.
- **English.** 2.1. Working week: {workWeek}.

- **Қазақша.** 2.2. Жұмыс уақыты {workStart} бастап {workEnd} дейін, түскі үзіліс {lunch}.
- **Русский.** 2.2. Рабочее время с {workStart} до {workEnd}, перерыв на обед {lunch}.
- **English.** 2.2. Working hours are from {workStart} to {workEnd}, with a lunch break at {lunch}.

- **Қазақша.** 3. Қызметкерлердің міндеттері
- **Русский.** 3. Обязанности работников
- **English.** 3. Duties of employees

- **Қазақша.** 3.1. Қызметкерлер еңбек міндеттерін адал орындауға, еңбек тәртібін, еңбекті қорғау және өрт қауіпсіздігі талаптарын сақтауға міндетті.
- **Русский.** 3.1. Работники обязаны добросовестно исполнять трудовые обязанности, соблюдать трудовую дисциплину, требования охраны труда и пожарной безопасности.
- **English.** 3.1. Employees shall perform their duties in good faith and observe labour discipline, occupational safety and fire safety rules.

- **Қазақша.** 3.2. Жұмысқа келмеу немесе кешігу себебі туралы тікелей басшыға дереу хабарлау қажет.
- **Русский.** 3.2. О причине неявки или опоздания необходимо незамедлительно сообщить непосредственному руководителю.
- **English.** 3.2. Absence or lateness must be reported to the line manager without delay.

- **Қазақша.** 4. Жұмыс берушінің міндеттері
- **Русский.** 4. Обязанности работодателя
- **English.** 4. Duties of the employer

- **Қазақша.** 4.1. Жұмыс беруші қауіпсіз еңбек жағдайларын қамтамасыз етеді және жалақыны уақытында төлейді.
- **Русский.** 4.1. Работодатель обеспечивает безопасные условия труда и своевременно выплачивает заработную плату.
- **English.** 4.1. The Employer provides safe working conditions and pays salaries on time.

- **Қазақша.** 5. Көтермелеу және жаза
- **Русский.** 5. Поощрения и взыскания
- **English.** 5. Rewards and sanctions

- **Қазақша.** 5.1. Жұмыстағы табыстары үшін көтермелеу, еңбек тәртібін бұзғаны үшін тәртіптік жаза заңнамада белгіленген тәртіппен қолданылады.
- **Русский.** 5.1. Поощрения за успехи в работе и дисциплинарные взыскания за нарушения трудовой дисциплины применяются в порядке, установленном законодательством.
- **English.** 5.1. Rewards for good work and disciplinary sanctions for breaches are applied as provided by law.

---

## Положение об оплате труда и премировании

Раздел: Отдел кадров. Идентификатор: `hr-pay-policy`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** БЕКІТІЛДІ {approvalDate} № {approvalOrder} бұйрығымен
- **Русский.** УТВЕРЖДЕНО приказом от {approvalDate} № {approvalOrder}
- **English.** APPROVED by order No. {approvalOrder} dated {approvalDate}

- **Қазақша.** 1. Жалпы ережелер
- **Русский.** 1. Общие положения
- **English.** 1. General provisions

- **Қазақша.** 1.1. Ереже қызметкерлердің еңбегіне ақы төлеу мен сыйлықақы берудің тәртібі мен шарттарын белгілейді.
- **Русский.** 1.1. Положение устанавливает порядок и условия оплаты труда и премирования работников.
- **English.** 1.1. This policy sets the procedure and terms of pay and bonuses for employees.

- **Қазақша.** 2. Еңбекақы
- **Русский.** 2. Оплата труда
- **English.** 2. Pay

- **Қазақша.** 2.1. Еңбекақы штат кестесіне сәйкес лауазымдық жалақы түрінде белгіленеді.
- **Русский.** 2.1. Оплата труда устанавливается в виде должностного оклада согласно штатному расписанию.
- **English.** 2.1. Pay is set as a monthly salary according to the staff schedule.

- **Қазақша.** 2.2. Жалақы төлеу мерзімдері: {payDays}.
- **Русский.** 2.2. Сроки выплаты заработной платы: {payDays}.
- **English.** 2.2. Salary is paid on: {payDays}.

- **Қазақша.** 3. Сыйлықақы
- **Русский.** 3. Премирование
- **English.** 3. Bonuses

- **Қазақша.** 3.1. Сыйлықақы жұмыс нәтижесі бойынша басшының бұйрығымен тағайындалады.
- **Русский.** 3.1. Премия назначается по результатам работы приказом руководителя.
- **English.** 3.1. Bonuses are awarded for results by order of the head of the company.

- **Қазақша.** 3.2. Сыйлықақының ең жоғары мөлшері – лауазымдық жалақының {bonusMax} пайызы.
- **Русский.** 3.2. Предельный размер премии – {bonusMax} % должностного оклада.
- **English.** 3.2. The maximum bonus is {bonusMax}% of the monthly salary.

- **Қазақша.** 4. Қорытынды ережелер
- **Русский.** 4. Заключительные положения
- **English.** 4. Final provisions

- **Қазақша.** 4.1. Ереже бекітілген күннен бастап қолданысқа енгізіледі.
- **Русский.** 4.1. Положение вводится в действие со дня утверждения.
- **English.** 4.1. The policy takes effect on the date of approval.

---

## Договор поставки

Раздел: Юридический отдел. Идентификатор: `legal-supply-contract`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Сатып алушы» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {counterparty}, бұдан әрі «Жеткізуші» деп аталатын, {counterpartySigner} атынан, екінші тараптан, бірлесіп «Тараптар» деп аталатындар, төмендегілер туралы осы шартты жасасты:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Покупатель», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {counterparty}, именуемое в дальнейшем «Поставщик», в лице {counterpartySigner}, с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “Buyer”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {counterparty}, hereinafter the “Supplier”, represented by {counterpartySigner}, on the other part, together the “Parties”, have concluded this contract as follows:

- **Қазақша.** 1. Жеткізуші Сатып алушыға мына тауарды жеткізуге, ал Сатып алушы оны қабылдап, ақысын төлеуге міндеттенеді: {goods}
- **Русский.** 1. Поставщик обязуется поставить Покупателю, а Покупатель – принять и оплатить следующий товар: {goods}
- **English.** 1. The Supplier undertakes to deliver to the Buyer, and the Buyer to accept and pay for, the following goods: {goods}

- **Қазақша.** 2. Шарттың бағасы {amount} ({amountWords}) теңгені құрайды. Төлем тәртібі: {paymentTerms}.
- **Русский.** 2. Цена договора составляет {amount} ({amountWords}) тенге. Порядок оплаты: {paymentTerms}.
- **English.** 2. The contract price is KZT {amount} ({amountWords}). Payment terms: {paymentTerms}.

- **Қазақша.** 3. Тауар {deliveryDate} дейін мына мекенжайға жеткізіледі: {deliveryPlace}. Тауар жүкқұжат бойынша қабылданады.
- **Русский.** 3. Товар поставляется до {deliveryDate} по адресу: {deliveryPlace}. Приёмка товара производится по накладной.
- **English.** 3. The goods are delivered by {deliveryDate} to: {deliveryPlace}. Acceptance is made against a delivery note.

- **Қазақша.** 4. Тауардың сапасы техникалық талаптар мен сертификаттарға сәйкес келуі тиіс. Сапасыз тауарды Жеткізуші өз есебінен ауыстырады.
- **Русский.** 4. Качество товара должно соответствовать техническим требованиям и сертификатам. Некачественный товар Поставщик заменяет за свой счёт.
- **English.** 4. The goods shall meet the technical requirements and certificates. The Supplier replaces defective goods at its own cost.

- **Қазақша.** 5. Жеткізу мерзімін бұзғаны үшін Жеткізуші кешіктірілген әр күн үшін жеткізілмеген тауар құнының 0,1 пайызы мөлшерінде тұрақсыздық айыбын төлейді.
- **Русский.** 5. За нарушение срока поставки Поставщик уплачивает неустойку в размере 0,1 % стоимости непоставленного товара за каждый день просрочки.
- **English.** 5. For late delivery the Supplier pays a penalty of 0.1% of the value of the undelivered goods per day of delay.

- **Қазақша.** 6. Шарт Тараптар қол қойған күннен бастап күшіне енеді және {validUntil} дейін қолданылады.
- **Русский.** 6. Договор вступает в силу с даты подписания Сторонами и действует до {validUntil}.
- **English.** 6. The contract enters into force on the date of signing by the Parties and remains in effect until {validUntil}.

- **Қазақша.** 7. Даулар келіссөздер арқылы, ал келісімге қол жеткізілмесе, Қазақстан Республикасының заңнамасына сәйкес сот тәртібімен шешіледі.
- **Русский.** 7. Споры разрешаются путём переговоров, а при недостижении согласия – в судебном порядке по законодательству Республики Казахстан.
- **English.** 7. Disputes are settled by negotiation and, failing agreement, in court under the legislation of the Republic of Kazakhstan.

- **Қазақша.** 8. Шарт қазақ, орыс және ағылшын тілдерінде бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан.
- **Русский.** 8. Договор составлен на казахском, русском и английском языках в двух экземплярах равной юридической силы, по одному для каждой Стороны.
- **English.** 8. The contract is made in Kazakh, Russian and English in two counterparts of equal legal force, one for each Party.

- **Қазақша.** Тараптардың деректемелері: {@company.legalNameKk}, БСН {@company.bin}, {@company.address}. {counterparty}, БСН {counterpartyBin}.
- **Русский.** Реквизиты сторон: {@company.legalName}, БИН {@company.bin}, {@company.address}. {counterparty}, БИН {counterpartyBin}.
- **English.** Details of the parties: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}. {counterparty}, BIN {counterpartyBin}.

- **Қазақша.** Жеткізуші: ________________ {counterpartySigner}
- **Русский.** Поставщик: ________________ {counterpartySigner}
- **English.** Supplier: ________________ {counterpartySigner}

---

## Договор оказания услуг

Раздел: Юридический отдел. Идентификатор: `legal-service-contract`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Тапсырыс беруші» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {counterparty}, бұдан әрі «Орындаушы» деп аталатын, {counterpartySigner} атынан, екінші тараптан, бірлесіп «Тараптар» деп аталатындар, төмендегілер туралы осы шартты жасасты:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Заказчик», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {counterparty}, именуемое в дальнейшем «Исполнитель», в лице {counterpartySigner}, с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “Customer”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {counterparty}, hereinafter the “Contractor”, represented by {counterpartySigner}, on the other part, together the “Parties”, have concluded this contract as follows:

- **Қазақша.** 1. Орындаушы Тапсырыс берушіге мына қызметтерді көрсетуге міндеттенеді: {services}
- **Русский.** 1. Исполнитель обязуется оказать Заказчику следующие услуги: {services}
- **English.** 1. The Contractor undertakes to provide the Customer with the following services: {services}

- **Қазақша.** 2. Қызметтер {serviceStart} бастап {serviceEnd} дейін көрсетіледі.
- **Русский.** 2. Услуги оказываются с {serviceStart} по {serviceEnd}.
- **English.** 2. The services are provided from {serviceStart} to {serviceEnd}.

- **Қазақша.** 3. Қызметтердің құны {amount} ({amountWords}) теңгені құрайды. Төлем тәртібі: {paymentTerms}.
- **Русский.** 3. Стоимость услуг составляет {amount} ({amountWords}) тенге. Порядок оплаты: {paymentTerms}.
- **English.** 3. The cost of the services is KZT {amount} ({amountWords}). Payment terms: {paymentTerms}.

- **Қазақша.** 4. Көрсетілген қызметтер Тараптар қол қойған орындалған жұмыстар актісімен ресімделеді.
- **Русский.** 4. Оказание услуг оформляется актом выполненных работ, подписанным Сторонами.
- **English.** 4. The services are documented by a certificate of completed work signed by the Parties.

- **Қазақша.** 5. Орындаушы қызметтерді тиісті сапада және уақытында көрсетеді және Тапсырыс берушінің құпия ақпаратын жария етпейді.
- **Русский.** 5. Исполнитель оказывает услуги качественно и в срок и не разглашает конфиденциальную информацию Заказчика.
- **English.** 5. The Contractor provides the services properly and on time and keeps the Customer’s information confidential.

- **Қазақша.** 6. Шарт Тараптар қол қойған күннен бастап күшіне енеді және {validUntil} дейін қолданылады.
- **Русский.** 6. Договор вступает в силу с даты подписания Сторонами и действует до {validUntil}.
- **English.** 6. The contract enters into force on the date of signing by the Parties and remains in effect until {validUntil}.

- **Қазақша.** 7. Даулар келіссөздер арқылы, ал келісімге қол жеткізілмесе, Қазақстан Республикасының заңнамасына сәйкес сот тәртібімен шешіледі.
- **Русский.** 7. Споры разрешаются путём переговоров, а при недостижении согласия – в судебном порядке по законодательству Республики Казахстан.
- **English.** 7. Disputes are settled by negotiation and, failing agreement, in court under the legislation of the Republic of Kazakhstan.

- **Қазақша.** 8. Шарт қазақ, орыс және ағылшын тілдерінде бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан.
- **Русский.** 8. Договор составлен на казахском, русском и английском языках в двух экземплярах равной юридической силы, по одному для каждой Стороны.
- **English.** 8. The contract is made in Kazakh, Russian and English in two counterparts of equal legal force, one for each Party.

- **Қазақша.** Тараптардың деректемелері: {@company.legalNameKk}, БСН {@company.bin}, {@company.address}. {counterparty}, БСН {counterpartyBin}.
- **Русский.** Реквизиты сторон: {@company.legalName}, БИН {@company.bin}, {@company.address}. {counterparty}, БИН {counterpartyBin}.
- **English.** Details of the parties: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}. {counterparty}, BIN {counterpartyBin}.

- **Қазақша.** Орындаушы: ________________ {counterpartySigner}
- **Русский.** Исполнитель: ________________ {counterpartySigner}
- **English.** Contractor: ________________ {counterpartySigner}

---

## Договор аренды

Раздел: Юридический отдел. Идентификатор: `legal-lease-contract`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Жалға алушы» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {counterparty}, бұдан әрі «Жалға беруші» деп аталатын, {counterpartySigner} атынан, екінші тараптан, бірлесіп «Тараптар» деп аталатындар, төмендегілер туралы осы шартты жасасты:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Арендатор», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {counterparty}, именуемое в дальнейшем «Арендодатель», в лице {counterpartySigner}, с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “Lessee”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {counterparty}, hereinafter the “Lessor”, represented by {counterpartySigner}, on the other part, together the “Parties”, have concluded this contract as follows:

- **Қазақша.** 1. Жалға беруші Жалға алушыға уақытша иеленуге және пайдалануға мына объектіні береді: {premises}
- **Русский.** 1. Арендодатель передаёт Арендатору во временное владение и пользование следующий объект: {premises}
- **English.** 1. The Lessor transfers to the Lessee for temporary possession and use the following property: {premises}

- **Қазақша.** 2. Объект Жалға алушыға {leaseStart} қабылдау-беру актісі бойынша беріледі.
- **Русский.** 2. Объект передаётся Арендатору {leaseStart} по акту приёма-передачи.
- **English.** 2. The property is handed over to the Lessee on {leaseStart} under a handover certificate.

- **Қазақша.** 3. Жалдау ақысы айына {rent} ({rentWords}) теңгені құрайды және {payDay} төленеді.
- **Русский.** 3. Арендная плата составляет {rent} ({rentWords}) тенге в месяц и вносится {payDay}.
- **English.** 3. The rent is KZT {rent} ({rentWords}) per month, payable {payDay}.

- **Қазақша.** 4. Жалға алушы объектіні мақсаты бойынша пайдаланады, тиісті күйде ұстайды және, егер Тараптар өзгеше келіспесе, коммуналдық қызметтерге ақы төлейді.
- **Русский.** 4. Арендатор использует объект по назначению, содержит его в надлежащем состоянии и, если Стороны не договорились иначе, оплачивает коммунальные услуги.
- **English.** 4. The Lessee uses the property for its purpose, keeps it in good condition and, unless the Parties agree otherwise, pays the utilities.

- **Қазақша.** 5. Жалға беруші объектіге күрделі жөндеу жүргізеді және Жалға алушының оны пайдалануына кедергі келтірмейді.
- **Русский.** 5. Арендодатель производит капитальный ремонт объекта и не препятствует Арендатору в пользовании им.
- **English.** 5. The Lessor carries out major repairs and does not hinder the Lessee’s use of the property.

- **Қазақша.** 6. Шарт Тараптар қол қойған күннен бастап күшіне енеді және {validUntil} дейін қолданылады.
- **Русский.** 6. Договор вступает в силу с даты подписания Сторонами и действует до {validUntil}.
- **English.** 6. The contract enters into force on the date of signing by the Parties and remains in effect until {validUntil}.

- **Қазақша.** 7. Даулар келіссөздер арқылы, ал келісімге қол жеткізілмесе, Қазақстан Республикасының заңнамасына сәйкес сот тәртібімен шешіледі.
- **Русский.** 7. Споры разрешаются путём переговоров, а при недостижении согласия – в судебном порядке по законодательству Республики Казахстан.
- **English.** 7. Disputes are settled by negotiation and, failing agreement, in court under the legislation of the Republic of Kazakhstan.

- **Қазақша.** 8. Шарт қазақ, орыс және ағылшын тілдерінде бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан.
- **Русский.** 8. Договор составлен на казахском, русском и английском языках в двух экземплярах равной юридической силы, по одному для каждой Стороны.
- **English.** 8. The contract is made in Kazakh, Russian and English in two counterparts of equal legal force, one for each Party.

- **Қазақша.** Тараптардың деректемелері: {@company.legalNameKk}, БСН {@company.bin}, {@company.address}. {counterparty}, БСН {counterpartyBin}.
- **Русский.** Реквизиты сторон: {@company.legalName}, БИН {@company.bin}, {@company.address}. {counterparty}, БИН {counterpartyBin}.
- **English.** Details of the parties: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}. {counterparty}, BIN {counterpartyBin}.

- **Қазақша.** Жалға беруші: ________________ {counterpartySigner}
- **Русский.** Арендодатель: ________________ {counterpartySigner}
- **English.** Lessor: ________________ {counterpartySigner}

---

## Дополнительное соглашение к договору

Раздел: Юридический отдел. Идентификатор: `legal-contract-amendment`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Бірінші Тарап» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {counterparty}, бұдан әрі «Екінші Тарап» деп аталатын, {counterpartySigner} атынан, екінші тараптан, бірлесіп «Тараптар» деп аталатындар, төмендегілер туралы осы шартты жасасты:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Первая Сторона», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {counterparty}, именуемое в дальнейшем «Вторая Сторона», в лице {counterpartySigner}, с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “First Party”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {counterparty}, hereinafter the “Second Party”, represented by {counterpartySigner}, on the other part, together the “Parties”, have concluded this contract as follows:

- **Қазақша.** 1. Тараптар {contractDate} № {contractNumber} шартқа мынадай өзгерістер енгізуге келісті: {changes}
- **Русский.** 1. Стороны договорились внести в договор № {contractNumber} от {contractDate} следующие изменения: {changes}
- **English.** 1. The Parties have agreed to amend contract No. {contractNumber} dated {contractDate} as follows: {changes}

- **Қазақша.** 2. Өзгерістер {effectiveDate} бастап қолданылады.
- **Русский.** 2. Изменения применяются с {effectiveDate}.
- **English.** 2. The changes apply from {effectiveDate}.

- **Қазақша.** 3. Шарттың осы келісіммен өзгертілмеген талаптары бұрынғы редакцияда қолданылады. Келісім шарттың ажырамас бөлігі болып табылады.
- **Русский.** 3. Условия договора, не изменённые настоящим соглашением, действуют в прежней редакции. Соглашение является неотъемлемой частью договора.
- **English.** 3. Terms of the contract not amended by this agreement remain unchanged. This agreement forms an integral part of the contract.

- **Қазақша.** 4. Келісім қазақ, орыс және ағылшын тілдерінде бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан.
- **Русский.** 4. Соглашение составлено на казахском, русском и английском языках в двух экземплярах равной юридической силы, по одному для каждой Стороны.
- **English.** 4. This agreement is made in Kazakh, Russian and English in two counterparts of equal legal force, one for each Party.

- **Қазақша.** Тараптардың деректемелері: {@company.legalNameKk}, БСН {@company.bin}, {@company.address}. {counterparty}, БСН {counterpartyBin}.
- **Русский.** Реквизиты сторон: {@company.legalName}, БИН {@company.bin}, {@company.address}. {counterparty}, БИН {counterpartyBin}.
- **English.** Details of the parties: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}. {counterparty}, BIN {counterpartyBin}.

- **Қазақша.** Екінші Тарап: ________________ {counterpartySigner}
- **Русский.** Вторая Сторона: ________________ {counterpartySigner}
- **English.** Second Party: ________________ {counterpartySigner}

---

## Претензия

Раздел: Юридический отдел. Идентификатор: `legal-claim`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Кімге: {counterparty}
- **Русский.** Кому: {counterparty}
- **English.** To: {counterparty}

- **Қазақша.** {contractDate} № {contractNumber} шарт бойынша
- **Русский.** по договору № {contractNumber} от {contractDate}
- **English.** under contract No. {contractNumber} dated {contractDate}

- **Қазақша.** 1. {counterparty} шарт бойынша міндеттемелерін бұзды: {violation}
- **Русский.** 1. {counterparty} нарушило обязательства по договору: {violation}
- **English.** 1. {counterparty} has breached its obligations under the contract: {violation}

- **Қазақша.** 2. Осыған байланысты {claimAmount} ({amountWords}) теңге төлеуді талап етеміз.
- **Русский.** 2. В связи с этим требуем уплатить {claimAmount} ({amountWords}) тенге.
- **English.** 2. We therefore demand payment of KZT {claimAmount} ({amountWords}).

- **Қазақша.** 3. Кінәрат-талапқа ол алынған күннен бастап {answerDays} күн ішінде жауап беруіңізді сұраймыз. Жауап болмаса, сотқа жүгінуге мәжбүр боламыз.
- **Русский.** 3. Просим ответить на претензию в течение {answerDays} дней с даты её получения. При отсутствии ответа будем вынуждены обратиться в суд.
- **English.** 3. Please respond within {answerDays} days of receipt. Failing a response, we will have to apply to the court.

---

## Ответ на претензию

Раздел: Юридический отдел. Идентификатор: `legal-claim-reply`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Кімге: {counterparty}
- **Русский.** Кому: {counterparty}
- **English.** To: {counterparty}

- **Қазақша.** {claimDate} № {claimNumber} кінәрат-талапқа
- **Русский.** на претензию № {claimNumber} от {claimDate}
- **English.** to claim No. {claimNumber} dated {claimDate}

- **Қазақша.** {claimDate} № {claimNumber} кінәрат-талапты қарап, мынаны хабарлаймыз.
- **Русский.** Рассмотрев претензию № {claimNumber} от {claimDate}, сообщаем следующее.
- **English.** Having considered claim No. {claimNumber} dated {claimDate}, we inform you as follows.

- **Қазақша.** {answer}
- **Русский.** {answer}
- **English.** {answer}

- **Қазақша.** Қосымша сұрақтар туындаса, біз келіссөздерге дайынбыз.
- **Русский.** При возникновении дополнительных вопросов мы готовы к переговорам.
- **English.** We remain open to negotiation should further questions arise.

---

## Исковое заявление

Раздел: Юридический отдел. Идентификатор: `legal-lawsuit`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Сотқа: {court}
- **Русский.** В суд: {court}
- **English.** To the court: {court}

- **Қазақша.** Талапкер: {@company.legalNameKk}, БСН {@company.bin}, {@company.address}
- **Русский.** Истец: {@company.legalName}, БИН {@company.bin}, {@company.address}
- **English.** Claimant: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}

- **Қазақша.** Жауапкер: {counterparty}, БСН {counterpartyBin}
- **Русский.** Ответчик: {counterparty}, БИН {counterpartyBin}
- **English.** Defendant: {counterparty}, BIN {counterpartyBin}

- **Қазақша.** Талап қою бағасы: {claimAmount} теңге
- **Русский.** Цена иска: {claimAmount} тенге
- **English.** Value of the claim: KZT {claimAmount}

- **Қазақша.** {facts}
- **Русский.** {facts}
- **English.** {facts}

- **Қазақша.** Баяндалғанның негізінде сотты жауапкерден талапкердің пайдасына {claimAmount} ({amountWords}) теңге өндіріп беруді сұраймын.
- **Русский.** На основании изложенного прошу суд взыскать с ответчика в пользу истца {claimAmount} ({amountWords}) тенге.
- **English.** On these grounds, I ask the court to recover KZT {claimAmount} ({amountWords}) from the defendant in favour of the claimant.

- **Қазақша.** Қосымшалар: {attachments}
- **Русский.** Приложения: {attachments}
- **English.** Attachments: {attachments}

---

## Гарантийное письмо

Раздел: Юридический отдел. Идентификатор: `legal-guarantee-letter`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Кімге: {counterparty}
- **Русский.** Кому: {counterparty}
- **English.** To: {counterparty}

- **Қазақша.** Міндеттемені орындау туралы
- **Русский.** Об исполнении обязательства
- **English.** On performance of an obligation

- **Қазақша.** {@company.legalNameKk} мынаны орындауға кепілдік береді: {obligation}
- **Русский.** {@company.legalName} гарантирует: {obligation}
- **English.** {@company.legalNameEn} guarantees: {obligation}

- **Қазақша.** Міндеттеме сомасы – {amount} ({amountWords}) теңге, орындау мерзімі – {dueDate} дейін.
- **Русский.** Сумма обязательства – {amount} ({amountWords}) тенге, срок исполнения – до {dueDate}.
- **English.** Amount: KZT {amount} ({amountWords}); to be performed by {dueDate}.

---

## Официальное письмо контрагенту

Раздел: Юридический отдел. Идентификатор: `legal-official-letter`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Кімге: {counterparty}
- **Русский.** Кому: {counterparty}
- **English.** To: {counterparty}

- **Қазақша.** {letterSubject}
- **Русский.** {letterSubject}
- **English.** {letterSubject}

- **Қазақша.** {text}
- **Русский.** {text}
- **English.** {text}

- **Қазақша.** Құрметпен,
- **Русский.** С уважением,
- **English.** Yours faithfully,

---

## Решение единственного участника

Раздел: Корпоративное управление. Идентификатор: `corporate-sole-decision`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Қатысушы: {participant}
- **Русский.** Участник: {participant}
- **English.** Participant: {participant}

- **Қазақша.** Күн тәртібі: {agenda}
- **Русский.** Повестка: {agenda}
- **English.** Agenda: {agenda}

- **Қазақша.** Жалғыз қатысушы ШЕШТІ:
- **Русский.** Единственный участник РЕШИЛ:
- **English.** The sole participant HAS DECIDED:

- **Қазақша.** {decisions}
- **Русский.** {decisions}
- **English.** {decisions}

- **Қазақша.** Жалғыз қатысушы: ________________ {participant}
- **Русский.** Единственный участник: ________________ {participant}
- **English.** Sole participant: ________________ {participant}

---

## Протокол общего собрания участников

Раздел: Корпоративное управление. Идентификатор: `corporate-general-meeting`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өткізілген орны: {meetingPlace}
- **Русский.** Место проведения: {meetingPlace}
- **English.** Place: {meetingPlace}

- **Қазақша.** Қатысқандар: {attendees}
- **Русский.** Присутствовали: {attendees}
- **English.** Present: {attendees}

- **Қазақша.** Кворум бар. Жиналыс шешім қабылдауға құқылы.
- **Русский.** Кворум имеется. Собрание правомочно принимать решения.
- **English.** A quorum is present. The meeting is competent to take decisions.

- **Қазақша.** Жиналыс төрағасы: {chair}. Хатшы: {secretary}
- **Русский.** Председатель собрания: {chair}. Секретарь: {secretary}
- **English.** Chair: {chair}. Secretary: {secretary}

- **Қазақша.** Күн тәртібі: {agenda}
- **Русский.** Повестка дня: {agenda}
- **English.** Agenda: {agenda}

- **Қазақша.** ТЫҢДАЛДЫ: {heard}
- **Русский.** СЛУШАЛИ: {heard}
- **English.** HEARD: {heard}

- **Қазақша.** ДАУЫС БЕРУ ҚОРЫТЫНДЫСЫ: {votes}
- **Русский.** ИТОГИ ГОЛОСОВАНИЯ: {votes}
- **English.** VOTING RESULTS: {votes}

- **Қазақша.** ҚАУЛЫ ЕТТІ: {decisions}
- **Русский.** ПОСТАНОВИЛИ: {decisions}
- **English.** RESOLVED: {decisions}

- **Қазақша.** Жиналыс төрағасы: ________________ {chair}
- **Қазақша.** Хатшы: ________________ {secretary}
- **Русский.** Председатель собрания: ________________ {chair}
- **Русский.** Секретарь: ________________ {secretary}
- **English.** Chair: ________________ {chair}
- **English.** Secretary: ________________ {secretary}

---

## Счёт на оплату

Раздел: Финансы и бухгалтерия. Идентификатор: `finance-invoice`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жеткізуші: {@company.legalNameKk}, БСН {@company.bin}, {@company.address}
- **Русский.** Поставщик: {@company.legalName}, БИН {@company.bin}, {@company.address}
- **English.** Supplier: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}

- **Қазақша.** Банк деректемелері: {@company.bank}
- **Русский.** Банковские реквизиты: {@company.bank}
- **English.** Bank details: {@company.bank}

- **Қазақша.** Сатып алушы: {counterparty}, БСН {counterpartyBin}
- **Русский.** Покупатель: {counterparty}, БИН {counterpartyBin}
- **English.** Buyer: {counterparty}, BIN {counterpartyBin}

- **Қазақша.** Тауарлар мен қызметтер: {items}
- **Русский.** Товары и услуги: {items}
- **English.** Goods and services: {items}

- **Қазақша.** Барлығы төлеуге: {amount} ({amountWords}) теңге
- **Русский.** Всего к оплате: {amount} ({amountWords}) тенге
- **English.** Total due: KZT {amount} ({amountWords})

- **Қазақша.** Шотты {payUntil} дейін төлеу қажет.
- **Русский.** Счёт подлежит оплате до {payUntil}.
- **English.** Payment is due by {payUntil}.

---

## Акт выполненных работ

Раздел: Финансы и бухгалтерия. Идентификатор: `finance-work-act`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бір тараптан, және {counterparty}, екінші тараптан, {contractDate} № {contractNumber} шарт бойынша осы актіні жасады.
- **Русский.** {@company.legalName}, с одной стороны, и {counterparty}, с другой стороны, составили настоящий акт по договору № {contractNumber} от {contractDate}.
- **English.** {@company.legalNameEn}, on the one part, and {counterparty}, on the other part, have drawn up this certificate under contract No. {contractNumber} dated {contractDate}.

- **Қазақша.** 1. Мына жұмыстар орындалды (қызметтер көрсетілді): {works}
- **Русский.** 1. Выполнены следующие работы (оказаны услуги): {works}
- **English.** 1. The following work has been performed (services rendered): {works}

- **Қазақша.** 2. Жұмыстардың құны {amount} ({amountWords}) теңгені құрайды.
- **Русский.** 2. Стоимость работ составляет {amount} ({amountWords}) тенге.
- **English.** 2. The cost of the work is KZT {amount} ({amountWords}).

- **Қазақша.** 3. Жұмыстар толық көлемде және уақытында орындалды. Тараптардың сапа мен мерзім бойынша бір-біріне наразылығы жоқ.
- **Русский.** 3. Работы выполнены в полном объёме и в срок. Претензий по качеству и срокам Стороны друг к другу не имеют.
- **English.** 3. The work has been performed in full and on time. The Parties have no claims against each other as to quality or timing.

- **Қазақша.** Орындаушы: ________________ {counterpartySigner}
- **Русский.** Исполнитель: ________________ {counterpartySigner}
- **English.** Contractor: ________________ {counterpartySigner}

---

## Авансовый отчёт

Раздел: Финансы и бухгалтерия. Идентификатор: `finance-expense-report`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Есеп беретін тұлға: {employee:nom}, {position}
- **Русский.** Подотчётное лицо: {employee:nom}, {position}
- **English.** Accountable person: {employee:nom}, {position}

- **Қазақша.** Аванстың мақсаты: {advancePurpose}
- **Русский.** Назначение аванса: {advancePurpose}
- **English.** Purpose of the advance: {advancePurpose}

- **Қазақша.** Алынған аванс: {advance} теңге
- **Русский.** Получено аванса: {advance} тенге
- **English.** Advance received: KZT {advance}

- **Қазақша.** Шығыстар: {expenses}
- **Русский.** Расходы: {expenses}
- **English.** Expenses: {expenses}

- **Қазақша.** Жұмсалды: {spent} теңге. Қалдық (асыра жұмсау): {balance} теңге
- **Русский.** Израсходовано: {spent} тенге. Остаток (перерасход): {balance} тенге
- **English.** Spent: KZT {spent}. Balance (overspend): KZT {balance}

- **Қазақша.** Есеп беретін тұлға: ________________ {employee:nom}
- **Русский.** Подотчётное лицо: ________________ {employee:nom}
- **English.** Accountable person: ________________ {employee:nom}

---

## Акт сверки взаиморасчётов

Раздел: Финансы и бухгалтерия. Идентификатор: `finance-reconciliation`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk} және {counterparty} {periodFrom} бастап {periodTo} дейінгі кезеңдегі өзара есеп айырысуларды салыстырды.
- **Русский.** {@company.legalName} и {counterparty} провели сверку взаиморасчётов за период с {periodFrom} по {periodTo}.
- **English.** {@company.legalNameEn} and {counterparty} have reconciled mutual settlements for the period from {periodFrom} to {periodTo}.

- **Қазақша.** 1. Кезеңдегі операциялар: {operations}
- **Русский.** 1. Операции за период: {operations}
- **English.** 1. Transactions for the period: {operations}

- **Қазақша.** 2. {periodTo} жағдай бойынша сальдо {balance} теңгені құрайды, {balanceSide}.
- **Русский.** 2. Сальдо на {periodTo} составляет {balance} тенге {balanceSide}.
- **English.** 2. The balance as of {periodTo} is KZT {balance} {balanceSide}.

- **Қазақша.** Контрагент: ________________ {counterpartySigner}
- **Русский.** Контрагент: ________________ {counterpartySigner}
- **English.** Counterparty: ________________ {counterpartySigner}

---

## Заявка на оплату

Раздел: Финансы и бухгалтерия. Идентификатор: `finance-payment-request`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өтініш беруші: {employee:nom}, {position}
- **Русский.** Заявитель: {employee:nom}, {position}
- **English.** Applicant: {employee:nom}, {position}

- **Қазақша.** 1. Алушыға – {counterparty} – {amount} ({amountWords}) теңге төлеуді сұраймын.
- **Русский.** 1. Прошу оплатить получателю {counterparty} сумму {amount} ({amountWords}) тенге.
- **English.** 1. Please pay KZT {amount} ({amountWords}) to {counterparty}.

- **Қазақша.** 2. Төлем мақсаты: {paymentPurpose}
- **Русский.** 2. Назначение платежа: {paymentPurpose}
- **English.** 2. Purpose of payment: {paymentPurpose}

- **Қазақша.** 3. Негіздеме: {basisDoc}. Төлеу мерзімі – {payBy} дейін.
- **Русский.** 3. Основание: {basisDoc}. Срок оплаты – до {payBy}.
- **English.** 3. Basis: {basisDoc}. Pay by {payBy}.

- **Қазақша.** Өтініш беруші: ________________ {employee:nom}
- **Русский.** Заявитель: ________________ {employee:nom}
- **English.** Applicant: ________________ {employee:nom}

---

## Заявка на закупку

Раздел: Закупки и продажи. Идентификатор: `procurement-sales-purchase-request`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өтініш беруші: {employee:nom}, {position}
- **Русский.** Заявитель: {employee:nom}, {position}
- **English.** Applicant: {employee:nom}, {position}

- **Қазақша.** 1. Мынаны сатып алуды сұраймын: {items}
- **Русский.** 1. Прошу закупить: {items}
- **English.** 1. Please purchase: {items}

- **Қазақша.** 2. Шамамен құны – {estimate} теңге. Қажетті мерзімі – {neededBy} дейін.
- **Русский.** 2. Ориентировочная стоимость – {estimate} тенге. Необходимо к {neededBy}.
- **English.** 2. Estimated cost: KZT {estimate}. Needed by {neededBy}.

- **Қазақша.** 3. Негіздеме: {reason}
- **Русский.** 3. Обоснование: {reason}
- **English.** 3. Justification: {reason}

- **Қазақша.** Өтініш беруші: ________________ {employee:nom}
- **Русский.** Заявитель: ________________ {employee:nom}
- **English.** Applicant: ________________ {employee:nom}

---

## Запрос коммерческих предложений

Раздел: Закупки и продажи. Идентификатор: `procurement-sales-rfq`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Кімге: {counterparty}
- **Русский.** Кому: {counterparty}
- **English.** To: {counterparty}

- **Қазақша.** Коммерциялық ұсыныс беру туралы
- **Русский.** О предоставлении коммерческого предложения
- **English.** On submitting a quotation

- **Қазақша.** {@company.legalNameKk} мына тауарларға (жұмыстарға, қызметтерге) коммерциялық ұсыныс беруді сұрайды: {items}
- **Русский.** {@company.legalName} просит предоставить коммерческое предложение на следующие товары (работы, услуги): {items}
- **English.** {@company.legalNameEn} requests a quotation for the following goods (work, services): {items}

- **Қазақша.** Ұсыныста бағаны, жеткізу мерзімін, төлем шарттары мен кепілдікті көрсетуді сұраймыз.
- **Русский.** В предложении просим указать цену, сроки поставки, условия оплаты и гарантию.
- **English.** Please state the price, delivery time, payment terms and warranty.

- **Қазақша.** Ұсынысты {deadline} дейін жіберуді сұраймыз. Байланыс тұлғасы: {contact}.
- **Русский.** Предложение просим направить до {deadline}. Контактное лицо: {contact}.
- **English.** Please send your quotation by {deadline}. Contact person: {contact}.

---

## Протокол выбора поставщика

Раздел: Закупки и продажи. Идентификатор: `procurement-sales-supplier-selection`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Сатып алу нысанасы: {purchaseSubject}
- **Русский.** Предмет закупки: {purchaseSubject}
- **English.** Subject of purchase: {purchaseSubject}

- **Қазақша.** Комиссия құрамы: {commission}
- **Русский.** Состав комиссии: {commission}
- **English.** Commission: {commission}

- **Қазақша.** Қаралған ұсыныстар: {offers}
- **Русский.** Рассмотренные предложения: {offers}
- **English.** Offers considered: {offers}

- **Қазақша.** ШЕШІМ: жеткізуші ретінде {counterparty} таңдалсын, бағасы {winnerPrice} теңге.
- **Русский.** РЕШЕНИЕ: выбрать поставщиком {counterparty} с ценой {winnerPrice} тенге.
- **English.** DECISION: to select {counterparty} as the supplier at KZT {winnerPrice}.

- **Қазақша.** Таңдау негіздемесі: {criteria}
- **Русский.** Обоснование выбора: {criteria}
- **English.** Grounds for the choice: {criteria}

- **Қазақша.** Комиссия мүшелері: ________________
- **Русский.** Члены комиссии: ________________
- **English.** Commission members: ________________

---

## Коммерческое предложение

Раздел: Закупки и продажи. Идентификатор: `procurement-sales-offer`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Кімге: {counterparty}
- **Русский.** Кому: {counterparty}
- **English.** To: {counterparty}

- **Қазақша.** Тауарларды (қызметтерді) жеткізу туралы
- **Русский.** О поставке товаров (услуг)
- **English.** On supply of goods (services)

- **Қазақша.** {@company.legalNameKk} сізге мынаны ұсынады: {items}
- **Русский.** {@company.legalName} предлагает вам: {items}
- **English.** {@company.legalNameEn} offers you: {items}

- **Қазақша.** Жалпы құны – {amount} ({amountWords}) теңге.
- **Русский.** Общая стоимость – {amount} ({amountWords}) тенге.
- **English.** Total cost: KZT {amount} ({amountWords}).

- **Қазақша.** Жеткізу мерзімі: {deliveryTerms}. Төлем тәртібі: {paymentTerms}.
- **Русский.** Сроки поставки: {deliveryTerms}. Порядок оплаты: {paymentTerms}.
- **English.** Delivery: {deliveryTerms}. Payment: {paymentTerms}.

- **Қазақша.** Ұсыныс {offerValidUntil} дейін жарамды.
- **Русский.** Предложение действует до {offerValidUntil}.
- **English.** The offer is valid until {offerValidUntil}.

---

## Спецификация к договору

Раздел: Закупки и продажи. Идентификатор: `procurement-sales-specification`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk} мен {counterparty} арасында жасалған {contractDate} № {contractNumber} шартқа.
- **Русский.** к договору № {contractNumber} от {contractDate}, заключённому между {@company.legalName} и {counterparty}.
- **English.** to contract No. {contractNumber} dated {contractDate} between {@company.legalNameEn} and {counterparty}.

- **Қазақша.** Позициялар: {items}
- **Русский.** Позиции: {items}
- **English.** Items: {items}

- **Қазақша.** Барлығы: {amount} ({amountWords}) теңге. Жеткізу мерзімі: {deliveryDate} дейін.
- **Русский.** Итого: {amount} ({amountWords}) тенге. Срок поставки: до {deliveryDate}.
- **English.** Total: KZT {amount} ({amountWords}). Delivery by: {deliveryDate}.

- **Қазақша.** Спецификация шарттың ажырамас бөлігі болып табылады.
- **Русский.** Спецификация является неотъемлемой частью договора.
- **English.** This specification forms an integral part of the contract.

- **Қазақша.** Контрагент: ________________ {counterpartySigner}
- **Русский.** Контрагент: ________________ {counterpartySigner}
- **English.** Counterparty: ________________ {counterpartySigner}

---

## Приходная накладная

Раздел: Склад и логистика. Идентификатор: `warehouse-receipt-note`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жеткізуші: {counterparty}
- **Русский.** Поставщик: {counterparty}
- **English.** Supplier: {counterparty}

- **Қазақша.** Негіздеме: {basisDoc}. Қойма: {warehouse}
- **Русский.** Основание: {basisDoc}. Склад: {warehouse}
- **English.** Basis: {basisDoc}. Warehouse: {warehouse}

- **Қазақша.** Қабылданған құндылықтар: {items}
- **Русский.** Принятые ценности: {items}
- **English.** Items received: {items}

- **Қазақша.** Барлығы: {amount} теңге
- **Русский.** Итого: {amount} тенге
- **English.** Total: KZT {amount}

- **Қазақша.** Қабылдады: ________________ {storekeeper:nom}
- **Русский.** Принял: ________________ {storekeeper:nom}
- **English.** Received by: ________________ {storekeeper:nom}

---

## Накладная на внутреннее перемещение

Раздел: Склад и логистика. Идентификатор: `warehouse-transfer-note`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Қайдан: {fromPlace}. Қайда: {toPlace}
- **Русский.** Откуда: {fromPlace}. Куда: {toPlace}
- **English.** From: {fromPlace}. To: {toPlace}

- **Қазақша.** Құндылықтар: {items}
- **Русский.** Ценности: {items}
- **English.** Items: {items}

- **Қазақша.** Тапсырды: ________________ {handedBy:nom}
- **Қазақша.** Қабылдады: ________________ {receivedBy:nom}
- **Русский.** Сдал: ________________ {handedBy:nom}
- **Русский.** Принял: ________________ {receivedBy:nom}
- **English.** Handed over by: ________________ {handedBy:nom}
- **English.** Received by: ________________ {receivedBy:nom}

---

## Путевой лист

Раздел: Склад и логистика. Идентификатор: `warehouse-waybill`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жүргізуші: {driver:nom}
- **Русский.** Водитель: {driver:nom}
- **English.** Driver: {driver:nom}

- **Қазақша.** Автокөлік: {vehicle}
- **Русский.** Автомобиль: {vehicle}
- **English.** Vehicle: {vehicle}

- **Қазақша.** Рейс күні: {tripDate}. Бағыт: {route}
- **Русский.** Дата рейса: {tripDate}. Маршрут: {route}
- **English.** Date: {tripDate}. Route: {route}

- **Қазақша.** Шыққандағы спидометр көрсеткіші: {odometerStart} км. Берілген отын: {fuel} л
- **Русский.** Спидометр при выезде: {odometerStart} км. Выдано топлива: {fuel} л
- **English.** Odometer at departure: {odometerStart} km. Fuel issued: {fuel} l

- **Қазақша.** Жүргізуші денсаулық жағдайы бойынша көлік жүргізуге жіберілді, автокөлік техникалық жағынан жарамды.
- **Русский.** Водитель по состоянию здоровья к управлению допущен, автомобиль технически исправен.
- **English.** The driver is fit to drive and the vehicle is technically sound.

- **Қазақша.** Жүргізуші: ________________ {driver:nom}
- **Русский.** Водитель: ________________ {driver:nom}
- **English.** Driver: ________________ {driver:nom}

---

## Акт инвентаризации склада

Раздел: Склад и логистика. Идентификатор: `warehouse-stocktaking-act`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Мына құрамдағы комиссия: {commission} – {stocktakingDate} «{warehouse}» қоймасында түгендеу жүргізді.
- **Русский.** Комиссия в составе: {commission} – провела {stocktakingDate} инвентаризацию склада «{warehouse}».
- **English.** A commission consisting of {commission} carried out a stocktaking of the “{warehouse}” warehouse on {stocktakingDate}.

- **Қазақша.** 1. Түгендеу нәтижелері: {results}
- **Русский.** 1. Результаты инвентаризации: {results}
- **English.** 1. Results: {results}

- **Қазақша.** 2. Комиссияның қорытындысы: {conclusion}
- **Русский.** 2. Выводы комиссии: {conclusion}
- **English.** 2. Conclusions of the commission: {conclusion}

- **Қазақша.** Комиссия мүшелері: ________________
- **Русский.** Члены комиссии: ________________
- **English.** Commission members: ________________

---

## Доверенность на получение товара

Раздел: Склад и логистика. Идентификатор: `warehouse-goods-poa`. Языки: ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Русский.** Доверитель: {@company.legalName}, БИН {@company.bin}, {@company.address}
- **English.** Principal: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}

- **Русский.** Поверенный: {employee:nom}, удостоверение личности № {idNumber}, выдано {idDate} {idIssuer}
- **English.** Attorney: {employee:nom}, ID card No. {idNumber} issued on {idDate} by {idIssuer}

- **Русский.** Поверенный уполномочен получить от {counterparty} по документу {basisDoc} следующие товарно-материальные ценности: {goods}
- **English.** The attorney is authorised to receive from {counterparty} under {basisDoc} the following goods: {goods}

- **Русский.** Доверенность действительна до {until}. Подпись поверенного ________________ удостоверяю.
- **English.** This power of attorney is valid until {until}. I certify the signature of the attorney ________________.

---

## Протокол совещания

Раздел: Административно-хозяйственный отдел. Идентификатор: `administration-meeting-minutes`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өткізілген күні: {meetingDate}. Төраға: {chair:nom}
- **Русский.** Дата: {meetingDate}. Председатель: {chair:nom}
- **English.** Date: {meetingDate}. Chair: {chair:nom}

- **Қазақша.** Қатысқандар: {attendees}
- **Русский.** Присутствовали: {attendees}
- **English.** Present: {attendees}

- **Қазақша.** Күн тәртібі: {agenda}
- **Русский.** Повестка: {agenda}
- **English.** Agenda: {agenda}

- **Қазақша.** ШЕШІМДЕР: {decisions}
- **Русский.** РЕШЕНИЯ: {decisions}
- **English.** DECISIONS: {decisions}

- **Қазақша.** Төраға: ________________ {chair:nom}
- **Русский.** Председатель: ________________ {chair:nom}
- **English.** Chair: ________________ {chair:nom}

---

## Номенклатура дел

Раздел: Административно-хозяйственный отдел. Идентификатор: `administration-file-list`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {year} жылға
- **Русский.** на {year} год
- **English.** for {year}

- **Қазақша.** Істер тізбесі: {files}
- **Русский.** Перечень дел: {files}
- **English.** List of files: {files}

- **Қазақша.** Номенклатура {year} жылғы 1 қаңтардан бастап қолданысқа енгізіледі.
- **Русский.** Номенклатура вводится в действие с 1 января {year} года.
- **English.** The list takes effect on 1 January {year}.

---

## Акт приёма-передачи дел

Раздел: Административно-хозяйственный отдел. Идентификатор: `administration-files-handover`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Біз, төменде қол қойғандар, {handedBy:nom} (тапсырушы) және {receivedBy:nom} (қабылдаушы), осы актіні жасадық. Тапсыру себебі: {reason}.
- **Русский.** Мы, нижеподписавшиеся, {handedBy:nom} (сдающий) и {receivedBy:nom} (принимающий), составили настоящий акт. Причина передачи: {reason}.
- **English.** We, the undersigned, {handedBy:nom} (handing over) and {receivedBy:nom} (receiving), have drawn up this certificate. Reason: {reason}.

- **Қазақша.** 1. Мына істер мен құжаттар тапсырылды: {files}
- **Русский.** 1. Переданы следующие дела и документы: {files}
- **English.** 1. The following files and documents have been handed over: {files}

- **Қазақша.** 2. Қабылдаушыда тапсырылған істердің құрамы мен жай-күйі бойынша ескертулер жоқ.
- **Русский.** 2. Замечаний к составу и состоянию переданных дел у принимающего нет.
- **English.** 2. The receiving party has no remarks on the content or condition of the files.

- **Қазақша.** Тапсырды: ________________ {handedBy:nom}
- **Қазақша.** Қабылдады: ________________ {receivedBy:nom}
- **Русский.** Сдал: ________________ {handedBy:nom}
- **Русский.** Принял: ________________ {receivedBy:nom}
- **English.** Handed over by: ________________ {handedBy:nom}
- **English.** Received by: ________________ {receivedBy:nom}

---

## Заявка на ремонт

Раздел: Административно-хозяйственный отдел. Идентификатор: `administration-repair-request`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өтініш беруші: {employee:nom}, {position}
- **Русский.** Заявитель: {employee:nom}, {position}
- **English.** Applicant: {employee:nom}, {position}

- **Қазақша.** 1. Мына жерде жөндеу жүргізуді сұраймын: {location}.
- **Русский.** 1. Прошу провести ремонт: {location}.
- **English.** 1. Please arrange a repair at: {location}.

- **Қазақша.** 2. Ақаудың сипаттамасы: {problem}
- **Русский.** 2. Описание неисправности: {problem}
- **English.** 2. Description of the fault: {problem}

- **Қазақша.** 3. Шұғылдығы: {urgency}.
- **Русский.** 3. Срочность: {urgency}.
- **English.** 3. Urgency: {urgency}.

- **Қазақша.** Өтініш беруші: ________________ {employee:nom}
- **Русский.** Заявитель: ________________ {employee:nom}
- **English.** Applicant: ________________ {employee:nom}

---

## Заявка на хозяйственные нужды

Раздел: Административно-хозяйственный отдел. Идентификатор: `administration-supplies-request`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өтініш беруші: {employee:nom}, {position}
- **Русский.** Заявитель: {employee:nom}, {position}
- **English.** Applicant: {employee:nom}, {position}

- **Қазақша.** 1. Шаруашылық қажеттіліктер үшін мыналарды беруді сұраймын: {items}
- **Русский.** 1. Прошу выдать для хозяйственных нужд: {items}
- **English.** 1. Please provide the following supplies: {items}

- **Қазақша.** 2. Мақсаты: {needFor}
- **Русский.** 2. Для чего: {needFor}
- **English.** 2. Purpose: {needFor}

- **Қазақша.** 3. Қажетті мерзімі – {neededBy} дейін.
- **Русский.** 3. Необходимо к {neededBy}.
- **English.** 3. Needed by {neededBy}.

- **Қазақша.** Өтініш беруші: ________________ {employee:nom}
- **Русский.** Заявитель: ________________ {employee:nom}
- **English.** Applicant: ________________ {employee:nom}

---

## Устав проекта

Раздел: Проекты. Идентификатор: `projects-charter`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жоба: {projectName}
- **Русский.** Проект: {projectName}
- **English.** Project: {projectName}

- **Қазақша.** Жоба жетекшісі: {manager:nom}
- **Русский.** Руководитель проекта: {manager:nom}
- **English.** Project manager: {manager:nom}

- **Қазақша.** Жобаның мақсаттары: {goals}
- **Русский.** Цели проекта: {goals}
- **English.** Goals: {goals}

- **Қазақша.** Жұмыстардың мазмұны: {scope}
- **Русский.** Содержание работ: {scope}
- **English.** Scope: {scope}

- **Қазақша.** Мерзімдері: {projectStart} – {projectEnd}. Бюджеті: {budget} теңге
- **Русский.** Сроки: {projectStart} – {projectEnd}. Бюджет: {budget} тенге
- **English.** Timeline: {projectStart} – {projectEnd}. Budget: KZT {budget}

- **Қазақша.** Негізгі тәуекелдер: {risks}
- **Русский.** Основные риски: {risks}
- **English.** Key risks: {risks}

---

## Техническое задание

Раздел: Проекты. Идентификатор: `projects-terms-of-reference`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жоба: {projectName}
- **Русский.** Проект: {projectName}
- **English.** Project: {projectName}

- **Қазақша.** Мақсаты мен негіздемесі: {background}
- **Русский.** Назначение и обоснование: {background}
- **English.** Purpose and rationale: {background}

- **Қазақша.** Нәтижеге қойылатын талаптар: {requirements}
- **Русский.** Требования к результату: {requirements}
- **English.** Requirements: {requirements}

- **Қазақша.** Тапсырылатын нәтижелер: {deliverables}
- **Русский.** Что передаётся по окончании: {deliverables}
- **English.** Deliverables: {deliverables}

- **Қазақша.** Орындау мерзімі: {deadline} дейін
- **Русский.** Срок выполнения: до {deadline}
- **English.** Deadline: {deadline}

- **Қазақша.** Қабылдау тәртібі: {acceptance}
- **Русский.** Порядок приёмки: {acceptance}
- **English.** Acceptance: {acceptance}

---

## Статус-отчёт по проекту

Раздел: Проекты. Идентификатор: `projects-status-report`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жоба: {projectName}
- **Русский.** Проект: {projectName}
- **English.** Project: {projectName}

- **Қазақша.** Кезең: {periodFrom} – {periodTo}. Жалпы мәртебе: {status}
- **Русский.** Период: {periodFrom} – {periodTo}. Общий статус: {status}
- **English.** Period: {periodFrom} – {periodTo}. Overall status: {status}

- **Қазақша.** Кезеңде орындалды: {done}
- **Русский.** Сделано за период: {done}
- **English.** Done: {done}

- **Қазақша.** Келесі кезеңге жоспар: {planned}
- **Русский.** План на следующий период: {planned}
- **English.** Next: {planned}

- **Қазақша.** Мәселелер мен тәуекелдер: {issues}
- **Русский.** Проблемы и риски: {issues}
- **English.** Issues and risks: {issues}

- **Қазақша.** Жоба жетекшісі: ________________ {manager:nom}
- **Русский.** Руководитель проекта: ________________ {manager:nom}
- **English.** Project manager: ________________ {manager:nom}

---

## Акт приёмки результатов проекта

Раздел: Проекты. Идентификатор: `projects-acceptance-act`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Комиссия «{projectName}» жобасының нәтижелерін қарап, осы актіні жасады.
- **Русский.** Комиссия, рассмотрев результаты проекта «{projectName}», составила настоящий акт.
- **English.** Having reviewed the results of the project “{projectName}”, the commission has drawn up this certificate.

- **Қазақша.** 1. Алынған нәтижелер: {results}
- **Русский.** 1. Получены результаты: {results}
- **English.** 1. Results achieved: {results}

- **Қазақша.** 2. Ескертулер: {remarks}
- **Русский.** 2. Замечания: {remarks}
- **English.** 2. Remarks: {remarks}

- **Қазақша.** 3. Жоба нәтижелері қабылданды, жоба жабылды деп танылады.
- **Русский.** 3. Результаты проекта приняты, проект считается закрытым.
- **English.** 3. The project results are accepted and the project is closed.

- **Қазақша.** Жоба жетекшісі: ________________ {manager:nom}
- **Қазақша.** Комиссия мүшелері: ________________
- **Русский.** Руководитель проекта: ________________ {manager:nom}
- **Русский.** Члены комиссии: ________________
- **English.** Project manager: ________________ {manager:nom}
- **English.** Commission members: ________________

---

## Заявка на ИТ-обслуживание

Раздел: ИТ и информационная безопасность. Идентификатор: `it-security-service-request`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өтініш беруші: {employee:nom}, {position}
- **Русский.** Заявитель: {employee:nom}, {position}
- **English.** Applicant: {employee:nom}, {position}

- **Қазақша.** 1. Мына жабдыққа (жүйеге) қызмет көрсетуді сұраймын: {equipment}.
- **Русский.** 1. Прошу выполнить обслуживание: {equipment}.
- **English.** 1. Please service: {equipment}.

- **Қазақша.** 2. Мәселенің сипаттамасы: {problem}
- **Русский.** 2. Описание проблемы: {problem}
- **English.** 2. Description of the issue: {problem}

- **Қазақша.** 3. Шұғылдығы: {urgency}.
- **Русский.** 3. Срочность: {urgency}.
- **English.** 3. Urgency: {urgency}.

- **Қазақша.** Өтініш беруші: ________________ {employee:nom}
- **Русский.** Заявитель: ________________ {employee:nom}
- **English.** Applicant: ________________ {employee:nom}

---

## Акт приёма-передачи техники работнику

Раздел: ИТ и информационная безопасность. Идентификатор: `it-security-equipment-handover`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Қызметкер {employee:nom} ({position}) {@company.legalNameKk} ұйымынан жұмыста пайдалану үшін мына техниканы алды.
- **Русский.** {@company.legalName} передаёт работнику {employee:nom} ({position}) для использования в работе следующую технику.
- **English.** {@company.legalNameEn} hands over to the employee {employee:nom} ({position}) the following equipment for work use.

- **Қазақша.** 1. Техника тізбесі: {equipmentList}
- **Русский.** 1. Перечень техники: {equipmentList}
- **English.** 1. Equipment: {equipmentList}

- **Қазақша.** 2. Техника жарамды күйде берілді. Қызметкер оның сақталуына жауап береді және жұмыстан босатылғанда оны қайтарады.
- **Русский.** 2. Техника передана в исправном состоянии. Работник отвечает за её сохранность и возвращает её при увольнении.
- **English.** 2. The equipment is handed over in working order. The employee is responsible for keeping it safe and returns it on leaving the company.

- **Қазақша.** Тапсырды: ________________ {handedBy:nom}
- **Қазақша.** Қабылдады: ________________ {employee:nom}
- **Русский.** Передал: ________________ {handedBy:nom}
- **Русский.** Принял: ________________ {employee:nom}
- **English.** Handed over by: ________________ {handedBy:nom}
- **English.** Received by: ________________ {employee:nom}

---

## Заявка на предоставление доступа

Раздел: ИТ и информационная безопасность. Идентификатор: `it-security-access-request`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Өтініш беруші: {employee:nom}, {position}
- **Русский.** Заявитель: {employee:nom}, {position}
- **English.** Applicant: {employee:nom}, {position}

- **Қазақша.** 1. Қызметкер {forWhom:nom} үшін мына жүйелерге қолжетімділік беруді сұраймын: {systems}
- **Русский.** 1. Прошу предоставить работнику {forWhom:nom} доступ к системам: {systems}
- **English.** 1. Please grant {forWhom:nom} access to: {systems}

- **Қазақша.** 2. Мақсаты: {reason}
- **Русский.** 2. Для чего: {reason}
- **English.** 2. Purpose: {reason}

- **Қазақша.** 3. Қолжетімділік мерзімі – {accessUntil} дейін.
- **Русский.** 3. Срок доступа – до {accessUntil}.
- **English.** 3. Access until {accessUntil}.

- **Қазақша.** Өтініш беруші: ________________ {employee:nom}
- **Русский.** Заявитель: ________________ {employee:nom}
- **English.** Applicant: ________________ {employee:nom}

---

## Политика информационной безопасности

Раздел: ИТ и информационная безопасность. Идентификатор: `it-security-policy`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** БЕКІТІЛДІ {approvalDate} № {approvalOrder} бұйрығымен
- **Русский.** УТВЕРЖДЕНО приказом от {approvalDate} № {approvalOrder}
- **English.** APPROVED by order No. {approvalOrder} dated {approvalDate}

- **Қазақша.** 1. Жалпы ережелер
- **Русский.** 1. Общие положения
- **English.** 1. General provisions

- **Қазақша.** 1.1. Саясат Компанияның ақпаратын қорғау қағидаларын белгілейді және барлық қызметкерлер үшін міндетті.
- **Русский.** 1.1. Политика устанавливает правила защиты информации Компании и обязательна для всех работников.
- **English.** 1.1. This policy sets the rules for protecting the Company’s information and is binding on all employees.

- **Қазақша.** 1.2. Ақпараттық қауіпсіздікке жауапты – {securityOfficer:nom}.
- **Русский.** 1.2. Ответственный за информационную безопасность – {securityOfficer:nom}.
- **English.** 1.2. The information security officer is {securityOfficer:nom}.

- **Қазақша.** 2. Қолжетімділік
- **Русский.** 2. Доступ
- **English.** 2. Access

- **Қазақша.** 2.1. Қолжетімділік жұмысқа қажетті көлемде ғана беріледі. Есептік жазба дербес, оны басқа адамға беруге болмайды.
- **Русский.** 2.1. Доступ предоставляется только в объёме, необходимом для работы. Учётная запись персональна и не передаётся другим лицам.
- **English.** 2.1. Access is granted only to the extent needed for the job. Accounts are personal and must not be shared.

- **Қазақша.** 2.2. Құпиясөз кемінде {passwordDays} күнде бір рет ауыстырылады және ешкімге айтылмайды.
- **Русский.** 2.2. Пароль меняется не реже одного раза в {passwordDays} дней и никому не сообщается.
- **English.** 2.2. Passwords are changed at least every {passwordDays} days and are never disclosed.

- **Қазақша.** 3. Деректерді қорғау
- **Русский.** 3. Защита данных
- **English.** 3. Data protection

- **Қазақша.** 3.1. Құпия ақпарат жеке мессенджерлер мен жеке поштаға жіберілмейді. Маңызды деректердің сақтық көшірмесі жасалады.
- **Русский.** 3.1. Конфиденциальная информация не пересылается через личные мессенджеры и личную почту. Важные данные резервируются.
- **English.** 3.1. Confidential information is not sent via personal messengers or personal e-mail. Important data is backed up.

- **Қазақша.** 4. Оқиғалар
- **Русский.** 4. Инциденты
- **English.** 4. Incidents

- **Қазақша.** 4.1. Күдікті хат, вирус, құрылғының жоғалуы немесе рұқсатсыз кіру туралы {securityOfficer:nom} дереу хабардар етіледі.
- **Русский.** 4.1. О подозрительном письме, вирусе, утере устройства или несанкционированном доступе немедленно сообщается {securityOfficer:nom}.
- **English.** 4.1. Suspicious e-mails, viruses, lost devices or unauthorised access are reported to {securityOfficer:nom} immediately.

- **Қазақша.** 5. Жауапкершілік
- **Русский.** 5. Ответственность
- **English.** 5. Responsibility

- **Қазақша.** 5.1. Саясатты бұзғаны үшін қызметкерлер Қазақстан Республикасының заңнамасына сәйкес жауап береді.
- **Русский.** 5.1. За нарушение Политики работники несут ответственность в соответствии с законодательством Республики Казахстан.
- **English.** 5.1. Employees are liable for breaches of this policy under the legislation of the Republic of Kazakhstan.

---

## Журнал вводного инструктажа

Раздел: Охрана труда и экология. Идентификатор: `hse-induction-log`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Нұсқама күні: {briefingDate}. Нұсқаманы жүргізген: {instructor:nom}
- **Русский.** Дата инструктажа: {briefingDate}. Провёл: {instructor:nom}
- **English.** Date: {briefingDate}. Conducted by: {instructor:nom}

- **Қазақша.** Бағдарлама: {program}
- **Русский.** Программа: {program}
- **English.** Programme: {program}

- **Қазақша.** Нұсқамадан өткендер: {entries}
- **Русский.** Прошли инструктаж: {entries}
- **English.** Briefed: {entries}

- **Қазақша.** Нұсқаманы жүргізген: ________________ {instructor:nom}
- **Русский.** Провёл: ________________ {instructor:nom}
- **English.** Conducted by: ________________ {instructor:nom}

---

## Наряд-допуск на работы повышенной опасности

Раздел: Охрана труда и экология. Идентификатор: `hse-work-permit`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жұмыс жетекшісі: {supervisor:nom}
- **Русский.** Ответственный руководитель работ: {supervisor:nom}
- **English.** Work supervisor: {supervisor:nom}

- **Қазақша.** Жұмыс орны: {workPlace}
- **Русский.** Место работ: {workPlace}
- **English.** Work location: {workPlace}

- **Қазақша.** Жұмыстардың мазмұны: {workDescription}
- **Русский.** Содержание работ: {workDescription}
- **English.** Work to be done: {workDescription}

- **Қазақша.** Бригада құрамы: {crew}
- **Русский.** Состав бригады: {crew}
- **English.** Crew: {crew}

- **Қазақша.** Қауіпсіздік шаралары: {safetyMeasures}
- **Русский.** Меры безопасности: {safetyMeasures}
- **English.** Safety measures: {safetyMeasures}

- **Қазақша.** Жұмыс мерзімі: {workStart} – {workEnd}
- **Русский.** Срок работ: {workStart} – {workEnd}
- **English.** Period: {workStart} – {workEnd}

- **Қазақша.** Жұмыс жетекшісі: ________________ {supervisor:nom}
- **Русский.** Руководитель работ: ________________ {supervisor:nom}
- **English.** Supervisor: ________________ {supervisor:nom}

---

## Акт о несчастном случае

Раздел: Охрана труда и экология. Идентификатор: `hse-accident-act`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Мына құрамдағы комиссия: {commission} – {accidentDate} болған жазатайым оқиғаны тексерді.
- **Русский.** Комиссия в составе: {commission} – расследовала несчастный случай, произошедший {accidentDate}.
- **English.** A commission consisting of {commission} investigated the accident of {accidentDate}.

- **Қазақша.** 1. Зардап шегуші: {victim:nom}, {position}. Оқиға орны: {place}.
- **Русский.** 1. Пострадавший: {victim:nom}, {position}. Место происшествия: {place}.
- **English.** 1. Injured person: {victim:nom}, {position}. Place: {place}.

- **Қазақша.** 2. Мән-жайлары: {circumstances}
- **Русский.** 2. Обстоятельства: {circumstances}
- **English.** 2. Circumstances: {circumstances}

- **Қазақша.** 3. Себептері: {causes}
- **Русский.** 3. Причины: {causes}
- **English.** 3. Causes: {causes}

- **Қазақша.** 4. Себептерді жою шаралары: {measures}
- **Русский.** 4. Меры по устранению причин: {measures}
- **English.** 4. Corrective measures: {measures}

- **Қазақша.** Комиссия мүшелері: ________________
- **Русский.** Члены комиссии: ________________
- **English.** Commission members: ________________

---

## Инструкция о мерах пожарной безопасности

Раздел: Охрана труда и экология. Идентификатор: `hse-fire-instruction`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** БЕКІТІЛДІ {approvalDate} № {approvalOrder} бұйрығымен
- **Русский.** УТВЕРЖДЕНО приказом от {approvalDate} № {approvalOrder}
- **English.** APPROVED by order No. {approvalOrder} dated {approvalDate}

- **Қазақша.** 1. Жалпы ережелер
- **Русский.** 1. Общие положения
- **English.** 1. General provisions

- **Қазақша.** 1.1. Нұсқаулық Компанияның барлық қызметкерлері мен келушілері үшін міндетті. Өрт қауіпсіздігіне жауапты – {fireOfficer:nom}.
- **Русский.** 1.1. Инструкция обязательна для всех работников и посетителей Компании. Ответственный за пожарную безопасность – {fireOfficer:nom}.
- **English.** 1.1. This instruction is binding on all employees and visitors of the Company. The fire safety officer is {fireOfficer:nom}.

- **Қазақша.** 2. Өрттің алдын алу
- **Русский.** 2. Предупреждение пожара
- **English.** 2. Fire prevention

- **Қазақша.** 2.1. Эвакуациялық жолдар мен шығулар бос ұсталады. Ақаулы розеткаларды пайдалануға және жылытқыштарды қараусыз қалдыруға тыйым салынады.
- **Русский.** 2.1. Эвакуационные пути и выходы держатся свободными. Запрещается пользоваться неисправными розетками и оставлять обогреватели без присмотра.
- **English.** 2.1. Escape routes and exits are kept clear. Faulty sockets must not be used and heaters must not be left unattended.

- **Қазақша.** 2.2. Темекі тек белгіленген жерде шегіледі: {smokingPlace}.
- **Русский.** 2.2. Курение допускается только в отведённом месте: {smokingPlace}.
- **English.** 2.2. Smoking is allowed only in the designated place: {smokingPlace}.

- **Қазақша.** 3. Өрт кезіндегі әрекеттер
- **Русский.** 3. Действия при пожаре
- **English.** 3. In case of fire

- **Қазақша.** 3.1. 101 немесе 112 нөміріне қоңырау шалу, адамдарды эвакуациялау, қауіпсіз болса – өрт сөндіргішті пайдалану, {fireOfficer:nom} хабардар ету.
- **Русский.** 3.1. Позвонить по номеру 101 или 112, эвакуировать людей, если безопасно – применить огнетушитель, сообщить {fireOfficer:nom}.
- **English.** 3.1. Call 101 or 112, evacuate people, use an extinguisher if it is safe, and inform {fireOfficer:nom}.

- **Қазақша.** 4. Жауапкершілік
- **Русский.** 4. Ответственность
- **English.** 4. Responsibility

- **Қазақша.** 4.1. Нұсқаулықты бұзғаны үшін қызметкерлер Қазақстан Республикасының заңнамасына сәйкес жауап береді.
- **Русский.** 4.1. За нарушение Инструкции работники несут ответственность в соответствии с законодательством Республики Казахстан.
- **English.** 4.1. Employees are liable for breaches of this instruction under the legislation of the Republic of Kazakhstan.

---

## Бриф на рекламу

Раздел: Маркетинг. Идентификатор: `marketing-brief`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Жарнама нысаны: {product}
- **Русский.** Что рекламируем: {product}
- **English.** Product: {product}

- **Қазақша.** Мақсатты аудитория: {audience}
- **Русский.** Целевая аудитория: {audience}
- **English.** Target audience: {audience}

- **Қазақша.** Науқанның мақсаттары: {goals}
- **Русский.** Цели кампании: {goals}
- **English.** Campaign goals: {goals}

- **Қазақша.** Арналар: {channels}
- **Русский.** Каналы: {channels}
- **English.** Channels: {channels}

- **Қазақша.** Мерзімдері: {campaignStart} – {campaignEnd}. Бюджеті: {budget} теңге
- **Русский.** Сроки: {campaignStart} – {campaignEnd}. Бюджет: {budget} тенге
- **English.** Timeline: {campaignStart} – {campaignEnd}. Budget: KZT {budget}

---

## Договор с рекламным агентством

Раздел: Маркетинг. Идентификатор: `marketing-agency-contract`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** {@company.legalNameKk}, бұдан әрі «Тапсырыс беруші» деп аталатын, {@company.directorTitleKk} {@company.directorName} атынан, бір тараптан, және {counterparty}, бұдан әрі «Агенттік» деп аталатын, {counterpartySigner} атынан, екінші тараптан, бірлесіп «Тараптар» деп аталатындар, төмендегілер туралы осы шартты жасасты:
- **Русский.** {@company.legalName}, именуемое в дальнейшем «Заказчик», в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}, с одной стороны, и {counterparty}, именуемое в дальнейшем «Агентство», в лице {counterpartySigner}, с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем:
- **English.** {@company.legalNameEn}, hereinafter the “Customer”, represented by {@company.directorTitleEn} {@company.directorNameEn}, on the one part, and {counterparty}, hereinafter the “Agency”, represented by {counterpartySigner}, on the other part, together the “Parties”, have concluded this contract as follows:

- **Қазақша.** 1. Агенттік Тапсырыс беруші үшін мына жарнамалық қызметтерді көрсетуге міндеттенеді: {services}
- **Русский.** 1. Агентство обязуется оказать Заказчику следующие рекламные услуги: {services}
- **English.** 1. The Agency undertakes to provide the Customer with the following advertising services: {services}

- **Қазақша.** 2. Қызметтер {campaignStart} бастап {campaignEnd} дейін көрсетіледі.
- **Русский.** 2. Услуги оказываются с {campaignStart} по {campaignEnd}.
- **English.** 2. The services are provided from {campaignStart} to {campaignEnd}.

- **Қазақша.** 3. Қызметтердің құны {amount} ({amountWords}) теңге. Төлем тәртібі: {paymentTerms}.
- **Русский.** 3. Стоимость услуг – {amount} ({amountWords}) тенге. Порядок оплаты: {paymentTerms}.
- **English.** 3. The cost of the services is KZT {amount} ({amountWords}). Payment terms: {paymentTerms}.

- **Қазақша.** 4. Жарнамалық материалдар жарияланғанға дейін Тапсырыс берушімен келісіледі. Жарнаманың заңнамаға сәйкестігіне Агенттік жауап береді.
- **Русский.** 4. Рекламные материалы согласуются с Заказчиком до размещения. За соответствие рекламы законодательству отвечает Агентство.
- **English.** 4. Advertising materials are approved by the Customer before placement. The Agency is responsible for compliance of the advertising with the law.

- **Қазақша.** 5. Қызмет көрсету барысында жасалған материалдарға айрықша құқықтар Тапсырыс берушіге өтеді.
- **Русский.** 5. Исключительные права на материалы, созданные при оказании услуг, переходят к Заказчику.
- **English.** 5. Exclusive rights to materials created under this contract pass to the Customer.

- **Қазақша.** 6. Шарт Тараптар қол қойған күннен бастап күшіне енеді және {validUntil} дейін қолданылады.
- **Русский.** 6. Договор вступает в силу с даты подписания Сторонами и действует до {validUntil}.
- **English.** 6. The contract enters into force on the date of signing by the Parties and remains in effect until {validUntil}.

- **Қазақша.** 7. Даулар келіссөздер арқылы, ал келісімге қол жеткізілмесе, Қазақстан Республикасының заңнамасына сәйкес сот тәртібімен шешіледі.
- **Русский.** 7. Споры разрешаются путём переговоров, а при недостижении согласия – в судебном порядке по законодательству Республики Казахстан.
- **English.** 7. Disputes are settled by negotiation and, failing agreement, in court under the legislation of the Republic of Kazakhstan.

- **Қазақша.** 8. Шарт қазақ, орыс және ағылшын тілдерінде бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан.
- **Русский.** 8. Договор составлен на казахском, русском и английском языках в двух экземплярах равной юридической силы, по одному для каждой Стороны.
- **English.** 8. The contract is made in Kazakh, Russian and English in two counterparts of equal legal force, one for each Party.

- **Қазақша.** Тараптардың деректемелері: {@company.legalNameKk}, БСН {@company.bin}, {@company.address}. {counterparty}, БСН {counterpartyBin}.
- **Русский.** Реквизиты сторон: {@company.legalName}, БИН {@company.bin}, {@company.address}. {counterparty}, БИН {counterpartyBin}.
- **English.** Details of the parties: {@company.legalNameEn}, BIN {@company.bin}, {@company.addressEn}. {counterparty}, BIN {counterpartyBin}.

- **Қазақша.** Агенттік: ________________ {counterpartySigner}
- **Русский.** Агентство: ________________ {counterpartySigner}
- **English.** Agency: ________________ {counterpartySigner}

---

## Отчёт о рекламной кампании

Раздел: Маркетинг. Идентификатор: `marketing-campaign-report`. Языки: kk, ru, en.

**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.

### Текст

- **Қазақша.** Науқан: {campaign}
- **Русский.** Кампания: {campaign}
- **English.** Campaign: {campaign}

- **Қазақша.** Кезең: {periodFrom} – {periodTo}
- **Русский.** Период: {periodFrom} – {periodTo}
- **English.** Period: {periodFrom} – {periodTo}

- **Қазақша.** Жұмсалды: {spent} теңге
- **Русский.** Израсходовано: {spent} тенге
- **English.** Spent: KZT {spent}

- **Қазақша.** Нәтижелер: {results}
- **Русский.** Результаты: {results}
- **English.** Results: {results}

- **Қазақша.** Қорытындылар мен ұсыныстар: {conclusions}
- **Русский.** Выводы и предложения: {conclusions}
- **English.** Conclusions and proposals: {conclusions}

- **Қазақша.** Дайындаған: ________________ {author:nom}
- **Русский.** Подготовил: ________________ {author:nom}
- **English.** Prepared by: ________________ {author:nom}
