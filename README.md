_Note: Public readme is available at https://gist.github.com/davideschiera/9bcb026e5d45b9dc4def48c525dd8cdb_


## Sysdig Datasource Plugin for Grafana (Beta)

This README discusses the installation and configuration instructions for the Sysdig datasource plugin for Grafana.

> **Note:** The Sysdig datasource plugin is currently not included in the [official & community built plugin page](https://grafana.com/plugins), and needs to be installed manually.

<p align="center">
    <img alt="Sysdig datasource" src="https://user-images.githubusercontent.com/5033993/39788129-bd3963fe-52dd-11e8-86b0-10e127660e68.gif" width="1200" />
</p>


## Getting Started

### Installation

There are several installation approaches available for the Sysdig datasource plugin:

#### Using a Grafana Docker Container

An easy and flexible way to add the Sysdig datasource plugin to a Grafana container is to create a custom image:

1. Download the plugin to the _grafana-sysdig_ directory:
```
user@host:~$ curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.2.tgz -o sysdig.tgz
user@host:~$ mkdir grafana-sysdig
user@host:~$ tar zxf sysdig.tgz -C grafana-sysdig
user@host:~$ cd grafana-sysdig
```
2. Create a container image Dockerfile:
```
user@host:grafana-sysdig$ echo "ARG GRAFANA_VERSION=\"latest\"

FROM grafana/grafana:\${GRAFANA_VERSION}

ADD grafana-sysdig /var/lib/grafana/plugins/sysdig
" > Dockerfile
```
3. Build the image:
```
user@host:grafana-sysdig$ docker build -t grafana-sysdig .
```
4. Run the image:
```
user@host:grafana-sysdig$ docker run -d -p 3000:3000 --name grafana grafana-sysdig
```

> **Note:** For more information, refer to the [Grafana installation using Docker](http://docs.grafana.org/installation/docker/) page.

---

Alternatively, the default Grafana container image can be used as is, and the plugin directory can be mounted on the host to make it available in the container:

1. Prepare the Grafana data directory and download the plugin:
```
user@host:~$ mkdir grafana-data
user@host:~$ mkdir grafana-data/plugins
user@host:~$ curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.2.tgz -o sysdig.tgz
user@host:~$ tar zxf sysdig.tgz -C grafana-data/plugins
```
2. Start the container with the current user, to give read/write permissions to the data directory:
```
ID=$(id -u)
user@host:~$ docker run -d --user $ID --volume "$PWD/grafana-data:/var/lib/grafana" -p 3000:3000 grafana/grafana:latest
```

> **Note:** For more information, refer to the [Grafana installation documentation](http://docs.grafana.org/installation/docker/#grafana-container-using-bind-mounts) and the [Docker documentation](https://docs.docker.com/storage/bind-mounts/).


#### Using Grafana Installed on the Host

The plugin can be installed on any host where Grafana is installed. To install the plugin:

1. Open a shell terminal.
2. Run the relevant series of commands for the operating system:

##### Linux

```
user@host:~$ curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.2.tgz -o sysdig.tgz
user@host:~$ tar zxf sysdig.tgz
user@host:~$ sudo cp -R sysdig /var/lib/grafana/plugins
user@host:~$ sudo service grafana-server restart
```

> **Note**: Grafana plugins are installed in `/usr/share/grafana/plugins`. However, the Sysdig plugin must be installed in `/var/lib/grafana/plugins` instead.


##### Mac

```
user@host:~$ curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.2.tgz -o sysdig.tgz
user@host:~$ tar zxf sysdig.tgz
user@host:~$ cp -R sysdig /usr/local/var/lib/grafana/plugins
user@host:~$ brew services restart grafana
```

> **Note:** For more information, refer to the [Grafana installation on Mac](http://docs.grafana.org/installation/mac/) documentation.


##### Windows

1. Download the plugin from: https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.2.zip
2. Install the plugin in the Grafana plugins folder.
3. Restart Grafana.

> **Note:** For more information, refer to the [Grafana installation on Windows](http://docs.grafana.org/installation/windows/) documentation.


### 2. Add datasource

In Grafana, select **Add Data Sources**:

1. **Name**: Any name of your choice
2. **Type**: Choose _Sysdig_
3. **Plan**: Pick _Basic/Pro Cloud_ if you use Sysdig SaaS or _Pro Software_ if you use on premises
4. **API Token**: In your Sysdig UI go to _Settings -> User Profile -> Sysdig Monitor API token_. Copy the token and paste it.

<p align="center">
    <img alt="Add Sysdig datasource" src="https://user-images.githubusercontent.com/5033993/39788137-d0932188-52dd-11e8-845a-3ba9c5f99842.gif" width="900" />
</p>


### 3. Import Sysdig dashboards

After creating the datasource you will have the ability to import your Sysdig Monitor dashboards into Grafana. Click **Import** to get all your dashboards from Sysdig. Go to **Dashboards Home page** and pull down your dashboard selection to see all your dashboards here.

<p align="center">
    <img alt="Import Sysdig dashboards" src="https://user-images.githubusercontent.com/5033993/39788145-df340996-52dd-11e8-9ec1-16efedada047.gif" width="900" />
</p>


## Panels

With the Sysdig datasource installed you can add your custom panels. You can use all the panels supported by Grafana, documented on the [Grafana documentation website](http://docs.grafana.org/features/panels/graph/).


### Aggregated panels

In Sysdig, number panels, bar charts and histograms display aggregated data (i.e. a single data point across the entire time window). By default, Grafana loads time series and then apply an additional aggregation to data points to calculate a single value (displayed in the Singlestat panel for instance).

In order to maintain the same aggregation mechanism and precision offered by Sysdig API, you can create panels with the "Fetch single data point" flag turned on. This will instruct the datasource to make an aggregated data request to the API.


### Filters

A panel can be configured with an optional filter to fetch data for a subset of the infrastructure or a given label only.

The filter is a string, and should follow the Sysdig filtering language syntax:

1. The syntax of an expression is `label_name operator "label_value"` (double-quotes are mandatory)
2. You can combine more expressions with the usual boolean operators and/or (`expression and expression or expression`)
3. The following operators are supported:
   a. `=` and `!=` (e.g. `name = "value"` or `name != "value"`)
   b. `contains` and `not ... contains` (e.g. `name contains "value"` or `not name contains "value"`)
   c. `in` and `not... in` (e.g. `name in ("value-1", "value-2")` or `not name in ("value-1", "value-2")`)
4. Valid label names are essentially the ones you can use for the segmentation (you can use the *Segment by* dropdown to look for what you need)

Some examples:

* `host.hostName = "ip-1-2-3-4"`
* `cloudProvider.availabilityZone = "us-east-2b" and container.name = "boring_sinoussi"` (where `cloudProvider.*` are labels coming from AWS)
* `kubernetes.namespace.name = "java-app" and kubernetes.deployment.name in ("cassandra", "redis")`



## Variables

Variables allow you to create dynamic and interactive dashboards. It is highly suggested to take a look at [Grafana Variables documentation](http://docs.grafana.org/reference/templating/) for use cases, examples, and more.

The Sysdig datasource plugin supports variables. You can use variables to configure 3 properties of a dashboard panel:

1. **Metric**: You can use a variable to select the **metric name** to use for the panel
2. **Segmentation** (*Segment by* field): You can use a variable to select the **label name** to segment data
3. **Filter**: You can use variables to select either a **label name** or one (or more) **label values**

The following list shows how variables can be configured:

1. *Query*, *custom*, and *constant* variable types are supported
2. The query for a **metric name** can use the function `metrics(pattern)` that returns a list of metrics matching the specific `pattern` regex
3. The query for a **label name** can use the function `label_names(pattern)` that returns a list of label names matching the specific `pattern` regex
4. The query for a **label value** can use the function `label_values(label_name)` that returns a list of label values for the specified label name
5. **metric name** and **label name** variables cannot have *multi-value* or *include all option* properties enabled
6. A **label value** can be configured with *multi-value* and/or *include all option* properties enabled **only** with `in` and `not ... in` operators


### Metric names

You can create a variable that will identify a metric name, and use it to configure a panel with a dynamic metric.

A couple of notes about variables for metric names:

1. You can use a *Query*, *Custom*, or *Constant* variables. Please note that *Multi-value* and *Include All option* must be disabled
2. *Query* variables can use the `metrics(pattern)` function, that returns a list of metrics matching the specific `pattern` regex

<p align="center">
    <img width="900" alt="Metric variable configuration" src="https://user-images.githubusercontent.com/5033993/39940750-26fb6bec-550f-11e8-9cad-97af134d4252.png">
</p>
<p align="center">
    <img width="900" alt="Metric variable" src="https://user-images.githubusercontent.com/5033993/39940748-26b4ef64-550f-11e8-8935-d044716a9891.png">
</p>


### Label names

Label names are used for panel segmentations (*Segment by* field) and filters.

A couple of notes about variables for label names:

1. You can use a *Query*, *Custom*, or *Constant* variables. Please note that *Multi-value* and *Include All option* must be disabled
2. *Query* variables can use the `label_names(pattern)` function, that returns a list of label names matching the specific `pattern` regex

<p align="center">
    <img width="900" alt="Segmentation variable configuration" src="https://user-images.githubusercontent.com/5033993/39940754-275b9846-550f-11e8-8ce4-130e3d4f3dac.png">
</p>
<p align="center">
    <img width="900" alt="Segmentation variable" src="https://user-images.githubusercontent.com/5033993/39940749-26d92ec4-550f-11e8-8e3e-1f21dae9cfcc.png">
</p>


### Label values

Label values are used in filters to identify a subset of the infrastructure or data in general. With variables, you can create a row per service or using a single dashboard to analyze all your applications.

Some notes about variables for label values:

1. You can use a *Query*, *Custom*, or *Constant* variables
2. *Query* variables can use the `label_values(label_name)` function, that returns a list of label values for the specified label name
3. *Multi-value* variables, or variables with *Include All option* enabled can **only** be used with `in` and `not ... in` operators
4. Variables must not be enclosed by quotes, the final string will contain quotes when needed (e.g. `$name = $value` will be resolved to `metric = "foo"`)

<p align="center">
    <img width="900" alt="Filter variable configuration" src="https://user-images.githubusercontent.com/5033993/39940752-27214a42-550f-11e8-854b-f696c321c383.png">
</p>
<p align="center">
    <img width="900" alt="Filter variable" src="https://user-images.githubusercontent.com/5033993/39940747-26936a74-550f-11e8-8af2-a2217598ba1e.png">
</p>


And here is the final result, with dynamic rows and panels:

<p align="center">
    <img width="1200" alt="Final dashboard with variables" src="https://user-images.githubusercontent.com/5033993/39940746-26706f88-550f-11e8-81c2-51cc9233c18c.png">
</p>

---


## Current limitations

The Sysdig datasource is in beta version. We'll iterate quickly to make it more complete and robust, in the meanwhile you might encounter some issues. Here is a list of known limitations:

1. The datasource has been tested with Grafana 4.6 and the latest release (5.1). If you're using other versions of Grafana, we'll be happy to add it to the testing suite!
3. We'll leverage [annotations](http://docs.grafana.org/reference/annotations/) to show Sysdig events, but we don't support it just yet
4. Grafana supports [tables](http://docs.grafana.org/features/panels/table_panel/), but they are quite different from [Sysdig tables](https://support.sysdig.com/hc/en-us/articles/204259479-Customize-Panels). For this reason, importing Sysdig dashboards will not create table panels. This might not be true forever...
5. Topology panels are not supported in Grafana, so importing Sysdig dashboards will ignore these panels
6. With Grafana you can enter any arbitrary [time range](http://docs.grafana.org/reference/timerange/), but data will be fetched according to retention and granularity restrictions as explained in this [Sysdig Support page](https://support.sysdig.com/hc/en-us/articles/204889655)
7. Grafana doesn't support exponential y-axis scale (the import from Sysdig will fallback to linear scale)


## Support / Community

The Sysdig Datasource Plugin for Grafana is currently in beta. We'd love to hear from you and help you with it!

Join our [Public Slack](https://slack.sysdig.com) channel ([#grafana](https://sysdig.slack.com/messages/CA7RSQXK9)) for announcements and discussions.
