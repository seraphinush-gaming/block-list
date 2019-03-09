'use strict';

const fs = require('fs'),
    path = require('path'),

    config = require('./config.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

module.exports = function BlockList(mod) {
    const cmd = mod.command;

    // config
    let autoSync = config.autoSync;

    let data,
        playerBlockList = [],
        settingsPath = '';

    // command
    cmd.add('blocklist', {
        'auto': () => {
            autoSync = !autoSync;
            let temp = {
                autoSync: autoSync
            };
            fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(temp, null, 4));
            send(`autoSync ${autoSync ? 'en' : 'dis'}abled`);
        },
        'import': () => {
            syncBlockList();
        },
        'export': () => {
            exportBlockList();
        },
        '$default': () => send(`Invalid argument.`)
    });

    // game state
    mod.hook('S_LOGIN', 12, { order: -1000 }, (e) => {
        playerBlockList.length = 0;
        settingsPath = `${mod.region}-${e.serverId}.json`;
    });

    // code
    // id, level, class, name, myNote
    mod.hook('S_USER_BLOCK_LIST', 2, (e) => {
        // log player block list in array
        for (let i = 0, n = e.blockList.length; i < n; i++) {
            let temp = { id: e.blockList[i].id, name: e.blockList[i].name, myNote: e.blockList[i].myNote };
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
            if (data[i].name === e.name) {
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
            saveJsonData(settingsPath, data);
            send(`Synchronized blocking user &lt;${temp.name}&gt;.`);
        }
        playerBlockList.push(temp);
    });

    // id, memo
    mod.hook('C_EDIT_BLOCKED_USER_MEMO', 1, { filter: { fake: false } }, (e) => {
        // edit player block list
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            if (playerBlockList[i].id === e.id) {
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
                if (data[i].id === e.id) {
                    data[i].myNote = e.memo;
                    // save to database
                    saveJsonData(settingsPath, data);
                    send(`Synchronized memo edit of user &lt;${data[i].name}&gt;.`);
                    break;
                }
            }
        }
    });

    // name
    mod.hook('C_REMOVE_BLOCKED_USER', 1, { filter: { fake: null } }, (e) => {
        // remove from player block list
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            if (playerBlockList[i].name === e.name) {
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
                if (data[i].name === e.name) {
                    data.splice(i, 1);
                    saveJsonData(settingsPath, data);
                    send(`Synchronized removal of user &lt;${e.name}&gt;.`);
                    break;
                }
            }
        }
    });

    // helper
    // autoSync
    function syncBlockList() {
        let found = false,
            toBlock = [],
            toUnblock = [];
        data = getJsonData(settingsPath);
        // check data state
        if (!data) {
            send(`Block list does not exist. make sure to "export" block list from characters first.`);
            return;
        }
        // find database player in player block list, else block
        for (let i = 0, n = data.length; i < n; i++) {
            found = false;
            for (let j = 0, m = playerBlockList.length; j < m; j++) {
                if (data[i].name === playerBlockList[j].name) {
                    if (data[i].myNote != playerBlockList[j].myNote) {
                        // does edit but does not appear on client until relog
                        mod.send('C_EDIT_BLOCKED_USER_MEMO', 1, { id: data[i].id, memo: data[i].myNote });
                    }
                    found = true;
                    break;
                }
            }
            if (!found)
                toBlock.push(data[i].name);
        }
        toBlock.forEach((playerName) => {
            let flag = false;
            mod.send('C_BLOCK_USER', 1, { name: playerName });
            flag = new Promise((resolve) => {
                mod.hook('S_SYSTEM_MESSAGE', 1, { order: -1000 }, (e) => {
                    let msg = this.mod.parseSystemMessage(e.message).id;
                    (msg === 'SMT_NOT_EXIST_USER') ? resolve(true) : resolve(false);
                })
                mod.unhook('S_SYSTEM_MESSAGE');
            });
            if (flag) { // player no longer exists in game
                let index = -1;
                for (let i = 0, n = data.length; i < n; i++) {
                    if (data[i].name === playerName) {
                        index = i;
                        break;
                    }
                }
                if (index > -1)
                    data.splice(index, 1);
            }
        });
        // find block list player in database, else unblock
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            found = false;
            for (let j = 0, m = data.length; j < m; j++) {
                if (playerBlockList[i].name === data[j].name) {
                    found = true;
                    break;
                }
            }
            if (!found)
                toUnblock.push(playerBlockList[i].name);
        }
        toUnblock.forEach((playerName) => { mod.send('C_REMOVE_BLOCKED_USER', 1, { name: playerName }); });
        //
        saveJsonData(settingsPath, data);
        send(`Block list has been synchronized. please relog to synchronize blocked user memo.`);
    }

    function exportBlockList() {
        let found = false;
        if (!data || data.length === 0)
            data = [];
        // find block list player in database, else add to database
        for (let i = 0, n = playerBlockList.length; i < n; i++) {
            found = false;
            for (let j = 0, m = data.length; j < m; j++) {
                if (playerBlockList[i].name === data[j].name) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                const new_data = JSON.parse(`{ "id": ${playerBlockList[i].id}, "name": "${playerBlockList[i].name}", "myNote": "${playerBlockList[i].myNote}" }`);
                data.push(new_data);
            }
        }
        //
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
        fs.writeFileSync(path.join(__dirname, 'data', pathToFile), JSON.stringify(data, null, 4));
    }

    function send(msg) { cmd.message(': ' + msg); }

    // reload
    this.saveState = () => {
        let state = {
            data: data,
            playerBlockList: playerBlockList,
            settingsPath: settingsPath
        }
        return state;
    }

    this.loadState = (state) => {
        data = state.data;
        playerBlockList = state.playerBlockList;
        settingsPath = state.settingsPath;
    }

    this.destructor = () => { cmd.remove('blocklist'); }

}