'use strict';

const fs = require('fs');
const path = require('path');

const config = require('./config.json');

if (!fs.existsSync(path.join(__dirname, './data'))) {
    fs.mkdirSync(path.join(__dirname, './data'));
}

module.exports = function BlockList(mod) {
    const cmd = mod.command || mod.require.command;

    // config
    let autoSync = config.autoSync;

    let data,
        doesNotExist = false,
        playerBlockList = [],
        settingsPath = '';

    // command
    cmd.add(['blocklist'], {
        'import': () => {
            syncBlockList();
        },
        'export': () => {
            exportBlockList();
        },
        '$default': () => {
            send(`Invalid argument.`);
        }
    });

    // mod.game
    // empty current playerBlockList array
    // set file path
    mod.game.on('enter_game', () => {
        playerBlockList.length = 0;
        settingsPath = `${mod.region}-${mod.game.me.serverId}.json`;
    });

    // code
    // id, level, class, name, myNote
    mod.hook('S_USER_BLOCK_LIST', 2, (e) => {
        // log player block list in array
        for (let i = 0, n = e.blockList.length; i < n; i++) {
            let temp = {
                id: e.blockList[i].id,
                name: e.blockList[i].name,
                myNote: e.blockList[i].myNote
            };
            playerBlockList.push(temp);
        }
    });

    mod.hook('S_LOAD_CLIENT_USER_SETTING', 'raw', () => {
        // autoSync check
        if (autoSync) {
            data = getJsonData(settingsPath);
            if (!data || data.length === 0) {
                data = [];
                autoSync = false;
                process.nextTick(() => {
                    send(`Block list does not exist. make sure to "export" block list from characters before setting "autoSync" to "true".`);
                });
            } else {
                process.nextTick(() => {
                    send(`autoSync enabled.`);
                    syncBlockList();
                });
            }
        }
    });

    // id, name, myNote
    mod.hook('S_ADD_BLOCKED_USER', 2, (e) => {
        let found = false,
            temp = {
                id: e.id,
                name: e.name,
                myNote: e.myNote
            };
        // state 0
        if (!data || data.length === 0) {
            playerBlockList.push(temp);
            return;
        }
        // find in database
        for (let i = 0, n = data.length; i < n; i++) {
            if (data[i].name == e.name) {
                found = true;
                if (data[i].myNote != e.myNote) {
                    temp.myNote = data[i].myNote;
                    // does edit but does not appear on client until relog
                    mod.send('C_EDIT_BLOCKED_USER_MEMO', 1, { id: e.id, memo: temp.myNote });
                }
                break;
            }
        }
        // autoSync -- add to database
        if (autoSync && !found) {
            let new_data = JSON.parse(`{ "id": ${temp.id}, "name": "${temp.name}", "myNote": "${temp.myNote}" }`);
            data.push(new_data);
            // save to database
            saveJsonData(settingsPath, data);
            send(`Synchronized blocking user "${temp.name}".`);
        }
        playerBlockList.push(temp);
    });

    // id, memo
    mod.hook('C_EDIT_BLOCKED_USER_MEMO', 1, { filter: { fake: null } }, (e) => {
        // edit player block list
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            if (playerBlockList[i].id == e.id) {
                playerBlockList[i].myNote = e.memo;
                break;
            }
        }
        // state 0
        if (!data || data.length === 0)
            return;
        // edit database if player exists
        if (autoSync) {
            for (let i = 0, n = data.length; i < n; i++) {
                if (data[i].id == e.id) {
                    data[i].myNote = e.memo;
                    // save to database
                    saveJsonData(settingsPath, data);
                    send(`Synchronized memo edit of user "${data[i].name}".`);
                    break;
                }
            }
        }
    });

    // name
    mod.hook('C_REMOVE_BLOCKED_USER', 1, { filter: { fake: null } }, (e) => {
        // remove from player block list
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            if (playerBlockList[i].name == e.name) {
                playerBlockList.splice(i, 1);
                break;
            }
        }
        // state 0
        if (!data || data.length === 0)
            return;
        // autoSync -- remove from database
        if (autoSync) {
            for (let i = 0, n = data.length; i < n; i++) {
                if (data[i].name == e.name) {
                    data.splice(i, 1);
                    // save to database
                    saveJsonData(settingsPath, data);
                    send(`Synchronized removal of user "${e.name}".`);
                    break;
                }
            }
        }
    });

    // TODO
    mod.hook('S_SYSTEM_MESSAGE', 1, { order: -10000 }, (e) => {
        if (mod.parseSystemMessage(e.message).id === 'SMT_FRIEND_NOT_EXIST_USER') {
            doesNotExist = true;
        }
    })

    // id
    //mod.hook('S_REMOVE_BLOCKED_USER', 1, (e) => {})

    // helper
    // autoSync
    function syncBlockList() {
        data = getJsonData(settingsPath);
        let found = false,
            // need separate arrays to avoid length error
            toBlock = [],
            toRemove = [],
            toUnblock = [];
        // state 0
        if (!data) {
            send(`Block list does not exist. make sure to "export" block list from characters first.`);
            return;
        }
        // find database player in player block list, else block
        for (let i = 0, n = data.length; i < n; i++) {
            found = false;
            for (let j = 0, m = playerBlockList.length; j < m; j++) {
                if (data[i].name == playerBlockList[j].name) {
                    found = true;
                    break;
                }
            }
            if (!found)
                toBlock.push(data[i].name);
        }
        // TODO : remove console.log
        //console.log('To Block : ' + toBlock);
        toBlock.forEach((playerName) => {
            mod.send('C_BLOCK_USER', 1, { name: playerName });
            // TODO
            if (doesNotExist) {
                toRemove.push(playerName);
                doesNotExist = false;
            }
        });
        // TODO : remove console.log
        //console.log('To Remove : ' + toRemove);
        // find block list player in database, else unblock
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            found = false;
            for (let j = 0, m = data.length; j < m; j++) {
                if (playerBlockList[i].name == data[j].name) {
                    found = true;
                    break;
                }
            }
            if (!found)
                toUnblock.push(playerBlockList[i].name);
        }
        // TODO
        toUnblock.forEach((playerName) => { mod.send('C_REMOVE_BLOCKED_USER', 1, { name: playerName }); });
        send(`Block list has been synchronized. please relog to synchronize blocked user memo.`);
        toBlock = undefined;
        toRemove = undefined;
        toUnblock = undefined;
    }

    function exportBlockList() {
        let found = false;
        if (!data || data.length === 0)
            data = [];
        // find block list player in database, else add to database
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            found = false;
            for (let j = 0, m = data.length; j < m; j++) {
                if (playerBlockList[i].name == data[j].name) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                let new_data = JSON.parse(`{ "id": ${playerBlockList[i].id}, "name": "${playerBlockList[i].name}", "myNote": "${playerBlockList[i].myNote}" }`);
                data.push(new_data);
            }
        }
        saveJsonData(settingsPath, data);
        send(`Blocked players from current player has been exported to database.`);
    }

    function getJsonData(pathToFile) {
        try {
            return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', pathToFile)));
        } catch (e) {
            return undefined;
        }
    }

    function saveJsonData(pathToFile, data) {
        fs.writeFileSync(path.join(__dirname, 'data', pathToFile), JSON.stringify(data));
    }

    function send(msg) { cmd.message(': ' + msg); }

}