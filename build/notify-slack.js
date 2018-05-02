const request = require('request');

const slackUrl = process.argv[2];
const version = process.argv[3];
const buildNumber = process.argv[4];
const branchName = process.argv[5];
const buildUrl = process.argv[6];
const result = process.argv[7];

const text = `Build #${buildNumber} still good :-)\n\nBranch name: ${branchName}\nVersion: : ${version}.${buildNumber}\nJenkins result: ${buildUrl}`;
const json = {
    channel: '#grafana-ds-activity',
    username: 'jenkins',
    text
};

request.post(
    '${SLACK_URL}',
    { json },
    (err, res, body) => {
        if (err) {
            return console.log(err);
        }

        console.log(body.url);
        console.log(body.explanation);
    }
);
