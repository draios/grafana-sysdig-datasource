## Sysdig Datasource Plugin for Grafana (Beta)

This README discusses the installation and configuration instructions for the Sysdig datasource plugin for Grafana.

<p align="center">
    <img alt="Sysdig datasource" src="https://user-images.githubusercontent.com/5033993/39788129-bd3963fe-52dd-11e8-86b0-10e127660e68.gif" width="1200" />
</p>


## Getting Started

### Installation

There are several installation approaches available for the Sysdig datasource plugin.

> **Note:** The Sysdig datasource plugin is currently not included in the [official & community built plugin page](https://grafana.com/plugins), and needs to be installed manually.

#### Using a Grafana Docker Container

An easy and flexible way to add the Sysdig datasource plugin to a Grafana container is to create a custom image:

1. Download the plugin to the _grafana-sysdig_ directory:
```
curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.5.1.tgz -o sysdig.tgz
mkdir grafana-sysdig
tar zxf sysdig.tgz -C grafana-sysdig
cd grafana-sysdig
```
2. Create a container image Dockerfile:
```
echo "ARG GRAFANA_VERSION=\"latest\"

FROM grafana/grafana:\${GRAFANA_VERSION}

ADD sysdig /var/lib/grafana/plugins/sysdig
" > Dockerfile
```
3. Build and run the image:
```
docker build -t grafana-sysdig .
docker run -d -p 3000:3000 --name grafana grafana-sysdig
```

> **Note:** For more information, refer to the [Grafana installation using Docker](http://docs.grafana.org/installation/docker/) page.

---

Alternatively, the default Grafana container image can be used as is, and the plugin directory can be mounted on the host to make it available in the container:

1. Prepare the Grafana data directory and download the plugin:
```
mkdir grafana-data
mkdir grafana-data/plugins
curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.5.1.tgz -o sysdig.tgz
tar zxf sysdig.tgz -C grafana-data/plugins
```
2. Start the container with the current user, to give read/write permissions to the data directory:
```
ID=$(id -u)
docker run -d --user $ID --volume "$PWD/grafana-data:/var/lib/grafana" -p 3000:3000 grafana/grafana:latest
```

> **Note:** For more information, refer to the [Grafana installation documentation](http://docs.grafana.org/installation/docker/#grafana-container-using-bind-mounts) and the [Docker documentation](https://docs.docker.com/storage/bind-mounts/).


#### Using Grafana Installed on the Host

The plugin can be installed on any host where Grafana is installed. To install the plugin:

##### Linux

1. Open a shell terminal.
2. Run the series of commands below:
```
curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.5.1.tgz -o sysdig.tgz
tar zxf sysdig.tgz
sudo cp -R sysdig /var/lib/grafana/plugins
sudo service grafana-server restart
```

> **Note**: Grafana plugins are installed in `/usr/share/grafana/plugins`. However, the Sysdig plugin must be installed in `/var/lib/grafana/plugins` instead.


##### Mac


1. Open a shell terminal.
2. Run the series of commands below:
```
curl https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.5.1.tgz -o sysdig.tgz
tar zxf sysdig.tgz
cp -R sysdig /usr/local/var/lib/grafana/plugins
brew services restart grafana
```

> **Note:** For more information, refer to the [Grafana installation on Mac](http://docs.grafana.org/installation/mac/) documentation.


##### Windows

1. Download the plugin from: https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.5.1.zip
2. Install the plugin in the Grafana plugins folder.
3. Restart Grafana.

> **Note:** For more information, refer to the [Grafana installation on Windows](http://docs.grafana.org/installation/windows/) documentation.


### 2. Add datasource

To add a datasource to Grafana:

1. Open Grafana.
2. On the Datasources tab, click the **Add Data Sources** button.
3. Define a name for the datasource.
4. Open the Type dropdown menu, and select _Sysdig_.
5. Open the Plan dropdown menu, and select either _Basic/Pro Cloud_ for Sysdig SaaS or _Pro Software_ for on-premises installations.
6. Open the Sysdig UI, and navigate to **Settings -> User Profile -> Sysdig Monitor API token**.
7. Copy the API token, and paste it into the API Token field in Grafana.

<p align="center">
    <img alt="Add Sysdig datasource" src="https://user-images.githubusercontent.com/5033993/39788137-d0932188-52dd-11e8-845a-3ba9c5f99842.gif" width="900" />
</p>


### 3. Import Sysdig dashboards

After creating the datasource, Sysdig Monitor dashboards can then be imported into Grafana:

1. On the Datasources tab, select the Sysdig datasource.
2. Click the **Import** button for dashboards.
3. Navigate to the **Dashboards** home page, and pull down the dashboard selection to see all the dashboards available.

<p align="center">
    <img alt="Import Sysdig dashboards" src="https://user-images.githubusercontent.com/5033993/39788145-df340996-52dd-11e8-9ec1-16efedada047.gif" width="900" />
</p>


## Panels

Custom panels can be added once the Sysdig datasource is installed. Any panel supported by Grafana can be used.

> **Note:** For more information, refer to the [Grafana documentation website](http://docs.grafana.org/features/panels/graph/).


### Aggregated panels

In Sysdig, number panels, bar charts and histograms display aggregated data (i.e. a single data point across the entire time window). By default, Grafana loads time series and then applies an additional aggregation to data points to calculate a single value (displayed in the Singlestat panel for instance).

> **Note:** To maintain the same aggregation mechanism and precision offered by the Sysdig API, create panels with the "Fetch single data point" flag turned on. This will instruct the datasource to make an aggregated data request to the API.


### Filters

A panel can be configured with an optional filter to fetch data for a subset of the infrastructure or only for a given label.

The filter is a string, and should follow the Sysdig filtering language syntax:

* The syntax of an expression is `label_name operator "label_value"` (double-quotes are mandatory)
* Expressions can be combined with the boolean operators and/or (`expression and expression or expression`)
* The following operators are supported:
   * `=` and `!=` (e.g. `name = "value"` or `name != "value"`)
   * `contains` and `not ... contains` (e.g. `name contains "value"` or `not name contains "value"`)
   * `in` and `not... in` (e.g. `name in ("value-1", "value-2")` or `not name in ("value-1", "value-2")`)
* Valid label names are essentially the ones used for the segmentation (use the *Segment by* dropdown to review what is needed).

Some examples:

* `host.hostName = "ip-1-2-3-4"`
* `cloudProvider.availabilityZone = "us-east-2b" and container.name = "boring_sinoussi"` (where `cloudProvider.*` are labels coming from AWS)
* `kubernetes.namespace.name = "java-app" and kubernetes.deployment.name in ("cassandra", "redis")`



## Variables

The Sysdig datasource plugin supports variables, allowing for dynamic and interactive dashboards to be created.

> **Note:** Sysdig recommends reviewing the [Grafana Variables documentation](http://docs.grafana.org/reference/templating/) for use cases, examples, and more.

Variables can be used to configure three properties of a dashboard panel:

* **Metric**: Select the **metric name** to use for the panel.
* **Segmentation** (*Segment by* field): Select the **label name** to segment data.
* **Filter**: Select either a **label name** or one (or more) **label values**.

The following list shows how variables can be configured:

* *Query*, *custom*, and *constant* variable types are supported
* The query for a **metric name** can use the function `metrics(pattern)` that returns a list of metrics matching the specific `pattern` regex
* The query for a **label name** can use the function `label_names(pattern)` that returns a list of label names matching the specific `pattern` regex
* The query for a **label value** can use the function `label_values(label_name)` that returns a list of label values for the specified label name
* **metric name** and **label name** variables cannot have *multi-value* or *include all option* properties enabled
* A **label value** can be configured with *multi-value* and/or *include all option* properties enabled **only** with `in` and `not ... in` operators


### Metric names

Variables can be created to identify a metric name, and then use it to configure a panel with a dynamic metric.

A couple of notes about variables for metric names:

* *Query*, *Custom*, or *Constant* variables can be used.
  > **Note:** Please note that the *Multi-value* and *Include All* options must be disabled.
* *Query* variables can use the `metrics(pattern)` function, that returns a list of metrics matching the specific `pattern` regex.

<p align="center">
    <img width="900" alt="Metric variable configuration" src="https://user-images.githubusercontent.com/5033993/39940750-26fb6bec-550f-11e8-9cad-97af134d4252.png">
</p>
<p align="center">
    <img width="900" alt="Metric variable" src="https://user-images.githubusercontent.com/5033993/39940748-26b4ef64-550f-11e8-8935-d044716a9891.png">
</p>


### Label names

Label names are used for panel segmentations (*Segment by* field) and filters.

A couple of notes about variables for label names:

* *Query*, *Custom*, or *Constant* variables can be used.
  > **Note:** Please note that the *Multi-value* and *Include All* options must be disabled.
* *Query* variables can use the `label_names(pattern)` function, that returns a list of label names matching the specific `pattern` regex.

<p align="center">
    <img width="900" alt="Segmentation variable configuration" src="https://user-images.githubusercontent.com/5033993/39940754-275b9846-550f-11e8-8ce4-130e3d4f3dac.png">
</p>
<p align="center">
    <img width="900" alt="Segmentation variable" src="https://user-images.githubusercontent.com/5033993/39940749-26d92ec4-550f-11e8-8e3e-1f21dae9cfcc.png">
</p>


### Label values

Label values are used in filters to identify a subset of the infrastructure or data in general, allowing users to create a row per service, or use a single dashboard to analyze all available applications.

Some notes about variables for label values:

* You can use a *Query*, *Custom*, or *Constant* variables.
* *Query* variables can use the `label_values(label_name)` function, that returns a list of label values for the specified label name.
* The query accepts the following optional parameters:
  1. `filter` to limit the list of values according to the specified filter. Example: `label_values(kubernetes.namespace.name, filter='kubernetes.deployment.name = "foo"')` to return a list of Kubernetes namespaces within the Kubernetes deployment named `foo`. You can also refer to other variables in the filter for an additional level of customization in dashboards
  2. `from`, `to`, `limit` to control the subset of values to show in the menu in the dashboard (by default, `from=0, to=99` to return the first 100 entries)
* *Multi-value* variables, or variables with the *Include All* option enabled can **only** be used with `in` and `not ... in` operators.
* Variables must not be enclosed by quotes.
  > **Note:** The final string will contain quotes when needed (e.g. `$name = $value` will be resolved to `metric = "foo"`).

<p align="center">
    <img width="900" alt="Filter variable configuration" src="https://user-images.githubusercontent.com/5033993/39940752-27214a42-550f-11e8-854b-f696c321c383.png">
</p>
<p align="center">
    <img width="900" alt="Filter variable" src="https://user-images.githubusercontent.com/5033993/39940747-26936a74-550f-11e8-8af2-a2217598ba1e.png">
</p>


The complete example below contains dynamic rows and panels:

<p align="center">
    <img width="1200" alt="Final dashboard with variables" src="https://user-images.githubusercontent.com/5033993/39940746-26706f88-550f-11e8-81c2-51cc9233c18c.png">
</p>

---


## Current limitations

The Sysdig datasource is currently in Beta. Sysdig will continue to release iterations to make the datasource more complete and robust; however, some issues may be encountered. A list of known limitations is provided below:

* The datasource is being tested with latest version of Grafana. If you're using older versions of Grafana and you find any issues, please report the issue and we'll make sure to support your version of Grafana!
* We leverage [annotations](http://docs.grafana.org/reference/annotations/) to show Sysdig events, but we don't support it just yet.
* Topology panels are not supported in Grafana, so importing Sysdig dashboards will ignore these panels.
* With Grafana you can enter any arbitrary [time range](http://docs.grafana.org/reference/timerange/), but data will be fetched according to retention and granularity restrictions as explained in this [Sysdig Support page](https://support.sysdig.com/hc/en-us/articles/204889655).
* Grafana doesn't support exponential y-axis scale (the import from Sysdig will fallback to linear scale).


## Support / Community

The Sysdig Datasource Plugin for Grafana is currently in beta. We'd love to hear from you and help you with it!

Join our [Public Slack](https://slack.sysdig.com) channel ([#grafana](https://sysdig.slack.com/messages/CA7RSQXK9)) for announcements and discussions.
