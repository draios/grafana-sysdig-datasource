# grafana-sysdig-datasource
Data source for Grafana (https://grafana.com/)

## Sysdig Datasource Plugin for Grafana

Plugin to connect Grafana with Sysdig.

More documentation about datasource plugins can be found in the [Docs](https://github.com/grafana/grafana/blob/master/docs/sources/plugins/developing/datasources.md).


## Installation

To install this plugin using the `grafana-cli` tool:

```
sudo grafana-cli plugins install grafana-sysdig-datasource
sudo service grafana-server restart
```

(To be continued...)


## Dev setup

This plugin requires node 6.10.0

`npm install -g yarn`
`yarn install`
`npm run build`


## Changelog

**v0.0.1**
- Beginning
