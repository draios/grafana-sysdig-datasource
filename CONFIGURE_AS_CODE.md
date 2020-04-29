#### Codifing the Sysdig Datasource with Grafana

These instructions will often apply to container-based platforms such as kubernetes and is focused more on how to codify the installation and configuration of the datasource & dashboards. Grafana supports many dynamic configuration capabilites such as using Environment Variables or loading in dashboard and datasource configurations. 

1. Install the plugin in a Grafana container image with an Environment Variable
   - Set the following environment variable to auto-install the plugin at launch (Tip: you must use the .zip package)
```
GF_INSTALL_PLUGINS=https://download.sysdig.com/stable/grafana-sysdig-datasource/grafana-sysdig-datasource-v0.7.zip;sysdig
```

2. Configure the datasource in code (such as a kubernetes configMap)
   - Create the sysdig datasource configuration such as `/etc/grafana/provisioning/datasources/datasource.yml`
   - What's important here is that the apiToken is embedded into the jsonData section
```
apiVersion: 1
datasources:
 - name: Sysdig
   type: sysdig
   access: proxy
   jsonData: 
     apiToken: [insert api token here]
   orgId: 1 
   editable: true
```

3. Configure Grafana to load dashboards from config files
   - Configure the Grafana dashboard provider file `/etc/grafana/provisioning/dashboards/dashboard.yml`
   - Take note of the path specified where Grafana will look for dashboards
```
apiVersion: 1
providers:
  # <string> provider name
- name: 'default'
  # <int> org id. will default to orgId 1 if not specified
  orgId: 1
  # <string, required> name of the dashboard folder. Required
  folder: ''
  # <string> folder UID. will be automatically generated if not specified
  folderUid: ''
  # <string, required> provider type. Required
  type: file
  # <bool> disable dashboard deletion
  disableDeletion: false
  # <bool> enable dashboard editing
  editable: true
  # <int> how often Grafana will scan for changed dashboards
  updateIntervalSeconds: 10  
  options:
    # <string, required> path to dashboard files on disk. Required
    path: /var/lib/grafana/dashboards
```
  - Drop your sysdig dashboard json into `/var/lib/grafana/dashboards`, for example;
```
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "gnetId": null,
  "graphTooltip": 0,
  "id": 56,
  "links": [],
  "panels": [
    {
      "content": "Ready Master Nodes",
      "datasource": "Sysdig",
      "gridPos": {
        "h": 2,
        "w": 24,
        "x": 0,
        "y": 0
      },
      "id": 11,
      "mode": "markdown",
      "options": {},
      "type": "text"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": false,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "datasource": "Sysdig",
      "format": "short",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 4,
        "w": 4,
        "x": 0,
        "y": 2
      },
      "id": 9,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "filter": "kubernetes.node.label.region in (\"master\")",
          "groupAggregation": "sum",
          "isSingleDataPoint": true,
          "isTabularFormat": false,
          "refId": "0",
          "segmentBy": null,
          "target": "kubernetes.node.ready",
          "timeAggregation": "avg"
        }
      ],
      "thresholds": "",
      "title": "Masters - Ready",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    }
  ],
  "schemaVersion": 20,
  "style": "dark",
  "tags": [
    "Sysdig",
    "Shared dashboard"
  ],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "browser",
  "title": " Capacity and Utilization"
}
```