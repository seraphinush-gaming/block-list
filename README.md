# block-list
tera-proxy module to globalize block list across a server

## Dependency
- `Command` module

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

## Installation guide
- If blocked users on other characters matter, **do not configure `autoSync` to `true` on first usage**.
- Log into each character and `export` blocked users of logged-in character to database. then
- Either a) Manually `import` blocked user data to sync every other character on server, or
- b) Configure `autoSync` to `true`, and all characters will sync to blocked user database upon login.

## Info
- **Support seraph via paypal donations, thanks in advance : [paypal](https://www.paypal.me/seraphinush)**
- Code schematic based on [Tera-Settings-Saver](https://github.com/Kaseaa/Tera-Settings-Saver) by [Kaseaa](https://github.com/Kaseaa)
- Config file can be configured via editors such as Notepad

## Changelog
<details>

    1.00
    - Initial commit

</details>