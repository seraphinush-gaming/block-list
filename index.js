// Version 1.00 r:00

const Command = require('command')
const config = require('./config.json')
const fs = require('fs')
const path = require('path')

if (!fs.existsSync(path.join(__dirname, './data'))) {
    fs.mkdirSync(path.join(__dirname, './data'))
}

function getJsonData(pathToFile) {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, pathToFile)));
    } catch (e) {
        return undefined;
    }
}

function saveJsonData(pathToFile, data) {
    fs.writeFileSync(path.join(__dirname, pathToFile), JSON.stringify(data, null, "    "));
}

// credit : https://github.com/Some-AV-Popo
String.prototype.clr = function (hexColor) { return `<font color="#${hexColor}">${this}</font>` }

module.exports = function BlockList(d) {
    const command = Command(d)

    // config
    let autoSync = config.autoSync

    let data,
        playerBlockList = [],
        settingsPath = ''

    // command
    command.add(['blocklist'], (param) => {
        if (param === 'import') syncBlockList()
        else if (param === 'export') exportBlockList()
        //else if (param === 'test') { console.log(data); console.log(playerBlockList) }
        else send(`Invalid argument.`.clr('FF0000'))
    })

    // code
    // empty current playerBlockList array
    // set file path
    d.hook('S_LOGIN', 10, (e) => {
        playerBlockList.length = 0
        settingsPath = `./data/${d.base.region}-${e.serverId}.json`
    })

    // id, level, class, name, myNote
    d.hook('S_USER_BLOCK_LIST', 2, (e) => {
        // log player block list in array
        for (let i = 0, n = e.blockList.length; i < n; i++) {
            let temp = {
                id: e.blockList[i].id,
                name: e.blockList[i].name,
                myNote: e.blockList[i].myNote
            }
            playerBlockList.push(temp)
        }
        //process.nextTick(() => { send(`test`)})
    })

    // TODO -- hook, not hookOnce .. may lead to errors and unwanted callbacks
    d.hook('S_LOAD_CLIENT_USER_SETTING', 'raw', () => {
        // autoSync check
        if (autoSync) {
            data = getJsonData(settingsPath)
            if (!data || data.length == 0) {
                data = []
                autoSync = false
                process.nextTick(() => {
                    send(`Block list does not exist. make sure to "export" block list from characters before setting "autoSync" to "true".`.clr('FF0000'))
                })
                //console.log(`Block list does not exist. make sure to "export" block list from characters before setting "autoSync" to "true".`)
            }
            else {
                send(`autoSync enabled.`.clr('56B4E9'))
                syncBlockList()
                process.nextTick(() => {
                    send(`Block list has been synchronized.`.clr('56B4E9'))
                })
            }
        }
    })

    // id, name, myNote
    d.hook('S_ADD_BLOCKED_USER', 2, (e) => {
        let found = false,
            temp = {
                id: e.id,
                name: e.name,
                myNote: e.myNote
            }
        // state 0
        if (!data || data.length == 0) {
            playerBlockList.push(temp)
            return
        }
        // find in database
        for (let i = 0, n = data.length; i < n; i++) {
            if (data[i].name == e.name) {
                found = true
                if (data[i].myNote !== e.myNote) {
                    temp.myNote = data[i].myNote
                    // does edit but does not appear on client until relog
                    d.send('C_EDIT_BLOCKED_USER_MEMO', 1, { id: e.id, memo: temp.myNote })
                }
                break
            }
        }
        // autoSync -- add to database
        if (autoSync && !found) {
            let new_data = JSON.parse(`{ "id": ${temp.id}, "name": "${temp.name}", "myNote": "${temp.myNote}" }`)
            data.push(new_data)
            // save to database
            saveJsonData(settingsPath, data)
            send(`Synchronized blocking user "${temp.name}".`.clr('56B4E9'))
        }
        playerBlockList.push(temp)
    })

    // id, memo
    d.hook('C_EDIT_BLOCKED_USER_MEMO', 1, { filter: { fake: null } }, (e) => {
        // edit player block list
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            if (playerBlockList[i].id == e.id) {
                playerBlockList[i].myNote = e.memo
                break
            }
        }
        // state 0
        if (!data || data.length == 0) return
        // edit database if player exists
        if (autoSync) {
            for (let i = 0, n = data.length; i < n; i++) {
                if (data[i].id == e.id) {
                    data[i].myNote = e.memo
                    // save to database
                    saveJsonData(settingsPath, data)
                    send(`Synchronized memo edit of user "${data[i].name}".`.clr('56B4E9'))
                    break
                }
            }
            
        }
    })

    // name
    d.hook('C_REMOVE_BLOCKED_USER', 1, { filter: { fake: null } }, (e) => {
        // remove from player block list
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            if (playerBlockList[i].name == e.name) {
                playerBlockList.splice(i, 1)
                break
            }
        }
        // state 0
        if (!data || data.length == 0) return
        // autoSync -- remove from database
        if (autoSync) {
            for (let i = 0, n = data.length; i < n; i++) {
                if (data[i].name == e.name) {
                    data.splice(i, 1)
                    // save to database
                    saveJsonData(settingsPath, data)
                    send(`Synchronized removal of user "${e.name}".`.clr('56B4E9'))
                    break
                }
            }
            
        }
    })

    // id
    //d.hook('S_REMOVE_BLOCKED_USER', 1, (e) => {})

    // helper
    // autoSync
    function syncBlockList() {
        data = getJsonData(settingsPath)
        let found = false,
            // need separate arrays to avoid length error
            toBlock = [],
            toUnblock = []
        // state 0
        if (!data) {
            send(`Block list does not exist. make sure to "export" block list from characters first.`.clr('FF0000'))
            return
        }
        // find database player in player block list, else block
        for (let i = 0, n = data.length; i < n; i++) {
            found = false
            for (let j = 0, m = playerBlockList.length; j < m; j++) {
                if (data[i].name == playerBlockList[j].name) {
                    found = true
                    break
                }
            }
            if (!found) toBlock.push(data[i].name)
        }
        toBlock.forEach((playerName) => { d.send('C_BLOCK_USER', 1, { name: playerName }) })
        // find block list player in database, else unblock
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            found = false
            for (let j = 0, m = data.length; j < m; j++) {
                if (playerBlockList[i].name == data[j].name) {
                    found = true
                    break
                }
            }
            if (!found) toUnblock.push(playerBlockList[i].name)
        }
        toUnblock.forEach((playerName) => { d.send('C_REMOVE_BLOCKED_USER', 1, { name: playerName }) })
        send(`Block list has been synchronized. please relog to synchronize blocked user memo.`.clr('56B4E9'))
        //console.log(playerBlockList)
    }

    function exportBlockList() {
        let found = false
        if (!data || data.length == 0) data = []
        // find block list player in database, else add to database
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            found = false
            for (let j = 0, m = data.length; j < m; j++) {
                if (playerBlockList[i].name == data[j].name) {
                    found = true
                    break
                }
            }
            if (!found) {
                let new_data = JSON.parse(`{ "id": ${playerBlockList[i].id}, "name": "${playerBlockList[i].name}", "myNote": "${playerBlockList[i].myNote}" }`)
                data.push(new_data)
            }
        }
        saveJsonData(settingsPath, data)
        send(`Blocked players from current player has been exported to database.`.clr('E69F00'))
        //console.log(data)
    }

    function send(msg) { command.message(`[block-list] : ` + msg) }

}