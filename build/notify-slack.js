const request = require('request');

const slackUrl = process.argv[2];
const version = process.argv[3];
const buildNumber = process.argv[4];
const branchName = process.argv[5];
const buildUrl = process.argv[6];
const result = process.argv[7];
const startTime = process.argv[8];
const duration = process.argv[9];
const changeSets = process.argv[10];

const text = `Build #${buildNumber} ${result} (started at ${startTime} and lasted ${duration}\n\nBranch name: ${branchName}\nVersion: : ${version}.${buildNumber}\nJenkins result: ${buildUrl}\n\n${changeSets}`;
const json = {
    channel: '#grafana-ds-activity',
    username: 'jenkins',
    text
};

request.post(
    slackUrl,
    { json },
    (err, res, body) => {
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
);
