## Monster UI Storage Engine Management

The Storage Engine Management app allows you to configure storage

Requires [Monster UI v.4.3](https://github.com/2600hz/monster-ui)


#### Build && Installation
1. Run `npm install`
2. Run `npm run build`
3. Copy files from directory `dist` to directory with files of your Monster UI (*near the folders "apps", "css" and "js"*)
4. Register `storagemgmt` app
```bash
# sup crossbar_maintenance init_app PATH_TO_STORAGEMGMT_APP_DIRECTORY API_ROOT
# The Kazoo user should be able to read files from recordings app directory
sup crossbar_maintenance init_app /var/www/html/apps/storagemgmt https://site.com:8443/v2/
```
5. Activate the Storage Engine Management app in Monster UI App Store ( `/#/apps/appstore` )
