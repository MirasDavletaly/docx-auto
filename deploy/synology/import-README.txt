Папка для переноса базы DocFlow (docs/deploy-synology.md).

Один раз, перед первой установкой (Control Panel → Task Scheduler →
задача DocFlow install → Run), положите сюда копию базы с компьютера
разработчика – файл docflow-data-ГГГГ-ММ-ДД.dump
(scripts/deploy/export-db.ps1). Служебный контейнер docflow-init загрузит
его в пустую базу.

После установки удалите файл (File Station → Delete): в нём хеши паролей
и персональные данные работников. В непустую базу копия не загружается
никогда.
