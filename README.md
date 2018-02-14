## Sysdig Datasource Plugin for Grafana

Plugin to connect Grafana with Sysdig.



## Installation

At this time, the Sysdig datasource is not included in the [Official & community built plugin page](https://grafana.com/plugins). You will need to install the plugin manually.

Open a shell on the host where Grafana is installed, then run the following commands:

```
curl https://download.sysdig.com/dev/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.0.1.zip -o sysdig.zip
unzip sysdig.zip
sudo cp -R sysdig /var/lib/grafana/plugins
sudo service grafana-server restart
```


## Current limitations

In the current beta version of the datasource there are some limitations in how you can use Sysdig in your Grafana:

1. [Templating](http://docs.grafana.org/reference/templating/) is not supported yet, but will come soon
2. We'll leverage [annotations](http://docs.grafana.org/reference/annotations/) to show Sysdig events, but we don't support it just yet
3. With Grafana you can enter any arbitrary [time range](http://docs.grafana.org/reference/timerange/), but data will be fetched according to retention and granularity restrictions as explained in this [Sysdig Support page](https://support.sysdig.com/hc/en-us/articles/204889655)
4. [Singlestat](http://docs.grafana.org/features/panels/singlestat/) is available, but Grafana will apply an additional aggregation on top of the time and group aggregation Sysdig applies. For this reason, numbers might not match what you see in Sysdig
5. Grafana supports [tables](http://docs.grafana.org/features/panels/table_panel/), but they are very different from [Sysdig tables](https://support.sysdig.com/hc/en-us/articles/204259479-Customize-Panels). For this reason, importing Sysdig dashboards will not create table panels
6. Topology panels are not supported in Grafana, so importing Sysdig dashboards will ignore these panels
7. Sysdig doesn't support exponential y-axis scale


## Changelog

**v0.0.1**
- The beginning...
