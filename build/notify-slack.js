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
    slackUrl,
    { json },
    (err, res, body) => {
        if (err) {
            console.log(err);
            process.exit(1);
        }

        console.log(body.url);
        console.log(body.explanation);
        process.exit(0);
    }
);
