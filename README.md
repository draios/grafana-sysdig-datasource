_Note: Public readme is available at https://gist.github.com/davideschiera/9bcb026e5d45b9dc4def48c525dd8cdb_


## Sysdig Datasource Plugin for Grafana (beta)

Plugin to connect Grafana with Sysdig.

![grafana-create-sysdig-panel](https://user-images.githubusercontent.com/5033993/36926795-683a6102-1e2e-11e8-9a9c-146657fb2ef2.gif)


## Getting started!

### 1. Installation

At this time, the Sysdig datasource is not included in the [Official & community built plugin page](https://grafana.com/plugins). You will need to install the plugin manually.


#### Grafana Docker container

An easy and flexible way to add the Sysdig datasource plugin to your Grafana container is to create a custom image.

Here's how:

```
# download plugin into grafana-sysdig directory
curl https://download.sysdig.com/dev/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.0.1.tgz -o sysdig.tgz
mkdir grafana-sysdig
tar zxf sysdig.tgz -C grafana-sysdig

# create container image Dockerfile
echo "ARG GRAFANA_VERSION=\"latest\"

FROM grafana/grafana:\${GRAFANA_VERSION}

ADD grafana-sysdig /var/lib/grafana/plugins/sysdig
" > Dockerfile

# build the image...
docker build -t grafana-sysdig .

# ... and run it!
docker run -d -p 3000:3000 --name grafana grafana-sysdig
```

For more information, refer to [Grafana installation using Docker page](http://docs.grafana.org/installation/docker/).

---

Alternatively, You can use the Grafana container image as is, and mount the plugin directory on your host to make it available in the container.

```
# prepare Grafana data directory and download the plugin 
mkdir grafana-data
mkdir grafana-data/plugins

curl https://download.sysdig.com/dev/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.0.1.tgz -o sysdig.tgz
tar zxf sysdig.tgz -C grafana-data/plugins

# start the container (with current user to give read/write permissions to data directory)
ID=$(id -u)
docker run -d --user $ID --volume "$PWD/grafana-data:/var/lib/grafana" -p 3000:3000 grafana/grafana:latest
```

For more information, refer to [Grafana installation page](http://docs.grafana.org/installation/docker/#grafana-container-using-bind-mounts) and [Docker documentation](https://docs.docker.com/storage/bind-mounts/).


#### Using Grafana installed on host

Open a shell on the host where Grafana is installed, then run the following commands:

##### Linux

```
curl https://download.sysdig.com/dev/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.0.1.tgz -o sysdig.tgz
tar zxf sysdig.tgz
sudo cp -R sysdig /var/lib/grafana/plugins
sudo service grafana-server restart
```

**Note**: You might find Grafana plugins installed in `/usr/share/grafana/plugins`, but Sysdig plugin must be installed in `/var/lib/grafana/plugins` instead.


##### Mac

```
curl https://download.sysdig.com/dev/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.0.1.tgz -o sysdig.tgz
tar zxf sysdig.tgz
cp -R sysdig /usr/local/var/lib/grafana/plugins
brew services restart grafana
```

For more information, refer to [Grafana installation on Mac page](http://docs.grafana.org/installation/mac/).


##### Windows

1. Download plugin from: https://download.sysdig.com/dev/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.0.1.zip
2. Install the plugin to Grafana plugins folder
3. Restart Grafana

For more information, refer to [Grafana installation on Windows page](http://docs.grafana.org/installation/windows/).


### 2. Add datasource

In Grafana, select **Add Data Sources**:

1. **Name**: Any name of your choice
2. **Type**: Choose _Sysdig_
3. **Plan**: Pick _Basic/Pro Cloud_ if you use Sysdig SaaS or _Pro Software_ if you use on premises
4. **API Token**: In your Sysdig UI go to _Settings -> User Profile -> Sysdig Monitor API token_. Copy the token and paste it.

![datasource-settings](https://user-images.githubusercontent.com/5033993/36221808-25c222cc-1174-11e8-99d2-b7e06fb0f52d.png)
![grafana-create-sysdig-ds](https://user-images.githubusercontent.com/5033993/36926798-68658f44-1e2e-11e8-8fac-61fb1a470e6e.gif)


### 3. Import Sysdig dashboards

After creating the datasource you will have the ability to import your Sysdig Monitor dashboards into Grafana. Click **Import** to get all your dashboards from Sysdig. Go to **Dashboards Home page** and pull down your dashboard selection to see all your dashboards here.

![grafana-import-sysdig-dashboards](https://user-images.githubusercontent.com/5033993/36926796-684fb0ac-1e2e-11e8-9769-541d2fd857b0.gif)



## Current limitations

The Sysdig datasource is in beta version. We'll iterate quickly to make it more complete and robust, in the meanwhile you might encounter some issues. Here is a list of known limitations:

1. First off, we'll try to support a wider range of Grafana versions, for now we tested the datasource with Grafana 4.6 and 5.0. If you're using other versions of Grafana, we'll be happy to make it working for you!
2. [Templating](http://docs.grafana.org/reference/templating/) is not supported yet, but will come soon
3. We'll leverage [annotations](http://docs.grafana.org/reference/annotations/) to show Sysdig events, but we don't support it just yet
4. With Grafana you can enter any arbitrary [time range](http://docs.grafana.org/reference/timerange/), but data will be fetched according to retention and granularity restrictions as explained in this [Sysdig Support page](https://support.sysdig.com/hc/en-us/articles/204889655)
5. [Singlestat](http://docs.grafana.org/features/panels/singlestat/) is available, but Grafana will apply an additional aggregation on top of the time and group aggregation Sysdig applies. For this reason, numbers might not match what you see in Sysdig
6. Grafana supports [tables](http://docs.grafana.org/features/panels/table_panel/), but they are very different from [Sysdig tables](https://support.sysdig.com/hc/en-us/articles/204259479-Customize-Panels). For this reason, importing Sysdig dashboards will not create table panels
7. Topology panels are not supported in Grafana, so importing Sysdig dashboards will ignore these panels
8. Sysdig doesn't support exponential y-axis scale


## Support / Community

The Sysdig Datasource Plugin for Grafana is currently in beta. We'd love to hear from you and help you with it!

Join our [Public Slack](https://slack.sysdig.com) channel (#grafana) for announcements and discussions.


## Changelog

**v0.0.1**
- The beginning...
