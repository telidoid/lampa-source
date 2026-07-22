(function () {
    // Значения подставляются entrypoint.sh из переменных окружения при старте контейнера.
    // Маркер проверки ('%%') намеренно короче полных плейсхолдеров, чтобы sed при замене их не задел.
    //
    // allowed — если задан, значение принимается только из этого списка (иначе игнорируется).
    //           Для parser_torrent_type выбирает активный бэкенд поиска, для parser_use включает
    //           кнопку поиска торрентов на карточках.
    // bool    — parser_use это булев тумблер: Lampa.Storage.get() приводит сохранённые 'true'/'false'
    //           к настоящему boolean при чтении, поэтому сравнивать нужно с boolean, а не со строкой.
    var fields = [
        { key: 'torrserver_url',      value: '%%TORRSERVER_URL%%' },
        { key: 'jackett_url',         value: '%%JACKETT_URL%%' },
        { key: 'jackett_key',         value: '%%JACKETT_KEY%%' },
        { key: 'prowlarr_url',        value: '%%PROWLARR_URL%%' },
        { key: 'prowlarr_key',        value: '%%PROWLARR_KEY%%' },
        { key: 'parser_torrent_type', value: '%%PARSER_TORRENT_TYPE%%', allowed: ['jackett', 'prowlarr', 'torrserver'] },
        { key: 'parser_use',          value: '%%PARSER_USE%%', allowed: ['true', 'false'], bool: true }
    ]

    fields.forEach(function (field) {
        if (field.value.indexOf('%%') !== -1) return
        if (field.allowed && field.allowed.indexOf(field.value) === -1) return

        var stored = field.bool ? field.value === 'true' : field.value

        if (Lampa.Storage.get(field.key) !== stored) {
            Lampa.Storage.set(field.key, field.value)
        }
    })
})()
