# block-list [![paypal](https://img.shields.io/badge/paypal-donate-333333.svg?colorA=253B80&colorB=333333)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=B7QQJZV9L5P2J&source=url) [![paypal.me](https://img.shields.io/badge/paypal.me-donate-333333.svg?colorA=169BD7&colorB=333333)](https://www.paypal.me/seraphinush) 
tera-proxy module to globalize block list across a server
```
Support seraph via paypal donations, thanks in advance !
```

## Auto-update guide
- Create a folder called `block-list` in `tera-proxy/mods` and download [`module.json`](https://raw.githubusercontent.com/seraphinush-gaming/block-list/master/module.json) (right-click this link and save as..) into the folder

## Usage
- __`blocklist`__
### Arguments
- __`import`__
  - Synchronize blocked users from database to currently logged-in character
  - Any user in database that is not blocked will be blocked, and
  - Any user blocked but not in database will be unblocked
- __`export`__
  - Export blocked users of currently logged-in character to database

## Config
- __`autoSync`__
  - Synchronization of block list across all logged-in characters on login
  - Synchronizes for adding and removing block users, and editing block user memo
  - Default is `false`

## Guide
- If blocked users on other characters matter, **do not configure `autoSync` to `true` on first usage**.
- Log into each character and `export` blocked users of logged-in character to database. then
- Either a) Manually `import` blocked user data to sync every other character on server, or
- b) Configure `autoSync` to `true`, and all characters will sync to blocked user database upon login.

## Info
- Code schematic based on [`Tera-Settings-Saver`](https://github.com/Kaseaa/Tera-Settings-Saver) by [Kaseaa](https://github.com/Kaseaa)
- Config file can be configured via editors such as Notepad
- Does not auto-block player undergone name change

## Changelog
<details>

    1.03
    - Fixed sync issue with non-existent players
    - Fixed sync issue with memo
    1.02
    - Updated for caali-proxy-nextgen
    1.01
    - Removed `command` require()
    - Removed `tera-game-state` require()
    - Updated to `mod.command`
    - Updated to `mod.game`
    1.00
    - Initial commit

</details>