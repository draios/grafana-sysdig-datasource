## Sysdig Datasource Plugin for Grafana

Plugin to connect Grafana with Sysdig.



## Installation

To install this plugin using the `grafana-cli` tool:

```
sudo grafana-cli plugins install grafana-sysdig-datasource
sudo service grafana-server restart
```

or download and install the datasource manually:

```
curl https://download.sysdig.com/dev/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.0.1.11.zip -o sysdig.zip
unzip sysdig.zip
sudo cp -R sysdig /var/lib/grafana/plugins
sudo service grafana-server restart
```



## Changelog

**v0.0.1**
- The beginning...
