/**
 * Типовые шаблоны: кадры, юристы, корпоративное управление, финансы.
 *
 * Образца от компании для них нет – текст собран по распространённым
 * образцам и помечен как неконкретный (`generic`). Что это значит и почему
 * так – в `generic.ts`. Текст черновой: проверяет юрист (docs/legal-review.md).
 */
import {
  CAPTION,
  COMPANY,
  amountWords,
  contract,
  field,
  labourAgreement,
  letter,
  listDocument,
  policy,
  request,
  act,
} from '@/api/mock/generic';

import type { DocumentTemplate } from '@/api/types';

const [CO_KK, CO_RU, CO_EN] = COMPANY;

const COUNTERPARTY_SIGNER = field.tri('counterpartySigner', 'Подписант контрагента', 'Стороны', {
  hint: 'Должность и ФИО в том виде, как они стоят в договоре',
});

export const genericTemplatesA: DocumentTemplate[] = [
  /* ═══ Кадры ═══════════════════════════════════════════════════════════ */

  labourAgreement({
    id: 'hr-employment-contract',
    title: 'Трудовой договор',
    sectionId: 'hr',
    subsectionId: 'hr-documents',
    series: 'ТД',
    profile: 'sensitive',
    purpose: 'Типовой трудовой договор: должность, срок, оплата, режим работы и отпуск.',
    words: ['ЕҢБЕК ШАРТЫ', 'ТРУДОВОЙ ДОГОВОР', 'EMPLOYMENT CONTRACT'],
    fields: [
      field.tri('position', 'Должность', 'Работа'),
      field.date('startDate', 'Дата начала работы', 'Работа'),
      field.tri('contractTerm', 'Срок договора', 'Работа', {
        hint: 'Как в договоре: на неопределённый срок, на один год',
      }),
      field.tri('probation', 'Испытательный срок', 'Работа', {
        hint: 'Например: три месяца; без испытательного срока',
      }),
      field.money('salary', 'Должностной оклад', 'Оплата', { hint: 'В месяц, до удержаний' }),
      amountWords('salaryWords', 'Оплата'),
      field.tri('workSchedule', 'Режим работы', 'Условия', {
        hint: 'Например: пятидневная рабочая неделя с 9:00 до 18:00',
      }),
      field.number('vacationDays', 'Ежегодный отпуск', 'Условия', { unit: 'кал. дней' }),
    ],
    clauses: [
      [
        'Жұмыс беруші Қызметкерді {position} лауазымына қабылдайды, ал Қызметкер осы шартта көзделген еңбек міндеттерін орындауға міндеттенеді.',
        'Работодатель принимает Работника на должность {position}, а Работник обязуется выполнять трудовые обязанности, предусмотренные настоящим договором.',
        'The Employer hires the Employee for the position of {position}, and the Employee undertakes to perform the duties set out in this contract.',
      ],
      [
        'Жұмысқа кіріскен күн – {startDate}. Шарттың мерзімі: {contractTerm}. Сынақ мерзімі: {probation}.',
        'Дата начала работы – {startDate}. Срок договора: {contractTerm}. Испытательный срок: {probation}.',
        'Start date: {startDate}. Term of the contract: {contractTerm}. Probation period: {probation}.',
      ],
      [
        'Қызметкерге ұстап қалуларға дейін айына {salary} ({salaryWords}) теңге мөлшерінде лауазымдық жалақы белгіленеді. Жалақы айына кемінде бір рет төленеді.',
        'Работнику устанавливается должностной оклад {salary} ({salaryWords}) тенге в месяц до удержаний. Заработная плата выплачивается не реже одного раза в месяц.',
        'The Employee is paid a monthly salary of KZT {salary} ({salaryWords}) before deductions. Salary is paid at least once a month.',
      ],
      ['Жұмыс режимі: {workSchedule}.', 'Режим работы: {workSchedule}.', 'Working hours: {workSchedule}.'],
      [
        'Қызметкерге ұзақтығы {vacationDays} күнтізбелік күн жыл сайынғы ақы төленетін еңбек демалысы беріледі.',
        'Работнику предоставляется ежегодный оплачиваемый трудовой отпуск продолжительностью {vacationDays} календарных дней.',
        'The Employee is entitled to annual paid leave of {vacationDays} calendar days.',
      ],
      [
        'Қызметкер еңбек тәртібін, еңбекті қорғау талаптарын сақтауға және Жұмыс берушінің коммерциялық құпиясын жария етпеуге міндетті.',
        'Работник обязан соблюдать трудовую дисциплину, требования охраны труда и не разглашать коммерческую тайну Работодателя.',
        'The Employee shall observe labour discipline and occupational safety rules and shall not disclose the Employer’s trade secrets.',
      ],
      [
        'Шарт бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан. Шартта реттелмеген мәселелер Қазақстан Республикасының еңбек заңнамасымен реттеледі.',
        'Договор составлен в двух экземплярах равной юридической силы, по одному для каждой Стороны. Вопросы, не урегулированные договором, регулируются трудовым законодательством Республики Казахстан.',
        'The contract is made in two counterparts of equal force, one for each Party. Matters not covered here are governed by the labour legislation of the Republic of Kazakhstan.',
      ],
    ],
  }),

  labourAgreement({
    id: 'hr-labour-amendment',
    title: 'Дополнительное соглашение к трудовому договору',
    sectionId: 'hr',
    subsectionId: 'hr-documents',
    series: 'ТД',
    profile: 'sensitive',
    purpose: 'Меняет условия трудового договора: должность, оклад, режим работы.',
    words: [
      'ЕҢБЕК ШАРТЫНА ҚОСЫМША КЕЛІСІМ',
      'ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ К ТРУДОВОМУ ДОГОВОРУ',
      'SUPPLEMENTARY AGREEMENT TO THE EMPLOYMENT CONTRACT',
    ],
    fields: [
      field.text('contractNumber', 'Номер трудового договора', 'Основание'),
      field.date('contractDate', 'Дата трудового договора', 'Основание', {
        dateLimits: { notAfter: 'today' },
      }),
      field.area('changes', 'Что изменяется', 'Изменения', {
        hint: 'Новая редакция пункта: должность, оклад, режим работы',
      }),
      field.date('effectiveDate', 'Действует с', 'Изменения'),
    ],
    clauses: [
      [
        'Тараптар {contractDate} № {contractNumber} еңбек шартына мынадай өзгерістер енгізуге келісті: {changes}',
        'Стороны договорились внести в трудовой договор № {contractNumber} от {contractDate} следующие изменения: {changes}',
        'The Parties have agreed to amend employment contract No. {contractNumber} dated {contractDate} as follows: {changes}',
      ],
      [
        'Өзгерістер {effectiveDate} бастап қолданылады.',
        'Изменения применяются с {effectiveDate}.',
        'The changes apply from {effectiveDate}.',
      ],
      [
        'Еңбек шартының осы келісіммен өзгертілмеген талаптары бұрынғы редакцияда қолданылады.',
        'Условия трудового договора, не изменённые настоящим соглашением, действуют в прежней редакции.',
        'Terms of the employment contract not amended by this agreement remain unchanged.',
      ],
      [
        'Келісім еңбек шартының ажырамас бөлігі болып табылады және екі данада жасалды.',
        'Соглашение является неотъемлемой частью трудового договора и составлено в двух экземплярах.',
        'This agreement forms an integral part of the employment contract and is made in two counterparts.',
      ],
    ],
  }),

  policy({
    id: 'hr-job-description',
    title: 'Должностная инструкция',
    sectionId: 'hr',
    subsectionId: 'hr-documents',
    series: 'ОД',
    purpose: 'Обязанности, права и ответственность работника на должности.',
    words: ['ЛАУАЗЫМДЫҚ НҰСҚАУЛЫҚ', 'ДОЛЖНОСТНАЯ ИНСТРУКЦИЯ', 'JOB DESCRIPTION'],
    fields: [
      field.tri('position', 'Должность', 'Должность'),
      field.tri('unit', 'Подразделение', 'Должность'),
      field.tri('reportsTo', 'Кому подчиняется', 'Должность', {
        hint: 'На казахском – в дательном падеже: бас директорға',
      }),
      field.area('qualification', 'Требования к квалификации', 'Должность', {
        hint: 'Образование, опыт работы, знания',
      }),
      field.area('duties', 'Должностные обязанности', 'Обязанности', {
        hint: 'По одной на строку',
      }),
    ],
    sections: [
      {
        title: ['Жалпы ережелер', 'Общие положения', 'General provisions'],
        clauses: [
          [
            '{position} – {unit} қызметкері, {reportsTo} бағынады.',
            '{position} является работником подразделения «{unit}» и подчиняется {reportsTo}.',
            'The {position} is an employee of the {unit} and reports to {reportsTo}.',
          ],
          [
            'Біліктілік талаптары: {qualification}',
            'Требования к квалификации: {qualification}',
            'Qualification requirements: {qualification}',
          ],
        ],
      },
      {
        title: ['Лауазымдық міндеттер', 'Должностные обязанности', 'Duties'],
        clauses: [['{duties}', '{duties}', '{duties}']],
      },
      {
        title: ['Құқықтар', 'Права', 'Rights'],
        clauses: [
          [
            'Міндеттерін орындауға қажетті ақпарат пен құжаттарды алуға, жұмысты жетілдіру бойынша ұсыныстар енгізуге құқылы.',
            'Имеет право получать информацию и документы, необходимые для выполнения обязанностей, и вносить предложения по улучшению работы.',
            'May receive the information and documents needed to perform the duties and propose improvements to the work.',
          ],
        ],
      },
      {
        title: ['Жауапкершілік', 'Ответственность', 'Responsibility'],
        clauses: [
          [
            'Міндеттерін орындамағаны немесе тиісінше орындамағаны үшін Қазақстан Республикасының заңнамасында белгіленген тәртіппен жауап береді.',
            'Несёт ответственность за неисполнение или ненадлежащее исполнение обязанностей в порядке, установленном законодательством Республики Казахстан.',
            'Is liable for failure to perform or improper performance of the duties as provided by the legislation of the Republic of Kazakhstan.',
          ],
        ],
      },
    ],
  }),

  labourAgreement({
    id: 'hr-nda',
    title: 'Соглашение о неразглашении (NDA)',
    sectionId: 'hr',
    subsectionId: 'hr-documents',
    series: 'ТД',
    purpose: 'Обязательство работника не разглашать конфиденциальную информацию компании.',
    words: ['ҚҰПИЯЛЫЛЫҚ ТУРАЛЫ КЕЛІСІМ', 'СОГЛАШЕНИЕ О НЕРАЗГЛАШЕНИИ', 'NON-DISCLOSURE AGREEMENT'],
    fields: [
      field.area('confidentialScope', 'Что относится к конфиденциальной информации', 'Условия', {
        hint: 'Например: сведения о клиентах, ценах, технологиях',
      }),
      field.number('termYears', 'Срок после увольнения', 'Условия', { unit: 'лет' }),
    ],
    clauses: [
      [
        'Қызметкер еңбек міндеттерін орындау кезінде белгілі болған құпия ақпаратты жария етпеуге міндеттенеді. Құпия ақпаратқа мыналар жатады: {confidentialScope}',
        'Работник обязуется не разглашать конфиденциальную информацию, ставшую ему известной при исполнении трудовых обязанностей. К конфиденциальной информации относятся: {confidentialScope}',
        'The Employee undertakes not to disclose confidential information learned in the course of employment. Confidential information includes: {confidentialScope}',
      ],
      [
        'Құпия ақпарат тек еңбек міндеттерін орындау үшін пайдаланылады; оны үшінші тұлғаларға беруге Жұмыс берушінің жазбаша келісімімен ғана жол беріледі.',
        'Конфиденциальная информация используется только для исполнения трудовых обязанностей; передача её третьим лицам допускается лишь с письменного согласия Работодателя.',
        'Confidential information may be used only to perform the duties; disclosure to third parties requires the Employer’s written consent.',
      ],
      [
        'Еңбек шарты тоқтатылған кезде Қызметкер құпия ақпараты бар барлық материалдарды қайтарады.',
        'При прекращении трудового договора Работник возвращает все материалы, содержащие конфиденциальную информацию.',
        'On termination of employment the Employee returns all materials containing confidential information.',
      ],
      [
        'Міндеттеме еңбек шарты қолданылатын бүкіл мерзім ішінде және ол тоқтатылғаннан кейін {termYears} жыл бойы күшінде болады.',
        'Обязательство действует в течение всего срока трудового договора и {termYears} лет после его прекращения.',
        'The obligation remains in force throughout the employment and for {termYears} years after its termination.',
      ],
      [
        'Келісімді бұзғаны үшін Қызметкер Қазақстан Республикасының заңнамасына сәйкес жауап береді.',
        'За нарушение соглашения Работник несёт ответственность в соответствии с законодательством Республики Казахстан.',
        'The Employee is liable for breach of this agreement under the legislation of the Republic of Kazakhstan.',
      ],
    ],
  }),

  policy({
    id: 'hr-labour-rules',
    title: 'Правила трудового распорядка',
    sectionId: 'hr',
    subsectionId: 'hr-policies',
    series: 'ОД',
    purpose: 'Рабочее время, обязанности работников и работодателя, поощрения и взыскания.',
    words: [
      'ІШКІ ЕҢБЕК ТӘРТІБІНІҢ ЕРЕЖЕЛЕРІ',
      'ПРАВИЛА ТРУДОВОГО РАСПОРЯДКА',
      'INTERNAL LABOUR REGULATIONS',
    ],
    fields: [
      field.tri('workWeek', 'Рабочая неделя', 'Рабочее время', {
        hint: 'Например: пятидневная, суббота и воскресенье – выходные',
      }),
      field.text('workStart', 'Начало рабочего дня', 'Рабочее время', { hint: 'Например: 9:00' }),
      field.text('workEnd', 'Окончание рабочего дня', 'Рабочее время', { hint: 'Например: 18:00' }),
      field.text('lunch', 'Перерыв на обед', 'Рабочее время', { hint: 'Например: 13:00–14:00' }),
    ],
    sections: [
      {
        title: ['Жалпы ережелер', 'Общие положения', 'General provisions'],
        clauses: [
          [
            'Осы Ережелер Компанияның ішкі еңбек тәртібін белгілейді және барлық қызметкерлер үшін міндетті.',
            'Настоящие Правила устанавливают внутренний трудовой распорядок Компании и обязательны для всех работников.',
            'These Regulations set the internal labour order of the Company and are binding on all employees.',
          ],
        ],
      },
      {
        title: ['Жұмыс уақыты', 'Рабочее время', 'Working time'],
        clauses: [
          ['Жұмыс аптасы: {workWeek}.', 'Рабочая неделя: {workWeek}.', 'Working week: {workWeek}.'],
          [
            'Жұмыс уақыты {workStart} бастап {workEnd} дейін, түскі үзіліс {lunch}.',
            'Рабочее время с {workStart} до {workEnd}, перерыв на обед {lunch}.',
            'Working hours are from {workStart} to {workEnd}, with a lunch break at {lunch}.',
          ],
        ],
      },
      {
        title: ['Қызметкерлердің міндеттері', 'Обязанности работников', 'Duties of employees'],
        clauses: [
          [
            'Қызметкерлер еңбек міндеттерін адал орындауға, еңбек тәртібін, еңбекті қорғау және өрт қауіпсіздігі талаптарын сақтауға міндетті.',
            'Работники обязаны добросовестно исполнять трудовые обязанности, соблюдать трудовую дисциплину, требования охраны труда и пожарной безопасности.',
            'Employees shall perform their duties in good faith and observe labour discipline, occupational safety and fire safety rules.',
          ],
          [
            'Жұмысқа келмеу немесе кешігу себебі туралы тікелей басшыға дереу хабарлау қажет.',
            'О причине неявки или опоздания необходимо незамедлительно сообщить непосредственному руководителю.',
            'Absence or lateness must be reported to the line manager without delay.',
          ],
        ],
      },
      {
        title: ['Жұмыс берушінің міндеттері', 'Обязанности работодателя', 'Duties of the employer'],
        clauses: [
          [
            'Жұмыс беруші қауіпсіз еңбек жағдайларын қамтамасыз етеді және жалақыны уақытында төлейді.',
            'Работодатель обеспечивает безопасные условия труда и своевременно выплачивает заработную плату.',
            'The Employer provides safe working conditions and pays salaries on time.',
          ],
        ],
      },
      {
        title: ['Көтермелеу және жаза', 'Поощрения и взыскания', 'Rewards and sanctions'],
        clauses: [
          [
            'Жұмыстағы табыстары үшін көтермелеу, еңбек тәртібін бұзғаны үшін тәртіптік жаза заңнамада белгіленген тәртіппен қолданылады.',
            'Поощрения за успехи в работе и дисциплинарные взыскания за нарушения трудовой дисциплины применяются в порядке, установленном законодательством.',
            'Rewards for good work and disciplinary sanctions for breaches are applied as provided by law.',
          ],
        ],
      },
    ],
  }),

  policy({
    id: 'hr-pay-policy',
    title: 'Положение об оплате труда и премировании',
    sectionId: 'hr',
    subsectionId: 'hr-policies',
    series: 'ОД',
    profile: 'sensitive',
    purpose: 'Как устанавливается и выплачивается заработная плата и за что начисляется премия.',
    words: [
      'ЕҢБЕКАҚЫ ТӨЛЕУ ЖӘНЕ СЫЙЛЫҚАҚЫ БЕРУ ТУРАЛЫ ЕРЕЖЕ',
      'ПОЛОЖЕНИЕ ОБ ОПЛАТЕ ТРУДА И ПРЕМИРОВАНИИ',
      'PAY AND BONUS POLICY',
    ],
    fields: [
      field.tri('payDays', 'Сроки выплаты заработной платы', 'Оплата', {
        hint: 'Например: 10-го и 25-го числа каждого месяца',
      }),
      field.number('bonusMax', 'Предельный размер премии', 'Премии', { unit: '% оклада' }),
    ],
    sections: [
      {
        title: ['Жалпы ережелер', 'Общие положения', 'General provisions'],
        clauses: [
          [
            'Ереже қызметкерлердің еңбегіне ақы төлеу мен сыйлықақы берудің тәртібі мен шарттарын белгілейді.',
            'Положение устанавливает порядок и условия оплаты труда и премирования работников.',
            'This policy sets the procedure and terms of pay and bonuses for employees.',
          ],
        ],
      },
      {
        title: ['Еңбекақы', 'Оплата труда', 'Pay'],
        clauses: [
          [
            'Еңбекақы штат кестесіне сәйкес лауазымдық жалақы түрінде белгіленеді.',
            'Оплата труда устанавливается в виде должностного оклада согласно штатному расписанию.',
            'Pay is set as a monthly salary according to the staff schedule.',
          ],
          [
            'Жалақы төлеу мерзімдері: {payDays}.',
            'Сроки выплаты заработной платы: {payDays}.',
            'Salary is paid on: {payDays}.',
          ],
        ],
      },
      {
        title: ['Сыйлықақы', 'Премирование', 'Bonuses'],
        clauses: [
          [
            'Сыйлықақы жұмыс нәтижесі бойынша басшының бұйрығымен тағайындалады.',
            'Премия назначается по результатам работы приказом руководителя.',
            'Bonuses are awarded for results by order of the head of the company.',
          ],
          [
            'Сыйлықақының ең жоғары мөлшері – лауазымдық жалақының {bonusMax} пайызы.',
            'Предельный размер премии – {bonusMax} % должностного оклада.',
            'The maximum bonus is {bonusMax}% of the monthly salary.',
          ],
        ],
      },
      {
        title: ['Қорытынды ережелер', 'Заключительные положения', 'Final provisions'],
        clauses: [
          [
            'Ереже бекітілген күннен бастап қолданысқа енгізіледі.',
            'Положение вводится в действие со дня утверждения.',
            'The policy takes effect on the date of approval.',
          ],
        ],
      },
    ],
  }),

  /* ═══ Юристы: договоры ════════════════════════════════════════════════ */

  contract({
    id: 'legal-supply-contract',
    title: 'Договор поставки',
    sectionId: 'legal',
    subsectionId: 'legal-contracts',
    series: 'Д',
    purpose: 'Поставка товара: что, сколько стоит, когда и куда везти, качество.',
    words: ['ЖЕТКІЗУ ШАРТЫ', 'ДОГОВОР ПОСТАВКИ', 'SUPPLY CONTRACT'],
    roles: {
      company: ['Сатып алушы', 'Покупатель', 'Buyer'],
      other: ['Жеткізуші', 'Поставщик', 'Supplier'],
    },
    fields: [
      field.area('goods', 'Что поставляется', 'Предмет', {
        hint: 'Наименование, количество, требования к качеству',
      }),
      field.money('amount', 'Цена договора', 'Цена'),
      amountWords('amountWords', 'Цена'),
      field.tri('paymentTerms', 'Порядок оплаты', 'Цена', {
        hint: 'Например: в течение 10 банковских дней после поставки',
      }),
      field.date('deliveryDate', 'Срок поставки', 'Поставка', { dateLimits: { notBefore: 'today' } }),
      field.tri('deliveryPlace', 'Место поставки', 'Поставка'),
    ],
    clauses: [
      [
        'Жеткізуші Сатып алушыға мына тауарды жеткізуге, ал Сатып алушы оны қабылдап, ақысын төлеуге міндеттенеді: {goods}',
        'Поставщик обязуется поставить Покупателю, а Покупатель – принять и оплатить следующий товар: {goods}',
        'The Supplier undertakes to deliver to the Buyer, and the Buyer to accept and pay for, the following goods: {goods}',
      ],
      [
        'Шарттың бағасы {amount} ({amountWords}) теңгені құрайды. Төлем тәртібі: {paymentTerms}.',
        'Цена договора составляет {amount} ({amountWords}) тенге. Порядок оплаты: {paymentTerms}.',
        'The contract price is KZT {amount} ({amountWords}). Payment terms: {paymentTerms}.',
      ],
      [
        'Тауар {deliveryDate} дейін мына мекенжайға жеткізіледі: {deliveryPlace}. Тауар жүкқұжат бойынша қабылданады.',
        'Товар поставляется до {deliveryDate} по адресу: {deliveryPlace}. Приёмка товара производится по накладной.',
        'The goods are delivered by {deliveryDate} to: {deliveryPlace}. Acceptance is made against a delivery note.',
      ],
      [
        'Тауардың сапасы техникалық талаптар мен сертификаттарға сәйкес келуі тиіс. Сапасыз тауарды Жеткізуші өз есебінен ауыстырады.',
        'Качество товара должно соответствовать техническим требованиям и сертификатам. Некачественный товар Поставщик заменяет за свой счёт.',
        'The goods shall meet the technical requirements and certificates. The Supplier replaces defective goods at its own cost.',
      ],
      [
        'Жеткізу мерзімін бұзғаны үшін Жеткізуші кешіктірілген әр күн үшін жеткізілмеген тауар құнының 0,1 пайызы мөлшерінде тұрақсыздық айыбын төлейді.',
        'За нарушение срока поставки Поставщик уплачивает неустойку в размере 0,1 % стоимости непоставленного товара за каждый день просрочки.',
        'For late delivery the Supplier pays a penalty of 0.1% of the value of the undelivered goods per day of delay.',
      ],
    ],
  }),

  contract({
    id: 'legal-service-contract',
    title: 'Договор оказания услуг',
    sectionId: 'legal',
    subsectionId: 'legal-contracts',
    series: 'Д',
    purpose: 'Оказание услуг: какие, в какие сроки, сколько стоят, как принимаются.',
    words: ['ҚЫЗМЕТ КӨРСЕТУ ШАРТЫ', 'ДОГОВОР ОКАЗАНИЯ УСЛУГ', 'SERVICE AGREEMENT'],
    roles: {
      company: ['Тапсырыс беруші', 'Заказчик', 'Customer'],
      other: ['Орындаушы', 'Исполнитель', 'Contractor'],
    },
    fields: [
      field.area('services', 'Какие услуги', 'Предмет'),
      field.date('serviceStart', 'Начало оказания услуг', 'Сроки'),
      field.date('serviceEnd', 'Окончание оказания услуг', 'Сроки', {
        dateLimits: { afterField: 'serviceStart' },
      }),
      field.money('amount', 'Стоимость услуг', 'Цена'),
      amountWords('amountWords', 'Цена'),
      field.tri('paymentTerms', 'Порядок оплаты', 'Цена', {
        hint: 'Например: в течение 10 банковских дней после подписания акта',
      }),
    ],
    clauses: [
      [
        'Орындаушы Тапсырыс берушіге мына қызметтерді көрсетуге міндеттенеді: {services}',
        'Исполнитель обязуется оказать Заказчику следующие услуги: {services}',
        'The Contractor undertakes to provide the Customer with the following services: {services}',
      ],
      [
        'Қызметтер {serviceStart} бастап {serviceEnd} дейін көрсетіледі.',
        'Услуги оказываются с {serviceStart} по {serviceEnd}.',
        'The services are provided from {serviceStart} to {serviceEnd}.',
      ],
      [
        'Қызметтердің құны {amount} ({amountWords}) теңгені құрайды. Төлем тәртібі: {paymentTerms}.',
        'Стоимость услуг составляет {amount} ({amountWords}) тенге. Порядок оплаты: {paymentTerms}.',
        'The cost of the services is KZT {amount} ({amountWords}). Payment terms: {paymentTerms}.',
      ],
      [
        'Көрсетілген қызметтер Тараптар қол қойған орындалған жұмыстар актісімен ресімделеді.',
        'Оказание услуг оформляется актом выполненных работ, подписанным Сторонами.',
        'The services are documented by a certificate of completed work signed by the Parties.',
      ],
      [
        'Орындаушы қызметтерді тиісті сапада және уақытында көрсетеді және Тапсырыс берушінің құпия ақпаратын жария етпейді.',
        'Исполнитель оказывает услуги качественно и в срок и не разглашает конфиденциальную информацию Заказчика.',
        'The Contractor provides the services properly and on time and keeps the Customer’s information confidential.',
      ],
    ],
  }),

  contract({
    id: 'legal-lease-contract',
    title: 'Договор аренды',
    sectionId: 'legal',
    subsectionId: 'legal-contracts',
    series: 'Д',
    purpose: 'Аренда помещения компанией: объект, арендная плата, обязанности сторон.',
    words: ['ЖАЛҒА АЛУ ШАРТЫ', 'ДОГОВОР АРЕНДЫ', 'LEASE AGREEMENT'],
    roles: {
      company: ['Жалға алушы', 'Арендатор', 'Lessee'],
      other: ['Жалға беруші', 'Арендодатель', 'Lessor'],
    },
    fields: [
      field.area('premises', 'Объект аренды', 'Предмет', {
        hint: 'Адрес, площадь, назначение помещения',
      }),
      field.date('leaseStart', 'Начало аренды', 'Сроки'),
      field.money('rent', 'Арендная плата в месяц', 'Плата'),
      amountWords('rentWords', 'Плата'),
      field.tri('payDay', 'Срок оплаты', 'Плата', {
        hint: 'Например: до 5-го числа текущего месяца',
      }),
    ],
    clauses: [
      [
        'Жалға беруші Жалға алушыға уақытша иеленуге және пайдалануға мына объектіні береді: {premises}',
        'Арендодатель передаёт Арендатору во временное владение и пользование следующий объект: {premises}',
        'The Lessor transfers to the Lessee for temporary possession and use the following property: {premises}',
      ],
      [
        'Объект Жалға алушыға {leaseStart} қабылдау-беру актісі бойынша беріледі.',
        'Объект передаётся Арендатору {leaseStart} по акту приёма-передачи.',
        'The property is handed over to the Lessee on {leaseStart} under a handover certificate.',
      ],
      [
        'Жалдау ақысы айына {rent} ({rentWords}) теңгені құрайды және {payDay} төленеді.',
        'Арендная плата составляет {rent} ({rentWords}) тенге в месяц и вносится {payDay}.',
        'The rent is KZT {rent} ({rentWords}) per month, payable {payDay}.',
      ],
      [
        'Жалға алушы объектіні мақсаты бойынша пайдаланады, тиісті күйде ұстайды және, егер Тараптар өзгеше келіспесе, коммуналдық қызметтерге ақы төлейді.',
        'Арендатор использует объект по назначению, содержит его в надлежащем состоянии и, если Стороны не договорились иначе, оплачивает коммунальные услуги.',
        'The Lessee uses the property for its purpose, keeps it in good condition and, unless the Parties agree otherwise, pays the utilities.',
      ],
      [
        'Жалға беруші объектіге күрделі жөндеу жүргізеді және Жалға алушының оны пайдалануына кедергі келтірмейді.',
        'Арендодатель производит капитальный ремонт объекта и не препятствует Арендатору в пользовании им.',
        'The Lessor carries out major repairs and does not hinder the Lessee’s use of the property.',
      ],
    ],
  }),

  contract({
    id: 'legal-contract-amendment',
    title: 'Дополнительное соглашение к договору',
    sectionId: 'legal',
    subsectionId: 'legal-contracts',
    series: 'Д',
    purpose: 'Меняет условия уже заключённого договора с контрагентом.',
    words: [
      'ШАРТҚА ҚОСЫМША КЕЛІСІМ',
      'ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ К ДОГОВОРУ',
      'AMENDMENT TO THE CONTRACT',
    ],
    roles: {
      company: ['Бірінші Тарап', 'Первая Сторона', 'First Party'],
      other: ['Екінші Тарап', 'Вторая Сторона', 'Second Party'],
    },
    fields: [
      field.text('contractNumber', 'Номер договора', 'Основание'),
      field.date('contractDate', 'Дата договора', 'Основание', { dateLimits: { notAfter: 'today' } }),
      field.area('changes', 'Что изменяется', 'Изменения', {
        hint: 'Новая редакция пунктов договора',
      }),
      field.date('effectiveDate', 'Действует с', 'Изменения'),
    ],
    clauses: [
      [
        'Тараптар {contractDate} № {contractNumber} шартқа мынадай өзгерістер енгізуге келісті: {changes}',
        'Стороны договорились внести в договор № {contractNumber} от {contractDate} следующие изменения: {changes}',
        'The Parties have agreed to amend contract No. {contractNumber} dated {contractDate} as follows: {changes}',
      ],
      [
        'Өзгерістер {effectiveDate} бастап қолданылады.',
        'Изменения применяются с {effectiveDate}.',
        'The changes apply from {effectiveDate}.',
      ],
    ],
    end: [
      [
        'Шарттың осы келісіммен өзгертілмеген талаптары бұрынғы редакцияда қолданылады. Келісім шарттың ажырамас бөлігі болып табылады.',
        'Условия договора, не изменённые настоящим соглашением, действуют в прежней редакции. Соглашение является неотъемлемой частью договора.',
        'Terms of the contract not amended by this agreement remain unchanged. This agreement forms an integral part of the contract.',
      ],
      [
        'Келісім қазақ, орыс және ағылшын тілдерінде бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан.',
        'Соглашение составлено на казахском, русском и английском языках в двух экземплярах равной юридической силы, по одному для каждой Стороны.',
        'This agreement is made in Kazakh, Russian and English in two counterparts of equal legal force, one for each Party.',
      ],
    ],
  }),

  /* ═══ Юристы: претензии и письма ══════════════════════════════════════ */

  letter({
    id: 'legal-claim',
    title: 'Претензия',
    sectionId: 'legal',
    subsectionId: 'legal-claims',
    series: 'Исх',
    purpose: 'Требование к контрагенту, нарушившему договор, до обращения в суд.',
    words: ['КІНӘРАТ-ТАЛАП', 'ПРЕТЕНЗИЯ', 'CLAIM'],
    subject: [
      '{contractDate} № {contractNumber} шарт бойынша',
      'по договору № {contractNumber} от {contractDate}',
      'under contract No. {contractNumber} dated {contractDate}',
    ],
    fields: [
      field.text('contractNumber', 'Номер договора', 'Основание'),
      field.date('contractDate', 'Дата договора', 'Основание', { dateLimits: { notAfter: 'today' } }),
      field.area('violation', 'В чём нарушение', 'Суть претензии'),
      field.money('claimAmount', 'Сумма требования', 'Суть претензии'),
      amountWords('amountWords', 'Суть претензии', 'claimAmount'),
      field.number('answerDays', 'Срок ответа', 'Суть претензии', { unit: 'дней' }),
    ],
    clauses: [
      [
        '{counterparty} шарт бойынша міндеттемелерін бұзды: {violation}',
        '{counterparty} нарушило обязательства по договору: {violation}',
        '{counterparty} has breached its obligations under the contract: {violation}',
      ],
      [
        'Осыған байланысты {claimAmount} ({amountWords}) теңге төлеуді талап етеміз.',
        'В связи с этим требуем уплатить {claimAmount} ({amountWords}) тенге.',
        'We therefore demand payment of KZT {claimAmount} ({amountWords}).',
      ],
      [
        'Кінәрат-талапқа ол алынған күннен бастап {answerDays} күн ішінде жауап беруіңізді сұраймыз. Жауап болмаса, сотқа жүгінуге мәжбүр боламыз.',
        'Просим ответить на претензию в течение {answerDays} дней с даты её получения. При отсутствии ответа будем вынуждены обратиться в суд.',
        'Please respond within {answerDays} days of receipt. Failing a response, we will have to apply to the court.',
      ],
    ],
  }),

  letter({
    id: 'legal-claim-reply',
    title: 'Ответ на претензию',
    sectionId: 'legal',
    subsectionId: 'legal-claims',
    series: 'Исх',
    purpose: 'Ответ компании на претензию контрагента.',
    words: ['КІНӘРАТ-ТАЛАПҚА ЖАУАП', 'ОТВЕТ НА ПРЕТЕНЗИЮ', 'REPLY TO A CLAIM'],
    subject: [
      '{claimDate} № {claimNumber} кінәрат-талапқа',
      'на претензию № {claimNumber} от {claimDate}',
      'to claim No. {claimNumber} dated {claimDate}',
    ],
    fields: [
      field.text('claimNumber', 'Номер претензии', 'Претензия'),
      field.date('claimDate', 'Дата претензии', 'Претензия', { dateLimits: { notAfter: 'today' } }),
      field.area('answer', 'Ответ по существу', 'Ответ', {
        hint: 'Признаёте ли требование и почему',
      }),
    ],
    plain: true,
    clauses: [
      [
        '{claimDate} № {claimNumber} кінәрат-талапты қарап, мынаны хабарлаймыз.',
        'Рассмотрев претензию № {claimNumber} от {claimDate}, сообщаем следующее.',
        'Having considered claim No. {claimNumber} dated {claimDate}, we inform you as follows.',
      ],
      ['{answer}', '{answer}', '{answer}'],
      [
        'Қосымша сұрақтар туындаса, біз келіссөздерге дайынбыз.',
        'При возникновении дополнительных вопросов мы готовы к переговорам.',
        'We remain open to negotiation should further questions arise.',
      ],
    ],
  }),

  listDocument({
    id: 'legal-lawsuit',
    title: 'Исковое заявление',
    sectionId: 'legal',
    subsectionId: 'legal-claims',
    series: 'Исх',
    purpose: 'Обращение компании в суд с требованием к контрагенту.',
    words: ['ТАЛАП ҚОЮ АРЫЗЫ', 'ИСКОВОЕ ЗАЯВЛЕНИЕ', 'STATEMENT OF CLAIM'],
    fields: [
      field.tri('court', 'Суд', 'Суд', {
        hint: 'Например: Специализированный межрайонный экономический суд города Астаны',
      }),
      field.counterparty('Ответчик'),
      field.text('counterpartyBin', 'БИН контрагента', 'Ответчик', { hint: 'Двенадцать цифр' }),
      field.area('facts', 'Обстоятельства дела', 'Суть иска'),
      field.money('claimAmount', 'Сумма иска', 'Суть иска'),
      amountWords('amountWords', 'Суть иска', 'claimAmount'),
      field.area('attachments', 'Приложения', 'Приложения', {
        required: false,
        hint: 'По одному документу на строку',
      }),
    ],
    intro: [
      ['**Сотқа:** {court}', '**В суд:** {court}', '**To the court:** {court}'],
      [
        `**Талапкер:** ${CO_KK}, БСН {@company.bin}, {@company.address}`,
        `**Истец:** ${CO_RU}, БИН {@company.bin}, {@company.address}`,
        `**Claimant:** ${CO_EN}, BIN {@company.bin}, {@company.addressEn|@company.address}`,
      ],
      [
        '**Жауапкер:** {counterparty}, БСН {counterpartyBin}',
        '**Ответчик:** {counterparty}, БИН {counterpartyBin}',
        '**Defendant:** {counterparty}, BIN {counterpartyBin}',
      ],
      [
        '**Талап қою бағасы:** {claimAmount} теңге',
        '**Цена иска:** {claimAmount} тенге',
        '**Value of the claim:** KZT {claimAmount}',
      ],
    ],
    clauses: [
      ['{facts}', '{facts}', '{facts}'],
      [
        'Баяндалғанның негізінде сотты жауапкерден талапкердің пайдасына {claimAmount} ({amountWords}) теңге өндіріп беруді сұраймын.',
        'На основании изложенного прошу суд взыскать с ответчика в пользу истца {claimAmount} ({amountWords}) тенге.',
        'On these grounds, I ask the court to recover KZT {claimAmount} ({amountWords}) from the defendant in favour of the claimant.',
      ],
      ['**Қосымшалар:** {attachments}', '**Приложения:** {attachments}', '**Attachments:** {attachments}'],
    ],
  }),

  letter({
    id: 'legal-guarantee-letter',
    title: 'Гарантийное письмо',
    sectionId: 'legal',
    subsectionId: 'legal-other',
    series: 'Исх',
    purpose: 'Компания гарантирует контрагенту оплату или иное исполнение в срок.',
    words: ['КЕПІЛДІК ХАТ', 'ГАРАНТИЙНОЕ ПИСЬМО', 'LETTER OF GUARANTEE'],
    subject: ['Міндеттемені орындау туралы', 'Об исполнении обязательства', 'On performance of an obligation'],
    fields: [
      field.area('obligation', 'Что гарантируем', 'Гарантия', {
        hint: 'Например: оплату поставленного товара по счёту № 15',
      }),
      field.money('amount', 'Сумма', 'Гарантия'),
      amountWords('amountWords', 'Гарантия'),
      field.date('dueDate', 'Срок исполнения', 'Гарантия', { dateLimits: { notBefore: 'today' } }),
    ],
    plain: true,
    clauses: [
      [
        `${CO_KK} мынаны орындауға кепілдік береді: {obligation}`,
        `${CO_RU} гарантирует: {obligation}`,
        `${CO_EN} guarantees: {obligation}`,
      ],
      [
        'Міндеттеме сомасы – {amount} ({amountWords}) теңге, орындау мерзімі – {dueDate} дейін.',
        'Сумма обязательства – {amount} ({amountWords}) тенге, срок исполнения – до {dueDate}.',
        'Amount: KZT {amount} ({amountWords}); to be performed by {dueDate}.',
      ],
    ],
  }),

  letter({
    id: 'legal-official-letter',
    title: 'Официальное письмо контрагенту',
    sectionId: 'legal',
    subsectionId: 'legal-other',
    series: 'Исх',
    purpose: 'Письмо компании контрагенту на бланке: тема и текст.',
    words: ['РЕСМИ ХАТ', 'ОФИЦИАЛЬНОЕ ПИСЬМО', 'OFFICIAL LETTER'],
    subject: ['{letterSubject}', '{letterSubject}', '{letterSubject}'],
    fields: [
      field.tri('letterSubject', 'Тема письма', 'Письмо'),
      field.area('text', 'Текст письма', 'Письмо'),
    ],
    plain: true,
    clauses: [
      ['{text}', '{text}', '{text}'],
      ['Құрметпен,', 'С уважением,', 'Yours faithfully,'],
    ],
  }),

  /* ═══ Корпоративное управление ════════════════════════════════════════ */

  listDocument({
    id: 'corporate-sole-decision',
    title: 'Решение единственного участника',
    sectionId: 'corporate',
    subsectionId: 'corporate-decisions',
    series: 'ОД',
    profile: 'sensitive',
    purpose: 'Решение по вопросам, которые устав относит к ведению участника.',
    words: [
      'ЖАЛҒЫЗ ҚАТЫСУШЫНЫҢ ШЕШІМІ',
      'РЕШЕНИЕ ЕДИНСТВЕННОГО УЧАСТНИКА',
      'DECISION OF THE SOLE PARTICIPANT',
    ],
    fields: [
      field.tri('participant', 'Единственный участник', 'Участник', {
        hint: 'ФИО или наименование и БИН',
      }),
      field.area('agenda', 'Вопросы', 'Решение'),
      field.area('decisions', 'Решения', 'Решение', { hint: 'По одному на строку' }),
    ],
    intro: [
      ['**Қатысушы:** {participant}', '**Участник:** {participant}', '**Participant:** {participant}'],
      ['**Күн тәртібі:** {agenda}', '**Повестка:** {agenda}', '**Agenda:** {agenda}'],
      ['Жалғыз қатысушы ШЕШТІ:', 'Единственный участник РЕШИЛ:', 'The sole participant HAS DECIDED:'],
    ],
    clauses: [['{decisions}', '{decisions}', '{decisions}']],
    signs: [
      [
        'Жалғыз қатысушы: ________________ {participant}',
        'Единственный участник: ________________ {participant}',
        'Sole participant: ________________ {participant}',
      ],
    ],
    caption: CAPTION.accept,
  }),

  listDocument({
    id: 'corporate-general-meeting',
    title: 'Протокол общего собрания участников',
    sectionId: 'corporate',
    subsectionId: 'corporate-decisions',
    series: 'ОД',
    profile: 'sensitive',
    purpose: 'Ход и решения общего собрания участников.',
    words: [
      'ҚАТЫСУШЫЛАРДЫҢ ЖАЛПЫ ЖИНАЛЫСЫНЫҢ ХАТТАМАСЫ',
      'ПРОТОКОЛ ОБЩЕГО СОБРАНИЯ УЧАСТНИКОВ',
      'MINUTES OF THE GENERAL MEETING OF PARTICIPANTS',
    ],
    fields: [
      field.tri('meetingPlace', 'Место проведения', 'Собрание'),
      field.area('attendees', 'Присутствовали', 'Собрание', {
        hint: 'Участники и их доли: по одному на строку',
      }),
      field.tri('chair', 'Председатель собрания', 'Собрание'),
      field.tri('secretary', 'Секретарь', 'Собрание'),
      field.area('agenda', 'Повестка дня', 'Вопросы'),
      field.area('heard', 'Слушали', 'Вопросы'),
      field.tri('votes', 'Итоги голосования', 'Вопросы', {
        hint: 'Например: «за» – 100 %, «против» – нет',
      }),
      field.area('decisions', 'Постановили', 'Вопросы'),
    ],
    intro: [
      ['**Өткізілген орны:** {meetingPlace}', '**Место проведения:** {meetingPlace}', '**Place:** {meetingPlace}'],
      ['**Қатысқандар:** {attendees}', '**Присутствовали:** {attendees}', '**Present:** {attendees}'],
      [
        'Кворум бар. Жиналыс шешім қабылдауға құқылы.',
        'Кворум имеется. Собрание правомочно принимать решения.',
        'A quorum is present. The meeting is competent to take decisions.',
      ],
      [
        '**Жиналыс төрағасы:** {chair}. **Хатшы:** {secretary}',
        '**Председатель собрания:** {chair}. **Секретарь:** {secretary}',
        '**Chair:** {chair}. **Secretary:** {secretary}',
      ],
      ['**Күн тәртібі:** {agenda}', '**Повестка дня:** {agenda}', '**Agenda:** {agenda}'],
    ],
    clauses: [
      ['**ТЫҢДАЛДЫ:** {heard}', '**СЛУШАЛИ:** {heard}', '**HEARD:** {heard}'],
      ['**ДАУЫС БЕРУ ҚОРЫТЫНДЫСЫ:** {votes}', '**ИТОГИ ГОЛОСОВАНИЯ:** {votes}', '**VOTING RESULTS:** {votes}'],
      ['**ҚАУЛЫ ЕТТІ:** {decisions}', '**ПОСТАНОВИЛИ:** {decisions}', '**RESOLVED:** {decisions}'],
    ],
    signs: [
      [
        'Жиналыс төрағасы: ________________ {chair}',
        'Председатель собрания: ________________ {chair}',
        'Chair: ________________ {chair}',
      ],
      ['Хатшы: ________________ {secretary}', 'Секретарь: ________________ {secretary}', 'Secretary: ________________ {secretary}'],
    ],
    caption: CAPTION.accept,
  }),

  /* ═══ Финансы ═════════════════════════════════════════════════════════ */

  listDocument({
    id: 'finance-invoice',
    title: 'Счёт на оплату',
    sectionId: 'finance',
    subsectionId: 'finance-primary',
    series: 'Фин',
    purpose: 'Счёт покупателю: позиции, итог к оплате и срок.',
    words: ['ТӨЛЕМГЕ ШОТ', 'СЧЁТ НА ОПЛАТУ', 'INVOICE'],
    fields: [
      field.counterparty('Покупатель'),
      field.text('counterpartyBin', 'БИН контрагента', 'Покупатель', { hint: 'Двенадцать цифр' }),
      field.area('items', 'Товары и услуги', 'Позиции', {
        hint: 'По одной позиции на строку: наименование, количество, цена, сумма',
      }),
      field.money('amount', 'Итого к оплате', 'Сумма'),
      amountWords('amountWords', 'Сумма'),
      field.date('payUntil', 'Оплатить до', 'Сумма', { dateLimits: { notBefore: 'today' } }),
    ],
    intro: [
      [
        `**Жеткізуші:** ${CO_KK}, БСН {@company.bin}, {@company.address}`,
        `**Поставщик:** ${CO_RU}, БИН {@company.bin}, {@company.address}`,
        `**Supplier:** ${CO_EN}, BIN {@company.bin}, {@company.addressEn|@company.address}`,
      ],
      ['**Банк деректемелері:** {@company.bank}', '**Банковские реквизиты:** {@company.bank}', '**Bank details:** {@company.bank}'],
      [
        '**Сатып алушы:** {counterparty}, БСН {counterpartyBin}',
        '**Покупатель:** {counterparty}, БИН {counterpartyBin}',
        '**Buyer:** {counterparty}, BIN {counterpartyBin}',
      ],
    ],
    clauses: [
      ['**Тауарлар мен қызметтер:** {items}', '**Товары и услуги:** {items}', '**Goods and services:** {items}'],
      [
        '**Барлығы төлеуге:** {amount} ({amountWords}) теңге',
        '**Всего к оплате:** {amount} ({amountWords}) тенге',
        '**Total due:** KZT {amount} ({amountWords})',
      ],
      ['Шотты {payUntil} дейін төлеу қажет.', 'Счёт подлежит оплате до {payUntil}.', 'Payment is due by {payUntil}.'],
    ],
  }),

  act({
    id: 'finance-work-act',
    title: 'Акт выполненных работ',
    sectionId: 'finance',
    subsectionId: 'finance-primary',
    series: 'Фин',
    purpose: 'Подтверждает, что работы выполнены или услуги оказаны по договору.',
    words: [
      'ОРЫНДАЛҒАН ЖҰМЫСТАР (КӨРСЕТІЛГЕН ҚЫЗМЕТТЕР) АКТІСІ',
      'АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)',
      'CERTIFICATE OF COMPLETED WORK (SERVICES RENDERED)',
    ],
    fields: [
      field.counterparty(),
      COUNTERPARTY_SIGNER,
      field.text('contractNumber', 'Номер договора', 'Основание'),
      field.date('contractDate', 'Дата договора', 'Основание', { dateLimits: { notAfter: 'today' } }),
      field.area('works', 'Выполненные работы и услуги', 'Работы', {
        hint: 'По одной позиции на строку: наименование, объём, сумма',
      }),
      field.money('amount', 'Стоимость', 'Работы'),
      amountWords('amountWords', 'Работы'),
    ],
    preamble: [
      `${CO_KK}, бір тараптан, және {counterparty}, екінші тараптан, {contractDate} № {contractNumber} шарт бойынша осы актіні жасады.`,
      `${CO_RU}, с одной стороны, и {counterparty}, с другой стороны, составили настоящий акт по договору № {contractNumber} от {contractDate}.`,
      `${CO_EN}, on the one part, and {counterparty}, on the other part, have drawn up this certificate under contract No. {contractNumber} dated {contractDate}.`,
    ],
    clauses: [
      [
        'Мына жұмыстар орындалды (қызметтер көрсетілді): {works}',
        'Выполнены следующие работы (оказаны услуги): {works}',
        'The following work has been performed (services rendered): {works}',
      ],
      [
        'Жұмыстардың құны {amount} ({amountWords}) теңгені құрайды.',
        'Стоимость работ составляет {amount} ({amountWords}) тенге.',
        'The cost of the work is KZT {amount} ({amountWords}).',
      ],
      [
        'Жұмыстар толық көлемде және уақытында орындалды. Тараптардың сапа мен мерзім бойынша бір-біріне наразылығы жоқ.',
        'Работы выполнены в полном объёме и в срок. Претензий по качеству и срокам Стороны друг к другу не имеют.',
        'The work has been performed in full and on time. The Parties have no claims against each other as to quality or timing.',
      ],
    ],
    signs: [
      [
        '**Орындаушы:** ________________ {counterpartySigner}',
        '**Исполнитель:** ________________ {counterpartySigner}',
        '**Contractor:** ________________ {counterpartySigner}',
      ],
    ],
    caption: ['Тапсырыс беруші', 'Заказчик', 'Customer'],
  }),

  listDocument({
    id: 'finance-expense-report',
    title: 'Авансовый отчёт',
    sectionId: 'finance',
    subsectionId: 'finance-primary',
    series: 'Фин',
    profile: 'self-service',
    purpose: 'Отчёт работника о расходовании выданного аванса.',
    words: ['АВАНСТЫҚ ЕСЕП', 'АВАНСОВЫЙ ОТЧЁТ', 'EXPENSE REPORT'],
    fields: [
      field.employee('employee', 'Подотчётное лицо', 'Подотчётное лицо'),
      field.tri('position', 'Должность', 'Подотчётное лицо'),
      field.area('advancePurpose', 'Назначение аванса', 'Аванс'),
      field.money('advance', 'Получено аванса', 'Аванс'),
      field.area('expenses', 'Расходы', 'Расходы', {
        hint: 'По одному документу на строку: дата, номер, что оплачено, сумма',
      }),
      field.money('spent', 'Израсходовано', 'Расходы'),
      field.money('balance', 'Остаток (перерасход)', 'Расходы', { required: false }),
    ],
    intro: [
      [
        '**Есеп беретін тұлға:** {employee:nom}, {position}',
        '**Подотчётное лицо:** {employee:nom}, {position}',
        '**Accountable person:** {employee:nom}, {position}',
      ],
      [
        '**Аванстың мақсаты:** {advancePurpose}',
        '**Назначение аванса:** {advancePurpose}',
        '**Purpose of the advance:** {advancePurpose}',
      ],
    ],
    clauses: [
      ['**Алынған аванс:** {advance} теңге', '**Получено аванса:** {advance} тенге', '**Advance received:** KZT {advance}'],
      ['**Шығыстар:** {expenses}', '**Расходы:** {expenses}', '**Expenses:** {expenses}'],
      [
        '**Жұмсалды:** {spent} теңге. **Қалдық (асыра жұмсау):** {balance} теңге',
        '**Израсходовано:** {spent} тенге. **Остаток (перерасход):** {balance} тенге',
        '**Spent:** KZT {spent}. **Balance (overspend):** KZT {balance}',
      ],
    ],
    signs: [
      [
        'Есеп беретін тұлға: ________________ {employee:nom}',
        'Подотчётное лицо: ________________ {employee:nom}',
        'Accountable person: ________________ {employee:nom}',
      ],
    ],
    caption: CAPTION.approve,
  }),

  act({
    id: 'finance-reconciliation',
    title: 'Акт сверки взаиморасчётов',
    sectionId: 'finance',
    subsectionId: 'finance-primary',
    series: 'Фин',
    purpose: 'Сверка расчётов с контрагентом за период и сальдо на конец.',
    words: [
      'ӨЗАРА ЕСЕП АЙЫРЫСУЛАРДЫ САЛЫСТЫРУ АКТІСІ',
      'АКТ СВЕРКИ ВЗАИМОРАСЧЁТОВ',
      'RECONCILIATION STATEMENT',
    ],
    fields: [
      field.counterparty(),
      COUNTERPARTY_SIGNER,
      field.date('periodFrom', 'Период с', 'Период', { dateLimits: { notAfter: 'today' } }),
      field.date('periodTo', 'Период по', 'Период', { dateLimits: { afterField: 'periodFrom' } }),
      field.area('operations', 'Операции за период', 'Расчёты', {
        hint: 'По одной на строку: дата, документ, дебет, кредит',
      }),
      field.money('balance', 'Сальдо на конец периода', 'Расчёты'),
      field.tri('balanceSide', 'В чью пользу', 'Расчёты', { hint: 'Например: в пользу Компании' }),
    ],
    preamble: [
      `${CO_KK} және {counterparty} {periodFrom} бастап {periodTo} дейінгі кезеңдегі өзара есеп айырысуларды салыстырды.`,
      `${CO_RU} и {counterparty} провели сверку взаиморасчётов за период с {periodFrom} по {periodTo}.`,
      `${CO_EN} and {counterparty} have reconciled mutual settlements for the period from {periodFrom} to {periodTo}.`,
    ],
    clauses: [
      ['Кезеңдегі операциялар: {operations}', 'Операции за период: {operations}', 'Transactions for the period: {operations}'],
      [
        '{periodTo} жағдай бойынша сальдо {balance} теңгені құрайды, {balanceSide}.',
        'Сальдо на {periodTo} составляет {balance} тенге {balanceSide}.',
        'The balance as of {periodTo} is KZT {balance} {balanceSide}.',
      ],
    ],
    signs: [
      [
        '**Контрагент:** ________________ {counterpartySigner}',
        '**Контрагент:** ________________ {counterpartySigner}',
        '**Counterparty:** ________________ {counterpartySigner}',
      ],
    ],
    caption: CAPTION.company,
  }),

  request({
    id: 'finance-payment-request',
    title: 'Заявка на оплату',
    sectionId: 'finance',
    subsectionId: 'finance-planning',
    series: 'Фин',
    purpose: 'Просьба оплатить счёт или иной платёж получателю.',
    words: ['ТӨЛЕМГЕ ӨТІНІМ', 'ЗАЯВКА НА ОПЛАТУ', 'PAYMENT REQUEST'],
    fields: [
      field.counterparty('Получатель'),
      field.money('amount', 'Сумма', 'Оплата'),
      amountWords('amountWords', 'Оплата'),
      field.area('paymentPurpose', 'Назначение платежа', 'Оплата'),
      field.tri('basisDoc', 'Документ-основание', 'Оплата', {
        hint: 'Например: счёт № 15 от 10.09.2026',
      }),
      field.date('payBy', 'Оплатить до', 'Оплата', { dateLimits: { notBefore: 'today' } }),
    ],
    clauses: [
      [
        'Алушыға – {counterparty} – {amount} ({amountWords}) теңге төлеуді сұраймын.',
        'Прошу оплатить получателю {counterparty} сумму {amount} ({amountWords}) тенге.',
        'Please pay KZT {amount} ({amountWords}) to {counterparty}.',
      ],
      ['Төлем мақсаты: {paymentPurpose}', 'Назначение платежа: {paymentPurpose}', 'Purpose of payment: {paymentPurpose}'],
      [
        'Негіздеме: {basisDoc}. Төлеу мерзімі – {payBy} дейін.',
        'Основание: {basisDoc}. Срок оплаты – до {payBy}.',
        'Basis: {basisDoc}. Pay by {payBy}.',
      ],
    ],
  }),
];
